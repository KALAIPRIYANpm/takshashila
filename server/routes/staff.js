import { STAFF_ROLES, STATUSES } from '../constants.js';
import { all, audit, get, insert, run, tx } from '../db.js';
import { guard } from '../lib/auth.js';
import { fail } from '../lib/http.js';
import { matchSchemes } from '../schemes.js';
import { breakdown } from '../scoring.js';
import { checklist, createApplication, parseAnswers, publicApp, validateApplication } from '../services.js';
import { canAccessApp } from './student.js';

const STAFF = STAFF_ROLES;
const MANAGERS = ['manager', 'admin'];

/** Field executives see their district and the students they registered; others see all. */
function scope(user, alias = 'a') {
  if (user.role === 'field') return { sql: ` AND (${alias}.mobilizer_id = ? OR ${alias}.district = ?)`, args: [user.id, user.district] };
  return { sql: '', args: [] };
}

async function loadApp(user, id) {
  const a = await get('SELECT * FROM applications WHERE id = ?', Number(id));
  if (!canAccessApp(user, a)) fail(404, 'Application not found.');
  return a;
}

export default function register(r) {
  r.get('/api/staff/overview', guard(STAFF, async ({ user }) => {
    const s = scope(user);
    const byStatus = Object.fromEntries((await all(`SELECT status, COUNT(*) AS n FROM applications a WHERE 1=1${s.sql} GROUP BY status`, ...s.args)).map((x) => [x.status, x.n]));
    const byDistrict = await all(`SELECT district, COUNT(*) AS n, COUNT(*) FILTER (WHERE status IN ('approved','disbursed')) AS funded
                            FROM applications a WHERE 1=1${s.sql} GROUP BY district ORDER BY n DESC LIMIT 8`, ...s.args);
    const sanctioned = (await get(`SELECT COALESCE(SUM(amount_sanctioned),0) AS v FROM applications a WHERE status IN ('approved','disbursed')${s.sql}`, ...s.args)).v;
    const paid = (await get("SELECT COALESCE(SUM(amount),0) AS v FROM payments WHERE status = 'paid'")).v;
    const todoStatus = user.role === 'field' ? 'submitted' : 'field_verified';
    const todo = await all(`SELECT id, code, full_name, district, course, final_score, need_score FROM applications a
                      WHERE status = ?${s.sql} ORDER BY final_score DESC LIMIT 6`, todoStatus, ...s.args);
    const todoCount = (await get(`SELECT COUNT(*) AS n FROM applications a WHERE status = ?${s.sql}`, todoStatus, ...s.args)).n;
    const payWaiting = user.role === 'field' ? [] : await all(`SELECT p.id, p.payee, p.amount, p.kind, a.full_name FROM payments p
        LEFT JOIN applications a ON a.id = p.application_id WHERE p.status = ? ORDER BY p.id DESC LIMIT 5`, user.role === 'admin' ? 'approved' : 'requested');
    const atRisk = await all(`SELECT r.marks, r.attendance, a.full_name, a.id AS app_id FROM renewals r JOIN applications a ON a.id = r.application_id
                        WHERE r.status = 'at_risk'${s.sql} ORDER BY r.id DESC LIMIT 5`, ...s.args);
    const activity = await all(`SELECT r.action, r.created_at, u.name AS actor, a.full_name, a.id AS app_id FROM reviews r
                          JOIN users u ON u.id = r.actor_id JOIN applications a ON a.id = r.application_id
                          WHERE 1=1${s.sql} ORDER BY r.id DESC LIMIT 8`, ...s.args);
    const infraStatus = user.role === 'field' ? 'submitted' : 'verified';
    const infraScope = user.role === 'field' ? { sql: ' AND s.district = ?', args: [user.district] } : { sql: '', args: [] };
    const infraTodo = await all(`SELECT r.id, r.code, r.title, r.priority, r.estimate, s.name AS school, s.district FROM infra_requests r
                       JOIN schools s ON s.id = r.school_id WHERE r.status = ?${infraScope.sql} ORDER BY r.priority DESC LIMIT 5`, infraStatus, ...infraScope.args);
    const infraCount = (await get(`SELECT COUNT(*) AS n FROM infra_requests r JOIN schools s ON s.id = r.school_id WHERE r.status = ?${infraScope.sql}`,
      infraStatus, ...infraScope.args)).n;
    return { byStatus, byDistrict, sanctioned, paid, todo, todoStatus, todoCount, payWaiting, atRisk, activity, infraTodo, infraCount, infraStatus,
      total: Object.values(byStatus).reduce((x, y) => x + y, 0) };
  }));

  r.get('/api/staff/applications', guard(STAFF, async ({ user, query }) => {
    const s = scope(user);
    let sql = s.sql; const args = [...s.args];
    const status = query.get('status'), district = query.get('district'), q = (query.get('q') || '').trim();
    if (status && STATUSES[status]) { sql += ' AND a.status = ?'; args.push(status); }
    if (district) { sql += ' AND a.district = ?'; args.push(district); }
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      sql += ' AND (a.full_name ILIKE ? OR a.code ILIKE ? OR a.institution ILIKE ?)'; args.push(like, like, like);
    }
    const order = { need: 'a.need_score DESC', newest: 'a.id DESC' }[query.get('sort')] || 'a.final_score DESC';
    const rows = await all(`SELECT a.id, a.code, a.full_name, a.course, a.institution, a.district, a.need_score, a.merit_score, a.final_score,
                      a.amount_requested, a.status, a.created_at, u.name AS mobilizer
                      FROM applications a LEFT JOIN users u ON u.id = a.mobilizer_id WHERE 1=1${sql} ORDER BY ${order}`, ...args);
    const districts = (await all(`SELECT DISTINCT district FROM applications a WHERE 1=1${s.sql} ORDER BY district`, ...s.args)).map((d) => d.district);
    return { rows, districts };
  }));

  // Field staff (or managers) register a student who has no smartphone.
  r.post('/api/staff/applications', guard(STAFF, async (ctx) => {
    const body = await ctx.json();
    const { data, errors } = validateApplication(body);
    const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Student's mobile must be 10 digits starting with 6–9.";
    const student = await get('SELECT * FROM users WHERE phone = ?', phone);
    if (student && student.role !== 'student') errors.phone = `This number belongs to a ${student.role === 'school' ? 'school' : 'staff'} account.`;
    else if (student && await get('SELECT 1 AS x FROM applications WHERE student_id = ?', student.id)) errors.phone = 'This student has already applied.';
    if (Object.keys(errors).length) fail(422, 'Some answers need fixing.', errors);
    ctx.status = 201;
    return tx(async () => {
      const sid = student ? student.id : await insert("INSERT INTO users (phone, role) VALUES (?, 'student')", phone);
      return createApplication(data, sid, ctx.user.id, ctx.user.id);
    });
  }));

  r.get('/api/staff/applications/:id', guard(STAFF, async ({ user, params }) => {
    const a = await loadApp(user, params.id);
    const { rows, missing, extra } = await checklist(a);
    return {
      application: publicApp(a),
      student: await get('SELECT id, name, phone FROM users WHERE id = ?', a.student_id),
      mobilizer: a.mobilizer_id ? await get('SELECT id, name FROM users WHERE id = ?', a.mobilizer_id) : null,
      checklist: rows.map(({ doc, ...d }) => ({ ...d, doc })),
      missing: missing.map((m) => m.label),
      extraDocs: extra,
      breakdown: breakdown(parseAnswers(a)),
      reviews: await all(`SELECT r.*, u.name AS actor_name, u.role AS actor_role FROM reviews r JOIN users u ON u.id = r.actor_id
                    WHERE application_id = ? ORDER BY r.id DESC`, a.id),
      payments: await all('SELECT * FROM payments WHERE application_id = ? ORDER BY id DESC', a.id),
      renewals: await all('SELECT * FROM renewals WHERE application_id = ? ORDER BY id DESC', a.id),
      schemes: matchSchemes(a),
    };
  }));

  r.post('/api/staff/applications/:id/decision', guard(STAFF, async (ctx) => {
    const a = await loadApp(ctx.user, ctx.params.id);
    const { action, comment: rawComment, amount: rawAmount } = await ctx.json();
    const comment = String(rawComment || '').trim().slice(0, 1000);
    const isManager = MANAGERS.includes(ctx.user.role);
    let next, amount = null;
    if (a.status === 'submitted' && action === 'forward') {
      const { missing } = await checklist(a);
      if (missing.length) fail(422, `Upload these first: ${missing.map((m) => m.label).join(', ')}.`);
      next = 'field_verified';
    } else if (a.status === 'field_verified' && action === 'approve' && isManager) {
      amount = Math.round(Number(rawAmount));
      if (!(amount >= 500 && amount <= 2000000)) fail(422, 'Enter the sanctioned amount (at least ₹500).', { amount: 'Required' });
      next = 'approved';
    } else if (a.status === 'field_verified' && action === 'send_back' && isManager) {
      if (!comment) fail(422, 'Add a comment so the field executive knows what to fix.', { comment: 'Required' });
      next = 'submitted';
    } else if (['submitted', 'field_verified'].includes(a.status) && action === 'reject') {
      if (!comment) fail(422, 'Add a reason. The student will see it.', { comment: 'Required' });
      next = 'rejected';
    } else {
      fail(403, "You can't take that action at this stage.");
    }
    const label = { forward: 'forwarded', approve: 'approved', send_back: 'sent_back', reject: 'rejected' }[action];
    await tx(async () => {
      // Only moves on if nobody else changed the status since we read it.
      const moved = await run('UPDATE applications SET status = ?, amount_sanctioned = COALESCE(?, amount_sanctioned), updated_at = now() WHERE id = ? AND status = ?',
        next, amount, a.id, a.status);
      if (!moved.rowCount) fail(409, 'Someone else just updated this application. Reload to see the latest.');
      await run('INSERT INTO reviews (application_id, actor_id, action, comment, amount) VALUES (?,?,?,?,?)', a.id, ctx.user.id, label, comment || null, amount);
    });
    await audit(ctx.user.id, label, 'application', a.id, { comment, amount });
    return { status: next };
  }));

  r.patch('/api/staff/applications/:id/visit', guard(STAFF, async (ctx) => {
    const a = await loadApp(ctx.user, ctx.params.id);
    const { lat, lng } = await ctx.json();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(422, 'Location is missing.');
    await run('UPDATE applications SET visit_lat = ?, visit_lng = ? WHERE id = ?', lat, lng, a.id);
    return { ok: true };
  }));

  r.post('/api/staff/renewals/:id', guard(MANAGERS, async (ctx) => {
    const { status, note } = await ctx.json();
    if (!['accepted', 'at_risk'].includes(status)) fail(400, 'Unknown status.');
    const rw = await get('SELECT * FROM renewals WHERE id = ?', Number(ctx.params.id));
    if (!rw) fail(404, 'Renewal not found.');
    await run('UPDATE renewals SET status = ?, note = ? WHERE id = ?', status, String(note || '').slice(0, 500), rw.id);
    return { ok: true };
  }));

  // ---------------- payments ----------------
  r.get('/api/staff/payments', guard(STAFF, async ({ user, query }) => {
    const status = query.get('status');
    // Field staff see payments for students in their scope, plus the ones they raised themselves.
    const s = scope(user);
    const mine = user.role === 'field'
      ? { sql: ` AND (p.requested_by = ? OR (a.id IS NOT NULL${s.sql}) OR sc.district = ?)`, args: [user.id, ...s.args, user.district] } : { sql: '', args: [] };
    const joins = `LEFT JOIN applications a ON a.id = p.application_id
                   LEFT JOIN infra_requests ir ON ir.id = p.infra_request_id LEFT JOIN schools sc ON sc.id = ir.school_id`;
    const byStatus = ['requested', 'approved', 'paid', 'rejected'].includes(status) ? ' AND p.status = ?' : '';
    const rows = await all(`SELECT p.*, a.full_name, a.code, ir.code AS infra_code, sc.name AS school_name, u.name AS requester, v.name AS approver FROM payments p
                      ${joins} JOIN users u ON u.id = p.requested_by
                      LEFT JOIN users v ON v.id = p.approved_by WHERE 1=1${mine.sql}${byStatus} ORDER BY p.id DESC`, ...mine.args, ...(byStatus ? [status] : []));
    const totals = Object.fromEntries((await all(`SELECT p.status, COUNT(*) AS n, SUM(p.amount) AS amt FROM payments p
                      ${joins} WHERE 1=1${mine.sql} GROUP BY p.status`, ...mine.args)).map((t) => [t.status, t]));
    const students = await all(`SELECT a.id, a.code, a.full_name, a.institution, a.amount_sanctioned,
        COALESCE((SELECT SUM(amount) FROM payments WHERE application_id = a.id AND kind = 'scholarship' AND status != 'rejected'), 0) AS used
        FROM applications a WHERE status IN ('approved','disbursed')${s.sql} ORDER BY full_name`, ...s.args);
    const infra = await all(`SELECT r.id, r.code, r.title, r.amount_sanctioned, s.name AS school,
        COALESCE((SELECT SUM(amount) FROM payments WHERE infra_request_id = r.id AND status != 'rejected'), 0) AS used
        FROM infra_requests r JOIN schools s ON s.id = r.school_id
        WHERE r.status IN ('approved','ordered')${user.role === 'field' ? ' AND s.district = ?' : ''} ORDER BY r.id DESC`, ...(user.role === 'field' ? [user.district] : []));
    return { rows, totals, students, infra };
  }));

  r.post('/api/staff/payments', guard(STAFF, async (ctx) => {
    const b = await ctx.json();
    const kind = b.kind, payee = String(b.payee || '').trim().slice(0, 200), amount = Math.round(Number(b.amount));
    const errors = {};
    if (!['scholarship', 'vendor', 'training', 'infrastructure'].includes(kind)) errors.kind = 'Choose the payment type.';
    const infraId = kind === 'infrastructure' ? Number(b.infra_request_id) : null;
    if (kind === 'infrastructure' && !Number.isInteger(infraId)) errors.infra_request_id = 'Choose the approved school request.';
    if (!payee) errors.payee = 'Required.';
    if (!(amount > 0)) errors.amount = 'Enter an amount.';
    const appId = b.application_id ? Number(b.application_id) : null;
    if (appId !== null && !Number.isInteger(appId)) errors.application_id = 'Choose a student.';
    if (Object.keys(errors).length) fail(422, 'Check the payment details.', errors);
    const id = await tx(async () => {
      if (kind === 'scholarship') {
        // Lock the student's row so two requests at once can't go over the sanctioned amount together.
        const a = appId && await get('SELECT * FROM applications WHERE id = ? FOR UPDATE', appId);
        if (!a || !['approved', 'disbursed'].includes(a.status)) fail(422, 'Check the payment details.', { application_id: 'Choose an approved student.' });
        const used = (await get("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE application_id = ? AND kind='scholarship' AND status != 'rejected'", a.id)).s;
        if (used + amount > (a.amount_sanctioned || 0)) {
          fail(422, 'Check the payment details.', { amount: `Only ₹${((a.amount_sanctioned || 0) - used).toLocaleString('en-IN')} of the sanctioned amount is left.` });
        }
      }
      if (kind === 'infrastructure') {
        // Same guard as scholarships: vendor payments for a school request can't exceed what was sanctioned.
        const ir = await get('SELECT r.*, s.district FROM infra_requests r JOIN schools s ON s.id = r.school_id WHERE r.id = ? FOR UPDATE OF r', infraId);
        if (!ir || !['approved', 'ordered'].includes(ir.status)) fail(422, 'Check the payment details.', { infra_request_id: 'Choose an approved school request.' });
        if (ctx.user.role === 'field' && ir.district !== ctx.user.district) fail(422, 'Check the payment details.', { infra_request_id: 'This school is outside your district.' });
        const used = (await get("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE infra_request_id = ? AND status != 'rejected'", ir.id)).s;
        if (used + amount > (ir.amount_sanctioned || 0)) {
          fail(422, 'Check the payment details.', { amount: `Only ₹${((ir.amount_sanctioned || 0) - used).toLocaleString('en-IN')} of the sanctioned amount is left.` });
        }
      }
      return insert('INSERT INTO payments (application_id, infra_request_id, kind, payee, payee_account, amount, purpose, requested_by) VALUES (?,?,?,?,?,?,?,?)',
        kind === 'infrastructure' ? null : appId, infraId, kind, payee, String(b.payee_account || '').slice(0, 100), amount, String(b.purpose || '').slice(0, 300), ctx.user.id);
    });
    await audit(ctx.user.id, 'request', 'payment', id, { amount });
    ctx.status = 201;
    return { id };
  }));

  r.post('/api/staff/payments/:id/:action', guard(STAFF, async (ctx) => {
    const p = await get('SELECT * FROM payments WHERE id = ?', Number(ctx.params.id));
    if (!p) fail(404, 'Payment not found.');
    const { action } = ctx.params;
    const role = ctx.user.role;
    const stale = () => fail(409, 'Someone else just updated this payment. Reload to see the latest.');
    if (action === 'approve' && p.status === 'requested' && MANAGERS.includes(role)) {
      if (p.requested_by === ctx.user.id) fail(403, 'Someone other than the requester must approve a payment.');
      if (!(await run("UPDATE payments SET status='approved', approved_by=? WHERE id=? AND status='requested'", ctx.user.id, p.id)).rowCount) stale();
    } else if (action === 'reject' && ['requested', 'approved'].includes(p.status) && MANAGERS.includes(role)) {
      if (!(await run("UPDATE payments SET status='rejected', approved_by=? WHERE id=? AND status=?", ctx.user.id, p.id, p.status)).rowCount) stale();
    } else if (action === 'paid' && p.status === 'approved' && role === 'admin') {
      const { utr } = await ctx.json();
      const ref = String(utr || '').trim().slice(0, 40);
      if (!ref) fail(422, 'Enter the bank UTR / reference number.', { utr: 'Required' });
      await tx(async () => {
        if (!(await run("UPDATE payments SET status='paid', utr=?, paid_at=now() WHERE id=? AND status='approved'", ref, p.id)).rowCount) stale();
        if (p.kind === 'scholarship' && p.application_id) {
          await run("UPDATE applications SET status='disbursed', updated_at=now() WHERE id=? AND status='approved'", p.application_id);
        }
        // First vendor payment released for a school request: the order is placed.
        if (p.kind === 'infrastructure' && p.infra_request_id
          && (await run("UPDATE infra_requests SET status='ordered', updated_at=now() WHERE id=? AND status='approved'", p.infra_request_id)).rowCount) {
          await run("INSERT INTO infra_events (request_id, actor_id, action, comment, amount) VALUES (?,?,'ordered',?,?)",
            p.infra_request_id, ctx.user.id, `Paid ${p.payee}, UTR ${ref}`, p.amount);
        }
      });
    } else {
      fail(403, "You can't do that with this payment.");
    }
    await audit(ctx.user.id, action, 'payment', p.id);
    return get('SELECT status FROM payments WHERE id = ?', p.id);
  }));

  // ---------------- training ----------------
  r.get('/api/staff/trainings', guard(STAFF, async () => ({
    sessions: await all(`SELECT t.*, COUNT(a.application_id) AS invited, COALESCE(SUM(a.present),0) AS present
                   FROM trainings t LEFT JOIN attendance a ON a.training_id = t.id GROUP BY t.id ORDER BY held_on DESC`),
    students: await all("SELECT id, full_name, district, course FROM applications WHERE status IN ('approved','disbursed') ORDER BY district, full_name"),
  })));

  r.post('/api/staff/trainings', guard(MANAGERS, async (ctx) => {
    const b = await ctx.json();
    const students = (Array.isArray(b.students) ? b.students : []).map(Number).filter(Number.isInteger);
    const errors = {};
    for (const [k, label] of [['title', 'Title'], ['venue', 'Venue'], ['held_on', 'Date']]) if (!String(b[k] || '').trim()) errors[k] = `${label} is required.`;
    if (b.held_on && !/^\d{4}-\d{2}-\d{2}$/.test(b.held_on)) errors.held_on = 'Enter a valid date.';
    if (!students.length) errors.students = 'Choose at least one student.';
    if (Object.keys(errors).length) fail(422, 'Check the session details.', errors);
    const id = await tx(async () => {
      const tid = await insert('INSERT INTO trainings (title, kind, venue, location, held_on, budget, trainer, created_by) VALUES (?,?,?,?,?,?,?,?)',
        String(b.title).slice(0, 200), b.kind === 'orientation' ? 'orientation' : 'skill', String(b.venue).slice(0, 200),
        String(b.location || '').slice(0, 100), b.held_on, Math.max(0, Math.round(Number(b.budget)) || 0), String(b.trainer || '').slice(0, 100), ctx.user.id);
      await run(`INSERT INTO attendance (training_id, application_id, present)
                 SELECT ?, id, 0 FROM applications WHERE id = ANY(?::int[]) ON CONFLICT DO NOTHING`, tid, students);
      return tid;
    });
    ctx.status = 201;
    return { id };
  }));

  r.get('/api/staff/trainings/:id', guard(STAFF, async ({ params }) => {
    const t = await get('SELECT * FROM trainings WHERE id = ?', Number(params.id));
    if (!t) fail(404, 'Session not found.');
    const roster = await all(`SELECT a.present, ap.id, ap.full_name, ap.district, ap.course, ap.institution FROM attendance a
                        JOIN applications ap ON ap.id = a.application_id WHERE a.training_id = ? ORDER BY ap.full_name`, t.id);
    return { training: t, roster };
  }));

  r.put('/api/staff/trainings/:id/attendance', guard(STAFF, async (ctx) => {
    const { present } = await ctx.json();
    const ids = [...new Set((Array.isArray(present) ? present : []).map(Number).filter(Number.isInteger))];
    await run('UPDATE attendance SET present = CASE WHEN application_id = ANY(?::int[]) THEN 1 ELSE 0 END WHERE training_id = ?', ids, Number(ctx.params.id));
    return { present: ids.length };
  }));

  // ---------------- team (admin) ----------------
  r.get('/api/staff/team', guard(['admin'], async () => ({
    rows: await all(`SELECT u.id, u.name, u.phone, u.role, u.district, u.active, u.created_at,
                       (SELECT COUNT(*) FROM reviews r WHERE r.actor_id = u.id) AS actions
                     FROM users u WHERE u.role IN ('field','manager','admin') ORDER BY u.active DESC, u.role, u.name`),
  })));

  // Add a staff member, or update the one who already has this phone number (same rules as server/add-staff.js).
  r.post('/api/staff/team', guard(['admin'], async (ctx) => {
    const b = await ctx.json();
    const phone = String(b.phone || '').replace(/\D/g, '').slice(-10);
    const name = String(b.name || '').trim().slice(0, 100);
    const district = String(b.district || '').trim().slice(0, 100);
    const errors = {};
    if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = '10 digits, starting with 6, 7, 8 or 9.';
    if (!name) errors.name = 'Enter the full name.';
    if (!STAFF.includes(b.role)) errors.role = 'Choose a role.';
    if (b.role === 'field' && !district) errors.district = 'Field executives need a district: they only see applications from it.';
    const existing = phone && await get('SELECT id, role FROM users WHERE phone = ?', phone);
    if (existing?.role === 'student' && await get('SELECT 1 AS x FROM applications WHERE student_id = ?', existing.id)) {
      errors.phone = 'This number belongs to a student who has applied. Use a different number.';
    }
    if (existing?.role === 'school') errors.phone = 'This number belongs to a school account. Use a different number.';
    if (existing?.id === ctx.user.id && b.role !== 'admin') errors.role = "You can't remove your own admin role.";
    if (Object.keys(errors).length) fail(422, 'Check the staff details.', errors);
    await run(`INSERT INTO users (phone, name, role, district, active) VALUES (?,?,?,?,true)
               ON CONFLICT (phone) DO UPDATE SET name = excluded.name, role = excluded.role, district = excluded.district, active = true`,
      phone, name, b.role, district || null);
    const user = await get('SELECT id FROM users WHERE phone = ?', phone);
    await audit(ctx.user.id, existing ? 'update_staff' : 'add_staff', 'user', user.id, { role: b.role, district: district || null });
    ctx.status = existing ? 200 : 201;
    return { id: user.id, created: !existing };
  }));

  r.post('/api/staff/team/:id/active', guard(['admin'], async (ctx) => {
    const { active } = await ctx.json();
    const u = await get("SELECT id, role FROM users WHERE id = ? AND role IN ('field','manager','admin')", Number(ctx.params.id));
    if (!u) fail(404, 'Staff member not found.');
    if (u.id === ctx.user.id) fail(422, "You can't deactivate your own account.");
    await run('UPDATE users SET active = ? WHERE id = ?', !!active, u.id);
    await audit(ctx.user.id, active ? 'activate_staff' : 'deactivate_staff', 'user', u.id);
    return { ok: true };
  }));

  // ---------------- opportunities ----------------
  r.get('/api/staff/opportunities', guard(STAFF, async () => ({ rows: await all('SELECT * FROM opportunities ORDER BY deadline') })));

  r.post('/api/staff/opportunities', guard(STAFF, async (ctx) => {
    const b = await ctx.json();
    const errors = {};
    if (!String(b.company || '').trim()) errors.company = 'Required.';
    if (!String(b.title || '').trim()) errors.title = 'Required.';
    if (b.link && !/^https?:\/\//.test(b.link)) errors.link = 'Start the link with https://';
    if (b.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(b.deadline)) errors.deadline = 'Enter a valid date.';
    if (Object.keys(errors).length) fail(422, 'Check the opening details.', errors);
    const id = await insert('INSERT INTO opportunities (company, title, kind, location, for_levels, stipend, deadline, link) VALUES (?,?,?,?,?,?,?,?)',
      String(b.company).slice(0, 120), String(b.title).slice(0, 160), ['internship', 'job', 'course'].includes(b.kind) ? b.kind : 'internship',
      String(b.location || '').slice(0, 120), (Array.isArray(b.for_levels) ? b.for_levels : []).join(','), String(b.stipend || '').slice(0, 60),
      b.deadline || null, b.link || null);
    ctx.status = 201;
    return { id };
  }));
}
