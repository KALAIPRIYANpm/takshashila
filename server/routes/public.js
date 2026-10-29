import { config } from '../config.js';
import * as C from '../constants.js';
import { all, get } from '../db.js';
import * as I from '../infrastructure.js';
import { NEED_SHARE, QUESTIONS } from '../scoring.js';

export default function register(r) {
  // For the host's health check: fails if the database is unreachable.
  r.get('/api/health', async () => {
    await get('SELECT 1 AS ok');
    return { ok: true };
  });

  // Everything the front end needs to draw forms. One source of truth: the server.
  r.get('/api/meta', async () => ({
    questions: QUESTIONS,
    needShare: NEED_SHARE,
    statuses: C.STATUSES,
    statusFlow: C.STATUS_FLOW,
    roles: C.ROLES,
    levels: C.LEVELS,
    institutionTypes: C.INSTITUTION_TYPES,
    genders: C.GENDERS,
    phoneOwners: C.PHONE_OWNERS,
    religions: C.RELIGIONS,
    projects: C.PROJECTS,
    districts: C.DISTRICTS,
    states: C.STATES,
    supportTypes: C.SUPPORT_TYPES,
    documents: C.DOCUMENTS,
    videoQuestions: C.VIDEO_QUESTIONS,
    infra: {
      statuses: I.INFRA_STATUSES, flow: I.INFRA_FLOW, categories: I.INFRA_CATEGORIES, catalog: I.INFRA_CATALOG,
      schoolTypes: I.SCHOOL_TYPES, levels: I.SCHOOL_LEVELS, mediums: I.SCHOOL_MEDIUMS, contactRoles: I.CONTACT_ROLES, urgency: I.URGENCY,
      verificationChecks: I.VERIFICATION_CHECKS, facilities: I.FACILITIES, boards: I.BOARDS, shifts: I.SHIFTS, areaTypes: I.AREA_TYPES, areaTags: I.AREA_TAGS, photoKinds: I.PHOTO_KINDS,
    },
    demoMode: config.demoMode,
    // Only in demo/test mode: staff numbers to sign in with, since no SMS is sent. Never exposed in production.
    testAccounts: config.demoMode
      ? await all("SELECT name, phone, role FROM users WHERE role != 'student' AND active ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'field' THEN 2 ELSE 3 END, name LIMIT 12")
      : undefined,
  }));

  r.get('/api/public/stats', async () => {
    const s = await get(`SELECT COUNT(*) AS students, COUNT(DISTINCT district) AS districts
                         FROM applications WHERE status IN ('approved','disbursed')`);
    const paid = (await get("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'paid'")).total;
    const applied = (await get('SELECT COUNT(*) AS n FROM applications')).n;
    // one "lamp" per application for the home page: lit if the student was selected
    const lamps = (await all("SELECT status IN ('approved','disbursed') AS lit FROM applications ORDER BY id")).map((x) => !!x.lit);
    const schools = await get(`SELECT COUNT(DISTINCT school_id) AS n, COALESCE(SUM(beneficiaries) FILTER (WHERE status = 'delivered'), 0) AS reached
                               FROM infra_requests WHERE status IN ('approved','ordered','delivered')`);
    return { ...s, paid, applied, lamps, schools: schools.n, schoolStudents: schools.reached };
  });
}
