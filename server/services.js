// Application rules shared by the student and staff routes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { DOCUMENTS, SUPPORT_TYPES, LEVELS, GENDERS } from './constants.js';
import { all, get, insert, run, tx, audit } from './db.js';
import { QUESTIONS, needScore, meritScore, finalScore } from './scoring.js';
import { hashAadhaar } from './lib/auth.js';
import { fail, writeBody } from './lib/http.js';

const DOC_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.3gp', '.mkv'];
const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.3gp': 'video/3gpp', '.mkv': 'video/x-matroska', '.svg': 'image/svg+xml' };

export const parseAnswers = (a) => (typeof a.answers === 'string' ? JSON.parse(a.answers) : a.answers);

export function requiredDocs(answers) {
  return DOCUMENTS.filter((d) => !d.when || d.when[1].includes(answers[d.when[0]]));
}

export async function checklist(app) {
  const have = new Map((await all('SELECT id, doc_type, mime, file_name FROM documents WHERE application_id = ?', app.id)).map((d) => [d.doc_type, d]));
  const rows = requiredDocs(parseAnswers(app)).map((d) => ({ ...d, doc: have.get(d.key) || null }));
  const missing = rows.filter((r) => r.required && !r.doc);
  const extra = [...have.values()].filter((d) => !DOCUMENTS.some((x) => x.key === d.doc_type));
  return { rows, missing, extra };
}

/** Stream an upload request body to disk. `docType` must be a known document (or receipt_*). */
export async function saveUpload(appId, docType, fileName, req) {
  const known = DOCUMENTS.find((d) => d.key === docType);
  if (!known && !/^receipt_[\w-]{1,40}$/.test(docType)) fail(400, 'Unknown document type.');
  const safeName = path.basename(String(fileName || 'file')).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const ext = path.extname(safeName).toLowerCase();
  const allowed = known?.video ? VIDEO_EXT : DOC_EXT;
  if (!allowed.includes(ext)) fail(400, `${known?.label || 'File'}: use ${allowed.join(', ')}.`);
  const stored = `${crypto.randomUUID()}${ext}`;
  const file = path.join(config.uploadDir, stored);
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const size = await writeBody(req, file, config.maxUploadBytes);
  if (!size) {
    fs.rmSync(file, { force: true });
    fail(400, 'The file is empty.');
  }
  let replaced;
  try {
    replaced = await tx(async () => {
      const old = await all('DELETE FROM documents WHERE application_id = ? AND doc_type = ? RETURNING stored_name', appId, docType);
      const id = await insert('INSERT INTO documents (application_id, doc_type, file_name, stored_name, mime, size) VALUES (?,?,?,?,?,?)',
        appId, docType, safeName, stored, MIME[ext] || 'application/octet-stream', size);
      return { id, old };
    });
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw e;
  }
  // Remove replaced files only once the database no longer points at them.
  for (const o of replaced.old) fs.rm(path.join(config.uploadDir, o.stored_name), { force: true }, () => {});
  return replaced.id;
}

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export function validateApplication(input) {
  const errors = {};
  const d = {};
  const req = (key, label, max) => {
    d[key] = str(input[key], max);
    if (!d[key]) errors[key] = `${label} is required.`;
  };

  d.aadhaar = String(input.aadhaar || '').replace(/\D/g, '');
  if (!/^[2-9]\d{11}$/.test(d.aadhaar)) errors.aadhaar = 'Aadhaar must be 12 digits and cannot start with 0 or 1.';
  req('full_name', 'Full name');
  req('dob', 'Date of birth');
  req('district', 'District');
  req('state', 'State');
  req('institution', 'School or college name');
  req('course', 'Course');
  req('story', 'Your story', 4000);
  d.gender = GENDERS.includes(input.gender) ? input.gender : (errors.gender = 'Choose a gender.', '');
  d.level = LEVELS.includes(input.level) ? input.level : (errors.level = 'Choose what you are studying.', '');
  for (const k of ['whatsapp', 'email', 'alt_phone', 'alt_phone_owner', 'address', 'village', 'pin', 'languages', 'religion', 'institution_type', 'study_year', 'career_goal', 'other_benefits', 'project']) {
    d[k] = str(input[k], 500);
  }

  const range = (key, label, lo, hi, optional) => {
    const v = num(input[key]);
    if (optional && Number.isNaN(v)) return null;
    if (Number.isNaN(v) || v < lo || v > hi) { errors[key] = `${label} must be between ${lo.toLocaleString('en-IN')} and ${hi.toLocaleString('en-IN')}.`; return 0; }
    return v;
  };
  d.last_percentage = range('last_percentage', 'Last exam marks', 0, 100);
  d.annual_fee = Math.round(range('annual_fee', 'Annual fee', 0, 2000000));
  d.fee_paid = Math.round(range('fee_paid', 'Fee already paid', 0, 2000000, true) || 0);
  d.amount_requested = Math.round(range('amount_requested', 'Amount needed', 500, 2000000));
  d.distance_km = range('distance_km', 'Distance', 0, 500, true);

  d.answers = {};
  for (const q of QUESTIONS) {
    const v = input.answers?.[q.key];
    if (!q.options.some((o) => o.key === v)) errors[`q_${q.key}`] = `Answer: ${q.en}.`;
    else d.answers[q.key] = v;
  }
  const support = Array.isArray(input.support) ? input.support.filter((s) => SUPPORT_TYPES.some((t) => t.key === s)) : [];
  if (!support.length) errors.support = 'Choose at least one type of support.';
  d.support_types = support.join(',');
  if (d.story && d.story.length < 150) errors.story = 'Write at least 150 characters, so the committee understands your situation.';
  if (!input.consent) errors.consent = 'Tick the declaration to confirm the details are true.';
  d.visit_lat = Number.isFinite(Number(input.visit_lat)) && input.visit_lat !== '' && input.visit_lat != null ? Number(input.visit_lat) : null;
  d.visit_lng = Number.isFinite(Number(input.visit_lng)) && input.visit_lng !== '' && input.visit_lng != null ? Number(input.visit_lng) : null;
  return { data: d, errors };
}

