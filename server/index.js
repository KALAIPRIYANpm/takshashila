// Takshashila API + static front end. Run: node server/index.js

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConfig, config } from './config.js';
import { migrate, pool } from './db.js';
import { readSession } from './lib/auth.js';
import { HttpError, readJson, readRaw, send } from './lib/http.js';
import { Router } from './lib/router.js';
import authRoutes from './routes/auth.js';
import infraRoutes from './routes/infra.js';
import publicRoutes from './routes/public.js';
import staffRoutes from './routes/staff.js';
import studentRoutes from './routes/student.js';

checkConfig();
// Test deployments with no shell (e.g. Render's free plan) set SEED_IF_EMPTY=1 to load sample data on the first start.
if (process.env.SEED_IF_EMPTY === '1') {
  const seed = spawnSync(process.execPath, [fileURLToPath(new URL('./seed.js', import.meta.url)), '--force', '--if-empty'], { stdio: 'inherit' });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
}
await migrate();
const router = new Router();
for (const reg of [authRoutes, publicRoutes, studentRoutes, staffRoutes, infraRoutes]) reg(router);

const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(self)',
  ...(config.production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

/** Turn database errors caused by bad input into client errors instead of 500s. */
function dbError(err) {
  if (err.code === '23505') return new HttpError(409, 'This record already exists.');
  if (err.code === '23503') return new HttpError(422, 'That refers to something that does not exist.');
  if (typeof err.code === 'string' && err.code.startsWith('22')) return new HttpError(400, 'Some values are not in the right format.');
  return err;
}

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(config.clientDist)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Front end not built. Run "npm run build", or use "npm run dev" and open http://localhost:5173');
  }
  let file = path.normalize(path.join(config.clientDist, pathname));
  if (!file.startsWith(config.clientDist)) file = config.clientDist;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(config.clientDist, 'index.html'); // SPA fallback
  const ext = path.extname(file);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url.pathname);
  }
  const started = Date.now();
  const cookies = [];
  try {
    // CSRF guard: browsers can't add custom headers cross-site without CORS, which we never allow.
    if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'takshashila') {
      throw new HttpError(403, 'Missing request header.');
    }
    const found = router.match(req.method, url.pathname);
    if (!found) throw new HttpError(404, 'No such API endpoint.');
    if (found.methodNotAllowed) throw new HttpError(405, 'Method not allowed.');
    const ctx = {
      req, res, params: found.params, query: url.searchParams, user: await readSession(req), status: 200,
      json: () => readJson(req),
      raw: (limit) => readRaw(req, limit),
      setCookie: (c) => cookies.push(c),
    };
    const result = await found.route.handlers.at(-1)(ctx);
    if (!res.headersSent) send(res, ctx.status, result ?? {}, { ...SECURITY_HEADERS, ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  } catch (caught) {
    if (res.headersSent) return res.destroy();
    const err = dbError(caught);
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: status === 500 ? 'Something went wrong on our side. Try again in a minute.' : err.message, fields: err.details || undefined }, SECURITY_HEADERS);
  } finally {
    if (!config.production) console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

server.listen(config.port, () => {
  console.log(`Takshashila API on http://localhost:${config.port}${config.demoMode ? '  (demo mode: OTP shown on screen)' : ''}`);
});

// Hosts send SIGTERM on every deploy: finish in-flight requests, then close the database pool.
let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    console.log(`${sig} received, shutting down`);
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => pool.end().finally(() => process.exit(0)));
    server.closeIdleConnections?.();
  });
}
