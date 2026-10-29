import crypto from 'node:crypto';
import { config } from '../config.js';
import { STAFF_ROLES } from '../constants.js';
import { get, run } from '../db.js';
import { COOKIE, hashCode, sendOtp, signSession } from '../lib/auth.js';
import { clientIp, cookie, fail } from '../lib/http.js';

const OTP_TTL_MS = 5 * 60 * 1000;
// Limits on sending codes: they cost money and each new code allows 5 more guesses.
const RESEND_AFTER_S = 30;
const MAX_PER_PHONE_HOUR = 5;
const MAX_PER_IP_HOUR = 20;
const normalise = (p) => String(p || '').replace(/\D/g, '').slice(-10);

async function checkSendLimits(phone, ip) {
  const p = await get(`SELECT COUNT(*) AS n, EXTRACT(EPOCH FROM now() - MAX(sent_at)) AS ago
                       FROM otp_sends WHERE phone = ? AND sent_at > now() - interval '1 hour'`, phone);
  if (p.ago !== null && p.ago < RESEND_AFTER_S) fail(429, `Wait ${Math.ceil(RESEND_AFTER_S - p.ago)} seconds before asking for another code.`);
  if (p.n >= MAX_PER_PHONE_HOUR) fail(429, 'Too many codes asked for this number. Try again in an hour.');
  const i = await get("SELECT COUNT(*) AS n FROM otp_sends WHERE ip = ? AND sent_at > now() - interval '1 hour'", ip);
  if (i.n >= MAX_PER_IP_HOUR) fail(429, 'Too many sign-in attempts from this network. Try again in an hour.');
}

/**
 * The staff portal only signs in existing, active staff: a mistyped number must not quietly create a student account.
 * The school portal creates school accounts, but never turns a student's or staff member's number into one.
 */
async function checkPortal(portal, phone) {
  const u = await get('SELECT role, active FROM users WHERE phone = ?', phone);
  if (u && !u.active) fail(403, 'This account has been deactivated. Contact your administrator.');
  if (portal === 'school' && u && u.role !== 'school') {
    fail(409, `This number is already registered as a ${u.role === 'student' ? 'student' : 'staff'} account. Use a different number for the school.`, { phone: 'Already in use' });
  }
  if (portal === 'staff' && (!u || !STAFF_ROLES.includes(u.role))) {
    fail(404, "This number isn't registered as a staff account. Ask your administrator to add you.", { phone: 'Not a staff number' });
  }
}

export default function register(r) {
  r.post('/api/auth/otp', async (ctx) => {
    const { phone: raw, portal } = await ctx.json();
    const phone = normalise(raw);
    if (!/^[6-9]\d{9}$/.test(phone)) fail(422, 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.', { phone: 'Invalid number' });
    await checkPortal(portal, phone);
    const ip = clientIp(ctx.req, config.trustProxy);
    await checkSendLimits(phone, ip);
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    await sendOtp(phone, code);
    await run(`INSERT INTO otps (phone, code_hash, expires_at, tries) VALUES (?,?,?,0)
               ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = 0`,
      phone, hashCode(phone, code), Date.now() + OTP_TTL_MS);
    await run('INSERT INTO otp_sends (phone, ip) VALUES (?,?)', phone, ip);
    if (Math.random() < 0.02) await run("DELETE FROM otp_sends WHERE sent_at < now() - interval '1 day'");
    return { phone, sent: true, ...(config.demoMode ? { demoCode: code } : {}) };
  });

  r.post('/api/auth/verify', async (ctx) => {
    const body = await ctx.json();
    const phone = normalise(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');
    await checkPortal(body.portal, phone);
    const otp = await get('SELECT * FROM otps WHERE phone = ?', phone);
    if (!otp || otp.expires_at < Date.now()) fail(410, 'That code expired. Ask for a new one.');
    if (otp.tries >= 5) fail(429, 'Too many wrong tries. Ask for a new code.');
    const expected = Buffer.from(otp.code_hash);
    const given = Buffer.from(hashCode(phone, code));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
      await run('UPDATE otps SET tries = tries + 1 WHERE phone = ?', phone);
      fail(401, "That code doesn't match. Check the SMS and try again.");
    }
    // Delete-and-check makes the code single-use even if two verify requests race.
    if (!(await run('DELETE FROM otps WHERE phone = ? AND code_hash = ?', phone, otp.code_hash)).rowCount) {
      fail(410, 'That code was already used. Ask for a new one.');
    }
    let user = await get('SELECT id, name, phone, role, district FROM users WHERE phone = ?', phone);
    if (!user) {
      await run('INSERT INTO users (phone, role) VALUES (?, ?) ON CONFLICT (phone) DO NOTHING', phone, body.portal === 'school' ? 'school' : 'student');
      user = await get('SELECT id, name, phone, role, district FROM users WHERE phone = ?', phone);
    }
    ctx.setCookie(cookie(COOKIE, signSession(user.id), { maxAge: config.sessionDays * 86400, secure: config.production }));
    const hasApplication = !!(await get('SELECT 1 AS x FROM applications WHERE student_id = ?', user.id));
    return { user, hasApplication };
  });

  r.get('/api/auth/me', async (ctx) => {
    if (!ctx.user) return { user: null };
    const hasApplication = !!(await get('SELECT 1 AS x FROM applications WHERE student_id = ?', ctx.user.id));
    return { user: ctx.user, hasApplication };
  });

  r.post('/api/auth/logout', (ctx) => {
    ctx.setCookie(cookie(COOKIE, '', { maxAge: 0 }));
    return { ok: true };
  });
}
