// Phone + OTP sign-in with an HMAC-signed session cookie.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { get } from '../db.js';
import { fail, parseCookies } from './http.js';
import { sendOtpSms } from './sms.js';

const COOKIE = 'tk_session';
export { COOKIE };

const hmac = (s) => crypto.createHmac('sha256', config.secret).update(s).digest('base64url');

export function signSession(userId) {
  const exp = Date.now() + config.sessionDays * 864e5;
  const payload = `${userId}.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

export async function readSession(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const [id, exp, sig] = token.split('.');
  if (!id || !exp || !sig) return null;
  const expected = hmac(`${id}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return (await get('SELECT id, name, phone, role, district FROM users WHERE id = ? AND active', Number(id))) || null;
}

export const hashCode = (phone, code) => hmac(`otp:${phone}:${code}`);
export const hashAadhaar = (n) => crypto.createHash('sha256').update(config.secret + n).digest('hex');

export async function sendOtp(phone, code) {
  if (config.demoMode) return;
  await sendOtpSms(phone, code);
}

/** Wrap a handler so only signed-in users with one of `roles` (any role if empty) can call it. */
export const guard = (roles, handler) => (ctx) => {
  if (!ctx.user) fail(401, 'Sign in to continue.');
  if (roles.length && !roles.includes(ctx.user.role)) fail(403, "Your account can't do this.");
  return handler(ctx);
};
