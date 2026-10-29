// School infrastructure requests: schools ask, field staff verify on site, managers approve, finance pays the vendor, school confirms delivery.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { STAFF_ROLES } from '../constants.js';
import { all, audit, get, insert, run, tx } from '../db.js';
import { INFRA_STATUSES, PHOTO_KINDS, facilityGaps, priorityScore, profileStatus, validateRequest, validateSchool } from '../infrastructure.js';
import { guard } from '../lib/auth.js';
import { fail, writeBody } from '../lib/http.js';
import { sendFile } from './student.js';

const MANAGERS = ['manager', 'admin'];
const FILE_EXT = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };
const MAX_FILE = 25 * 1024 * 1024;

const mySchool = (user) => get('SELECT * FROM schools WHERE user_id = ?', user.id);
const PHOTO_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };
const schoolPhotos = (schoolId) => all(`SELECT id, kind, file_name, mime, latitude, longitude, accuracy, created_at
                                        FROM school_photos WHERE school_id = ? ORDER BY id`, schoolId);

/** A geo-tag sent with an upload (X-Geo-Lat / X-Geo-Lng / X-Geo-Accuracy headers), if the phone shared one. */
function geoFrom(req) {
  const lat = Number(req.headers['x-geo-lat']), lng = Number(req.headers['x-geo-lng']), acc = Number(req.headers['x-geo-accuracy']);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) || !req.headers['x-geo-lat']) return { lat: null, lng: null, acc: null };
  return { lat, lng, acc: Number.isFinite(acc) ? Math.round(acc) : null };
}

/** Schools see their own requests; field staff their district; managers and admins everything. */
function canAccess(user, school) {
  if (!school) return false;
  if (user.role === 'school') return school.user_id === user.id;
  if (user.role === 'field') return school.district === user.district;
  return STAFF_ROLES.includes(user.role);
}

async function loadRequest(user, id) {
  const r = await get('SELECT * FROM infra_requests WHERE id = ?', Number(id));
  const school = r && await get('SELECT * FROM schools WHERE id = ?', r.school_id);
  if (!canAccess(user, school)) fail(404, 'Request not found.');
  return { r, school };
}

async function detail(r, school) {
  const photos = await schoolPhotos(school.id);
  const payments = await all(`SELECT id, payee, amount, purpose, status, utr, created_at, paid_at FROM payments
                              WHERE infra_request_id = ? ORDER BY id DESC`, r.id);
  return {
    request: r,
    school,
    schoolPhotos: photos,
    gaps: facilityGaps(school),
    items: await all('SELECT * FROM infra_items WHERE request_id = ? ORDER BY id', r.id),
    documents: await all('SELECT id, kind, file_name, mime, created_at FROM infra_documents WHERE request_id = ? ORDER BY id', r.id),
    events: await all(`SELECT e.*, u.name AS actor_name, u.role AS actor_role FROM infra_events e JOIN users u ON u.id = e.actor_id
                       WHERE request_id = ? ORDER BY e.id DESC`, r.id),
    payments,
    released: payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
  };
}

const event = (requestId, actorId, action, comment = null, amount = null) =>
  run('INSERT INTO infra_events (request_id, actor_id, action, comment, amount) VALUES (?,?,?,?,?)', requestId, actorId, action, comment, amount);

/** Move a request on only if nobody else changed its status since it was read. */
async function move(r, next, actor, action, comment, extra = {}) {
  await tx(async () => {
    const sets = ['status = ?', 'updated_at = now()', ...Object.keys(extra).map((k) => `${k} = ?`)];
    const moved = await run(`UPDATE infra_requests SET ${sets.join(', ')} WHERE id = ? AND status = ?`, next, ...Object.values(extra), r.id, r.status);
    if (!moved.rowCount) fail(409, 'Someone else just updated this request. Reload to see the latest.');
    await event(r.id, actor.id, action, comment || null, extra.amount_sanctioned ?? null);
  });
  await audit(actor.id, action, 'infra_request', r.id, { comment, ...extra });
}