export async function createApplication(d, studentId, mobilizerId, actorId) {
  const aHash = hashAadhaar(d.aadhaar);
  const duplicate = () => fail(409, 'An application with this Aadhaar number already exists. Sign in with the phone number used before, or contact your field executive.', { aadhaar: 'Already registered.' });
  if (await get('SELECT 1 AS x FROM applications WHERE aadhaar_hash = ?', aHash)) duplicate();
  const need = needScore(d.answers);
  const merit = meritScore(d.last_percentage);
  const final = finalScore(need, merit);
  return tx(async () => {
    const n = (await get("SELECT nextval('application_code_seq') AS n")).n;
    const code = `TK-${String(new Date().getFullYear()).slice(2)}-${String(n).padStart(5, '0')}`;
    const id = await insert(`INSERT INTO applications (code, student_id, mobilizer_id, project, aadhaar_hash, aadhaar_last4, whatsapp, email,
        full_name, gender, dob, alt_phone, alt_phone_owner, address, village, district, state, pin, languages, religion,
        level, institution, institution_type, course, study_year, last_percentage, annual_fee, fee_paid, distance_km, career_goal,
        answers, need_score, merit_score, final_score, support_types, amount_requested, story, other_benefits, visit_lat, visit_lng)
        VALUES (${Array(40).fill('?').join(',')})`,
      code, studentId, mobilizerId, d.project || 'Project Bharat', aHash, d.aadhaar.slice(-4), d.whatsapp, d.email,
      d.full_name, d.gender, d.dob, d.alt_phone, d.alt_phone_owner, d.address, d.village, d.district, d.state, d.pin, d.languages, d.religion,
      d.level, d.institution, d.institution_type, d.course, d.study_year, d.last_percentage, d.annual_fee, d.fee_paid, d.distance_km, d.career_goal,
      JSON.stringify(d.answers), need, merit, final, d.support_types, d.amount_requested, d.story, d.other_benefits, d.visit_lat, d.visit_lng);
    await run('UPDATE users SET name = ?, district = ? WHERE id = ?', d.full_name, d.district, studentId);
    await run("INSERT INTO reviews (application_id, actor_id, action) VALUES (?, ?, 'submitted')", id, actorId);
    await audit(actorId, 'create', 'application', id, { need, final });
    return { id, code, need, merit, final };
  }).catch((e) => {
    // Two submissions racing past the checks above hit the unique constraints instead.
    if (e.constraint === 'applications_aadhaar_hash_key') duplicate();
    if (e.constraint === 'applications_student_id_key') fail(409, 'This student has already applied.');
    throw e;
  });
}

/** Shape an application row for the API (never expose the Aadhaar hash). */
export function publicApp(a) {
  if (!a) return a;
  const { aadhaar_hash, ...rest } = a;
  return { ...rest, answers: parseAnswers(a), support_types: a.support_types ? a.support_types.split(',') : [] };
}
