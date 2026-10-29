import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { all, audit, get, run } from '../db.js';
import { guard } from '../lib/auth.js';
import { fail } from '../lib/http.js';
import { matchSchemes } from '../schemes.js';
import { checklist, createApplication, publicApp, saveUpload, validateApplication } from '../services.js';

const myApp = (user) => get('SELECT * FROM applications WHERE student_id = ?', user.id);

/** Who may touch an application's files: its student, or staff (field staff only in their scope). */
export function canAccessApp(user, app) {
  if (!app) return false;
  if (user.role === 'student') return app.student_id === user.id;
  if (user.role === 'field') return app.mobilizer_id === user.id || app.district === user.district;
  return true;
}

export default function register(r) {
  r.post('/api/applications', guard(['student'], async (ctx) => {
    if (await myApp(ctx.user)) fail(409, 'You have already applied. Track it on your page.');
    const { data, errors } = validateApplication(await ctx.json());
    if (Object.keys(errors).length) fail(422, 'Some answers need fixing.', errors);
    ctx.status = 201;
    return createApplication(data, ctx.user.id, null, ctx.user.id);
  }));

  r.get('/api/me/application', guard(['student'], async (ctx) => {
    const a = await myApp(ctx.user);
    if (!a) return { application: null };
    const { rows, missing } = await checklist(a);
    const reviews = await all(`SELECT r.action, r.comment, r.amount, r.created_at, u.name AS actor_name, u.role AS actor_role
                         FROM reviews r JOIN users u ON u.id = r.actor_id WHERE application_id = ? ORDER BY r.id DESC`, a.id);
    const payments = await all("SELECT id, payee, amount, purpose, kind, status, created_at, paid_at FROM payments WHERE application_id = ? AND status != 'rejected' ORDER BY id DESC", a.id);
    const renewals = await all('SELECT * FROM renewals WHERE application_id = ? ORDER BY id DESC', a.id);
    const trainings = await all(`SELECT t.id, t.title, t.venue, t.held_on, a.present FROM trainings t JOIN attendance a ON a.training_id = t.id
                           WHERE a.application_id = ? ORDER BY t.held_on DESC`, a.id);
    const opportunities = (await all('SELECT * FROM opportunities ORDER BY deadline'))
      .filter((o) => !o.for_levels || o.for_levels.split(',').includes(a.level));
    return {
      application: publicApp(a),
      checklist: rows.map(({ doc, ...d }) => ({ ...d, uploaded: !!doc })),
      missing: missing.map((m) => m.key),
      reviews, payments, renewals, trainings, opportunities,
      schemes: matchSchemes(a),
      received: payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
    };
  }));

  // Raw file upload: PUT body = file bytes; X-File-Name header = original name.
  r.put('/api/applications/:id/documents/:type', guard([], async (ctx) => {
    const a = await get('SELECT * FROM applications WHERE id = ?', Number(ctx.params.id));
    if (!canAccessApp(ctx.user, a)) fail(404, 'Application not found.');
    if (ctx.user.role === 'student' && !['submitted', 'field_verified'].includes(a.status) && !ctx.params.type.startsWith('receipt_')) {
      fail(403, 'Documents are locked after approval. Contact your field executive to change them.');
    }
    let name;
    try { name = decodeURIComponent(ctx.req.headers['x-file-name'] || 'file'); } catch { fail(400, 'The file name is not valid.'); }
    const id = await saveUpload(a.id, ctx.params.type, name, ctx.req);
    await audit(ctx.user.id, 'upload', 'document', id, { type: ctx.params.type });
    ctx.status = 201;
    return { id };
  }));

  r.post('/api/me/renewals', guard(['student'], async (ctx) => {
    const a = await myApp(ctx.user);
    if (!a || !['approved', 'disbursed'].includes(a.status)) fail(403, 'Renewals open once you are selected.');
    const b = await ctx.json();
    const marks = Number(b.marks), attendance = Number(b.attendance);
    const semester = String(b.semester || '').trim().slice(0, 40);
    const errors = {};
    if (!semester) errors.semester = 'Enter which semester or term this is for.';
    if (!(marks >= 0 && marks <= 100)) errors.marks = 'Marks must be 0–100.';
    if (!(attendance >= 0 && attendance <= 100)) errors.attendance = 'Attendance must be 0–100.';
    if (Object.keys(errors).length) fail(422, 'Check the semester details.', errors);
    const receipt = b.receiptDocId ? await get('SELECT id FROM documents WHERE id = ? AND application_id = ?', Number(b.receiptDocId), a.id) : null;
    const status = marks < 50 || attendance < 75 ? 'at_risk' : 'pending';
    await run('INSERT INTO renewals (application_id, semester, marks, attendance, receipt_doc_id, status) VALUES (?,?,?,?,?,?)',
      a.id, semester, marks, attendance, receipt?.id ?? null, status);
    ctx.status = 201;
    return { status };
  }));

  r.get('/api/files/:id', guard([], async (ctx) => {
    const d = await get('SELECT * FROM documents WHERE id = ?', Number(ctx.params.id));
    const a = d && await get('SELECT * FROM applications WHERE id = ?', d.application_id);
    if (!d || !canAccessApp(ctx.user, a)) fail(404, 'File not found.');
    sendFile(ctx, d);
  }));
}

/** Stream an uploaded file (row with stored_name, file_name, mime), with Range support so videos can seek. */
export function sendFile(ctx, d) {
  const file = path.join(config.uploadDir, d.stored_name);
  if (!fs.existsSync(file)) fail(404, 'File not found.');
  const stat = fs.statSync(file);
  const range = ctx.req.headers.range && /bytes=(\d*)-(\d*)/.exec(ctx.req.headers.range);
  const headers = {
    'Content-Type': d.mime || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${d.file_name.replace(/"/g, '')}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
  };
  if (range && (range[1] || range[2])) { // video seeking
    const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      ctx.res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return ctx.res.end();
    }
    ctx.res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(ctx.res);
  } else {
    ctx.res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(ctx.res);
  }
}