export default function register(router) {
  // ---------------- school portal ----------------
  router.get('/api/school/me', guard(['school'], async ({ user }) => {
    const school = await mySchool(user);
    if (!school) return { school: null, requests: [], photos: [], status: profileStatus(null) };
    const photos = await schoolPhotos(school.id);
    const requests = await all(`SELECT r.id, r.code, r.title, r.status, r.urgency, r.estimate, r.amount_sanctioned, r.created_at, r.updated_at,
                                  (SELECT COUNT(*) FROM infra_items i WHERE i.request_id = r.id) AS items
                                FROM infra_requests r WHERE school_id = ? ORDER BY r.id DESC`, school.id);
    return { school, requests, photos, status: profileStatus(school, photos), gaps: facilityGaps(school) };
  }));

  router.put('/api/school/me', guard(['school'], async (ctx) => {
    const { data: d, errors } = validateSchool(await ctx.json());
    const taken = d.udise_code && await get('SELECT user_id FROM schools WHERE udise_code = ?', d.udise_code);
    if (taken && taken.user_id !== ctx.user.id) errors.udise_code = 'This UDISE code is already registered by another account. Contact the helpline if this is your school.';
    if (Object.keys(errors).length) fail(422, 'Check the school details.', errors);
    const cols = ['name', 'udise_code', 'school_type', 'level', 'medium', 'board', 'shifts', 'established', 'headmaster', 'headmaster_phone', 'contact_role',
      'email', 'address', 'village', 'gram_panchayat', 'taluk', 'district', 'state', 'pin', 'area_type', 'area_tags',
      'boys', 'girls', 'students', 'cwsn', 'male_teachers', 'female_teachers', 'teachers', 'non_teaching', 'classrooms',
      'latitude', 'longitude', 'location_accuracy', 'facilities'];
    const before = await mySchool(ctx.user);
    // Remember when the geo-tag was captured; keep the old time if the point didn't move.
    const moved = d.latitude !== null && (before?.latitude !== d.latitude || before?.longitude !== d.longitude);
    const values = cols.map((c) => (c === 'facilities' ? JSON.stringify(d.facilities) : d[c] ?? null));
    await run(`INSERT INTO schools (user_id, ${cols.join(', ')}, located_at) VALUES (?, ${cols.map(() => '?').join(', ')}, ${moved ? 'now()' : 'NULL'})
               ON CONFLICT (user_id) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')},
               located_at = ${moved ? 'now()' : d.latitude === null ? 'NULL' : 'schools.located_at'}, updated_at = now()`,
      ctx.user.id, ...values);
    await run('UPDATE users SET name = ?, district = ? WHERE id = ?', d.name, d.district, ctx.user.id);
    return { ok: true };
  }));

  router.post('/api/school/requests', guard(['school'], async (ctx) => {
    const school = await mySchool(ctx.user);
    if (!school) fail(409, 'Fill in your school profile first.');
    const status = profileStatus(school, await schoolPhotos(school.id));
    if (!status.ready) fail(409, `Complete your school profile first: ${status.missing.join(', ')}.`);
    const open = await get("SELECT COUNT(*) AS n FROM infra_requests WHERE school_id = ? AND status IN ('submitted','verified')", school.id);
    if (open.n >= 3) fail(409, 'You have 3 requests waiting for review. Wait for a decision on those before adding more.');
    const { data: d, errors } = validateRequest(await ctx.json(), school);
    if (Object.keys(errors).length) fail(422, 'Some details need fixing.', errors);
    const { score, detail: why } = priorityScore(school, d.items, d.urgency);
    const out = await tx(async () => {
      const n = (await get("SELECT nextval('infra_code_seq') AS n")).n;
      const code = `INF-${String(new Date().getFullYear()).slice(2)}-${String(n).padStart(5, '0')}`;
      const id = await insert(`INSERT INTO infra_requests (code, school_id, title, urgency, justification, beneficiaries, estimate, priority, priority_detail, created_by)
                               VALUES (?,?,?,?,?,?,?,?,?,?)`, code, school.id, d.title, d.urgency, d.justification, d.beneficiaries, d.estimate, score, JSON.stringify(why), ctx.user.id);
      for (const i of d.items) {
        await run('INSERT INTO infra_items (request_id, item_key, name, category, quantity, unit_cost, note) VALUES (?,?,?,?,?,?,?)',
          id, i.item_key, i.name, i.category, i.quantity, i.unit_cost, i.note || null);
      }
      await event(id, ctx.user.id, 'submitted');
      return { id, code, priority: score };
    });
    await audit(ctx.user.id, 'create', 'infra_request', out.id, { estimate: d.estimate, priority: score });
    ctx.status = 201;
    return out;
  }));

  router.get('/api/school/requests/:id', guard(['school'], async ({ user, params }) => {
    const { r, school } = await loadRequest(user, params.id);
    return detail(r, school);
  }));

  // The school confirms the items arrived; a delivery photo must be uploaded first.
  router.post('/api/school/requests/:id/delivered', guard(['school'], async (ctx) => {
    const { r } = await loadRequest(ctx.user, ctx.params.id);
    if (r.status !== 'ordered') fail(409, 'You can confirm delivery once the order has been placed.');
    if (!(await get("SELECT 1 AS x FROM infra_documents WHERE request_id = ? AND kind = 'delivery'", r.id))) {
      fail(422, 'Upload at least one photo of the delivered items first.');
    }
    const { comment } = await ctx.json();
    await move(r, 'delivered', ctx.user, 'delivered', String(comment || '').trim().slice(0, 1000), { delivered_at: new Date().toISOString() });
    return { status: 'delivered' };
  }));

  // ---------------- school photos ----------------
  router.put('/api/school/photos/:kind', guard(['school'], async (ctx) => {
    const school = await mySchool(ctx.user);
    if (!school) fail(409, 'Save your school profile first.');
    const { kind } = ctx.params;
    if (!PHOTO_KINDS[kind]) fail(400, 'Unknown photo type.');
    if ((await get('SELECT COUNT(*) AS n FROM school_photos WHERE school_id = ?', school.id)).n >= 30) fail(422, 'You can keep up to 30 school photos. Delete some first.');
    let name;
    try { name = decodeURIComponent(ctx.req.headers['x-file-name'] || 'photo'); } catch { fail(400, 'The file name is not valid.'); }
    const safeName = path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const ext = path.extname(safeName).toLowerCase();
    if (!PHOTO_EXT[ext]) fail(400, `Use a photo (${Object.keys(PHOTO_EXT).join(', ')}).`);
    const stored = `${crypto.randomUUID()}${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const size = await writeBody(ctx.req, path.join(config.uploadDir, stored), MAX_FILE);
    if (!size) { fs.rmSync(path.join(config.uploadDir, stored), { force: true }); fail(400, 'The file is empty.'); }
    const geo = geoFrom(ctx.req);
    const id = await insert(`INSERT INTO school_photos (school_id, kind, file_name, stored_name, mime, size, latitude, longitude, accuracy, uploaded_by)
                             VALUES (?,?,?,?,?,?,?,?,?,?)`, school.id, kind, safeName, stored, PHOTO_EXT[ext], size, geo.lat, geo.lng, geo.acc, ctx.user.id);
    await audit(ctx.user.id, 'upload', 'school_photo', id, { kind, geotagged: geo.lat !== null });
    ctx.status = 201;
    return { id, geotagged: geo.lat !== null };
  }));

  router.delete('/api/school/photos/:id', guard(['school'], async (ctx) => {
    const school = await mySchool(ctx.user);
    const ph = school && await get('SELECT * FROM school_photos WHERE id = ? AND school_id = ?', Number(ctx.params.id), school.id);
    if (!ph) fail(404, 'Photo not found.');
    await run('DELETE FROM school_photos WHERE id = ?', ph.id);
    fs.rm(path.join(config.uploadDir, ph.stored_name), { force: true }, () => {});
    return { ok: true };
  }));

  router.get('/api/school-photos/:id', guard([], async (ctx) => {
    const ph = await get('SELECT * FROM school_photos WHERE id = ?', Number(ctx.params.id));
    const school = ph && await get('SELECT * FROM schools WHERE id = ?', ph.school_id);
    if (!canAccess(ctx.user, school)) fail(404, 'Photo not found.');
    sendFile(ctx, ph);
  }));

  // ---------------- shared: files ----------------
  router.put('/api/infra/:id/documents/:kind', guard([], async (ctx) => {
    const { r } = await loadRequest(ctx.user, ctx.params.id);
    const { kind } = ctx.params;
    if (!['condition', 'quotation', 'delivery', 'invoice'].includes(kind)) fail(400, 'Unknown document type.');
    if (ctx.user.role === 'school') {
      const allowed = { condition: ['submitted', 'verified'], delivery: ['ordered'], invoice: ['ordered', 'delivered'], quotation: ['submitted', 'verified'] }[kind];
      if (!allowed.includes(r.status)) fail(403, "This file can't be added at the request's current stage.");
    }
    let name;
    try { name = decodeURIComponent(ctx.req.headers['x-file-name'] || 'file'); } catch { fail(400, 'The file name is not valid.'); }
    const safeName = path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const ext = path.extname(safeName).toLowerCase();
    if (!FILE_EXT[ext]) fail(400, `Use a photo or PDF (${Object.keys(FILE_EXT).join(', ')}).`);
    if ((await get('SELECT COUNT(*) AS n FROM infra_documents WHERE request_id = ?', r.id)).n >= 40) fail(422, 'This request already has 40 files.');
    const stored = `${crypto.randomUUID()}${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const size = await writeBody(ctx.req, path.join(config.uploadDir, stored), MAX_FILE);
    if (!size) { fs.rmSync(path.join(config.uploadDir, stored), { force: true }); fail(400, 'The file is empty.'); }
    const id = await insert('INSERT INTO infra_documents (request_id, kind, file_name, stored_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?,?)',
      r.id, kind, safeName, stored, FILE_EXT[ext], size, ctx.user.id);
    await audit(ctx.user.id, 'upload', 'infra_document', id, { kind });
    ctx.status = 201;
    return { id };
  }));

  router.get('/api/infra/files/:id', guard([], async (ctx) => {
    const d = await get('SELECT * FROM infra_documents WHERE id = ?', Number(ctx.params.id));
    if (!d) fail(404, 'File not found.');
    await loadRequest(ctx.user, d.request_id);
    sendFile(ctx, d);
  }));

  // ---------------- staff ----------------
  router.get('/api/staff/infra', guard(STAFF_ROLES, async ({ user, query }) => {
    const where = []; const args = [];
    if (user.role === 'field') { where.push('s.district = ?'); args.push(user.district); }
    const scope = where.length ? ` AND ${where.join(' AND ')}` : '';
    const status = query.get('status'), district = query.get('district'), q = (query.get('q') || '').trim();
    let filt = '';
    const fargs = [];
    if (status && INFRA_STATUSES[status]) { filt += ' AND r.status = ?'; fargs.push(status); }
    if (district) { filt += ' AND s.district = ?'; fargs.push(district); }
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      filt += ' AND (s.name ILIKE ? OR r.code ILIKE ? OR r.title ILIKE ? OR s.udise_code ILIKE ?)'; fargs.push(like, like, like, like);
    }
    const order = { newest: 'r.id DESC', amount: 'r.estimate DESC' }[query.get('sort')] || 'r.priority DESC, r.id';
    const rows = await all(`SELECT r.id, r.code, r.title, r.status, r.urgency, r.estimate, r.amount_sanctioned, r.priority, r.beneficiaries, r.created_at,
                              s.name AS school, s.district, s.village, s.school_type, s.udise_code
                            FROM infra_requests r JOIN schools s ON s.id = r.school_id WHERE 1=1${scope}${filt} ORDER BY ${order}`, ...args, ...fargs);
    const byStatus = Object.fromEntries((await all(`SELECT r.status, COUNT(*) AS n FROM infra_requests r JOIN schools s ON s.id = r.school_id
                                                    WHERE 1=1${scope} GROUP BY r.status`, ...args)).map((x) => [x.status, x.n]));
    const districts = (await all(`SELECT DISTINCT s.district FROM schools s WHERE 1=1${scope} ORDER BY 1`, ...args)).map((x) => x.district);
    const totals = await get(`SELECT COALESCE(SUM(r.amount_sanctioned),0) AS sanctioned,
                                COALESCE(SUM(r.beneficiaries) FILTER (WHERE r.status = 'delivered'),0) AS reached,
                                COUNT(DISTINCT r.school_id) FILTER (WHERE r.status IN ('approved','ordered','delivered')) AS schools
                              FROM infra_requests r JOIN schools s ON s.id = r.school_id WHERE 1=1${scope}`, ...args);
    return { rows, byStatus, districts, totals };
  }));

  router.get('/api/staff/schools', guard(STAFF_ROLES, async ({ user, query }) => {
    const where = []; const args = [];
    if (user.role === 'field') { where.push('s.district = ?'); args.push(user.district); }
    const district = query.get('district'), q = (query.get('q') || '').trim();
    if (district) { where.push('s.district = ?'); args.push(district); }
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(s.name ILIKE ? OR s.udise_code ILIKE ? OR s.taluk ILIKE ? OR s.village ILIKE ?)'); args.push(like, like, like, like);
    }
    const rows = await all(`SELECT s.*, (SELECT COUNT(*) FROM infra_requests r WHERE r.school_id = s.id) AS requests,
                              (SELECT COUNT(*) FROM infra_requests r WHERE r.school_id = s.id AND r.status = 'delivered') AS delivered,
                              (SELECT COALESCE(SUM(amount_sanctioned), 0) FROM infra_requests r WHERE r.school_id = s.id) AS sanctioned,
                              (SELECT COUNT(*) FROM school_photos p WHERE p.school_id = s.id) AS photos
                            FROM schools s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.district, s.name`, ...args);
    const scope = user.role === 'field' ? ' WHERE district = ?' : '';
    const districts = (await all(`SELECT DISTINCT district FROM schools${scope} ORDER BY 1`, ...(scope ? [user.district] : []))).map((x) => x.district);
    return { rows: rows.map((s) => ({ ...s, gaps: facilityGaps(s) })), districts };
  }));

  router.get('/api/staff/schools/:id', guard(STAFF_ROLES, async ({ user, params }) => {
    const school = await get('SELECT * FROM schools WHERE id = ?', Number(params.id));
    if (!canAccess(user, school)) fail(404, 'School not found.');
    const photos = await schoolPhotos(school.id);
    return {
      school, photos, gaps: facilityGaps(school), status: profileStatus(school, photos),
      contact: await get('SELECT name, phone FROM users WHERE id = ?', school.user_id),
      requests: await all('SELECT id, code, title, status, urgency, estimate, amount_sanctioned, priority, created_at FROM infra_requests WHERE school_id = ? ORDER BY id DESC', school.id),
    };
  }));

  router.get('/api/staff/infra/:id', guard(STAFF_ROLES, async ({ user, params }) => {
    const { r, school } = await loadRequest(user, params.id);
    const others = await all('SELECT id, code, title, status, estimate, created_at FROM infra_requests WHERE school_id = ? AND id != ? ORDER BY id DESC', school.id, r.id);
    return { ...(await detail(r, school)), others };
  }));

  router.post('/api/staff/infra/:id/decision', guard(STAFF_ROLES, async (ctx) => {
    const { r } = await loadRequest(ctx.user, ctx.params.id);
    const b = await ctx.json();
    const comment = String(b.comment || '').trim().slice(0, 1000);
    const isManager = MANAGERS.includes(ctx.user.role);
    const need = (msg) => { if (!comment) fail(422, msg, { comment: 'Required' }); };
    switch (`${r.status}:${b.action}`) {
      case 'submitted:verify':
        need('Add your site-visit notes: what you saw and whether the request is genuine.');
        await move(r, 'verified', ctx.user, 'verified', comment);
        return { status: 'verified' };
      case 'verified:approve': {
        if (!isManager) break;
        const amount = Math.round(Number(b.amount));
        if (!(amount >= 500 && amount <= r.estimate)) fail(422, `Sanction between ₹500 and the estimate of ₹${r.estimate.toLocaleString('en-IN')}.`, { amount: 'Invalid' });
        await move(r, 'approved', ctx.user, 'approved', comment, { amount_sanctioned: amount });
        return { status: 'approved' };
      }
      case 'verified:send_back':
        if (!isManager) break;
        need('Say what the field executive should check again.');
        await move(r, 'submitted', ctx.user, 'sent_back', comment);
        return { status: 'submitted' };
      case 'submitted:reject':
      case 'verified:reject':
        need('Add a reason. The school will see it.');
        await move(r, 'rejected', ctx.user, 'rejected', comment);
        return { status: 'rejected' };
      case 'ordered:delivered': // field staff confirm on the school's behalf, with a photo
        if (!(await get("SELECT 1 AS x FROM infra_documents WHERE request_id = ? AND kind = 'delivery'", r.id))) fail(422, 'Upload a delivery photo first.');
        await move(r, 'delivered', ctx.user, 'delivered', comment, { delivered_at: new Date().toISOString() });
        return { status: 'delivered' };
      default:
    }
    fail(403, "You can't take that action at this stage.");
  }));
}
