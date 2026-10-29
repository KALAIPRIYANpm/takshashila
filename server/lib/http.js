// Small HTTP helpers on top of node:http (no framework needed).
import fs from 'node:fs';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const fail = (status, message, details) => { throw new HttpError(status, message, details); };

export function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function readRaw(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new HttpError(413, `File is too large. The limit is ${Math.round(limitBytes / 1048576)} MB.`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('application/json')) fail(415, 'Send JSON.');
  const raw = await readRaw(req, 1024 * 1024);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    fail(400, 'The request body is not valid JSON.');
  }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}

/** Stream the request body into `file` without holding it in memory. Resolves with the byte count. */
export function writeBody(req, file, limitBytes) {
  const tooLarge = () => new HttpError(413, `File is too large. The limit is ${Math.round(limitBytes / 1048576)} MB.`);
  if (Number(req.headers['content-length']) > limitBytes) return Promise.reject(tooLarge());
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file, { flags: 'wx' });
    let size = 0, failed = false;
    const abort = (err) => {
      if (failed) return;
      failed = true;
      req.unpipe(out);
      out.destroy();
      fs.rm(file, { force: true }, () => reject(err));
    };
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { abort(tooLarge()); req.resume(); }
    });
    req.on('error', abort);
    req.on('aborted', () => abort(new HttpError(400, 'The upload was interrupted. Try again.')));
    out.on('error', abort);
    out.on('finish', () => { if (!failed) resolve(size); });
    req.pipe(out);
  });
}

/** The caller's IP. Behind a proxy (Render, Railway, Nginx) that's the first X-Forwarded-For entry. */
export function clientIp(req, trustProxy) {
  const fwd = trustProxy && req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}
