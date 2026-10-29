// School infrastructure: catalogue, statuses, priority score and validation.  ← change costs and weights here

export const INFRA_STATUSES = {
  submitted: 'Submitted',
  verified: 'Site verified',
  approved: 'Approved',
  ordered: 'Order placed',
  delivered: 'Delivered',
  rejected: 'Not approved',
};
export const INFRA_FLOW = ['submitted', 'verified', 'approved', 'ordered', 'delivered'];

// `weight` = points (out of 30) the category adds to the priority score. Health and safety come first.
export const INFRA_CATEGORIES = {
  sanitation: { label: 'Water and sanitation', weight: 30 },
  safety: { label: 'Safety and accessibility', weight: 28 },
  furniture: { label: 'Furniture', weight: 24 },
  repairs: { label: 'Building repairs', weight: 22 },
  electrical: { label: 'Electrical', weight: 20 },
  learning: { label: 'Learning materials', weight: 15 },
  digital: { label: 'Digital learning', weight: 12 },
  other: { label: 'Other', weight: 10 },
};

// Indicative unit costs in rupees (Karnataka, 2026). Schools can change them to match a local quotation.
export const INFRA_CATALOG = [
  { key: 'dual_desk', name: 'Dual desk-bench (2 students)', category: 'furniture', cost: 4500, unit: 'piece' },
  { key: 'teacher_table', name: 'Teacher table', category: 'furniture', cost: 5500, unit: 'piece' },
  { key: 'teacher_chair', name: 'Teacher chair', category: 'furniture', cost: 2200, unit: 'piece' },
  { key: 'almirah', name: 'Steel almirah', category: 'furniture', cost: 9500, unit: 'piece' },
  { key: 'library_rack', name: 'Library rack', category: 'furniture', cost: 7000, unit: 'piece' },
  { key: 'ceiling_fan', name: 'Ceiling fan, installed', category: 'electrical', cost: 2800, unit: 'piece' },
  { key: 'led_light', name: 'LED tube light, installed', category: 'electrical', cost: 650, unit: 'piece' },
  { key: 'wiring', name: 'Classroom wiring repair', category: 'electrical', cost: 6000, unit: 'classroom' },
  { key: 'inverter', name: 'Inverter with battery', category: 'electrical', cost: 18000, unit: 'set' },
  { key: 'ro_purifier', name: 'RO drinking water purifier', category: 'sanitation', cost: 22000, unit: 'unit' },
  { key: 'water_tank', name: 'Water tank, 1000 litres', category: 'sanitation', cost: 9000, unit: 'tank' },
  { key: 'handwash', name: 'Handwash station (6 taps)', category: 'sanitation', cost: 12000, unit: 'station' },
  { key: 'toilet_repair', name: 'Toilet block repair', category: 'sanitation', cost: 45000, unit: 'block' },
  { key: 'girls_toilet', name: "New girls' toilet block", category: 'sanitation', cost: 150000, unit: 'block' },
  { key: 'pad_vending', name: 'Sanitary pad vending machine and incinerator', category: 'sanitation', cost: 25000, unit: 'set' },
  { key: 'ramp', name: 'Ramp with handrail', category: 'safety', cost: 25000, unit: 'ramp' },
  { key: 'fire_ext', name: 'Fire extinguisher', category: 'safety', cost: 2500, unit: 'piece' },
  { key: 'first_aid', name: 'First-aid kit', category: 'safety', cost: 1500, unit: 'kit' },
  { key: 'compound_wall', name: 'Compound wall repair', category: 'safety', cost: 60000, unit: 'lot' },
  { key: 'roof_repair', name: 'Roof or leak repair', category: 'repairs', cost: 40000, unit: 'classroom' },
  { key: 'painting', name: 'Classroom painting', category: 'repairs', cost: 12000, unit: 'classroom' },
  { key: 'doors_windows', name: 'Doors and windows repair', category: 'repairs', cost: 8000, unit: 'classroom' },
  { key: 'green_board', name: 'Green board', category: 'learning', cost: 6500, unit: 'piece' },
  { key: 'library_set', name: 'Library book set (100 books)', category: 'learning', cost: 8000, unit: 'set' },
  { key: 'science_kit', name: 'Science lab kit', category: 'learning', cost: 15000, unit: 'kit' },
  { key: 'sports_kit', name: 'Sports kit', category: 'learning', cost: 10000, unit: 'kit' },
  { key: 'computer', name: 'Desktop computer', category: 'digital', cost: 38000, unit: 'piece' },
  { key: 'projector', name: 'Projector with screen', category: 'digital', cost: 35000, unit: 'set' },
  { key: 'smart_tv', name: 'Smart TV for classroom', category: 'digital', cost: 32000, unit: 'piece' },
];

export const SCHOOL_TYPES = ['Government', 'Aided', 'Private (low-fee)'];
export const SCHOOL_LEVELS = ['Anganwadi / pre-primary', 'Primary (1–5)', 'Upper primary (1–8)', 'Secondary (1–10)', 'Higher secondary (1–12)'];
export const SCHOOL_MEDIUMS = ['Kannada', 'English', 'Urdu', 'Marathi', 'Hindi', 'Other'];
export const CONTACT_ROLES = ['Headmaster / Principal', 'Teacher', 'SDMC member'];
export const URGENCY = {
  critical: { label: 'Critical: unsafe or classes disrupted now', points: 20 },
  high: { label: 'High: needed this term', points: 12 },
  normal: { label: 'Normal: improvement', points: 5 },
};

/**
 * Priority score out of 100, so the schools in greatest need are seen first:
 *   category of the most important item (30) + school type (25) + urgency (20) + enrolment (15) + pupil-teacher ratio (10).
 * The breakdown is stored with the request so staff can see why it ranks where it does.
 */
export function priorityScore(school, items, urgency) {
  const cat = items.reduce((best, i) => (INFRA_CATEGORIES[i.category].weight > INFRA_CATEGORIES[best].weight ? i.category : best), 'other');
  const typePts = { Government: 25, Aided: 15 }[school.school_type] ?? 5;
  const n = school.students;
  const sizePts = n >= 500 ? 15 : n >= 200 ? 11 : n >= 100 ? 7 : 4;
  const ptr = school.teachers ? n / school.teachers : n;
  const ptrPts = ptr > 40 ? 10 : ptr > 30 ? 6 : 2; // RTE norm is 30 pupils per teacher
  const detail = [
    { label: 'Most important need', note: INFRA_CATEGORIES[cat].label, points: INFRA_CATEGORIES[cat].weight, max: 30 },
    { label: 'School type', note: school.school_type, points: typePts, max: 25 },
    { label: 'Urgency', note: URGENCY[urgency].label.split(':')[0], points: URGENCY[urgency].points, max: 20 },
    { label: 'Enrolment', note: `${n} students`, points: sizePts, max: 15 },
    { label: 'Pupils per teacher', note: `${Math.round(ptr)} (norm is 30)`, points: ptrPts, max: 10 },
  ];
  return { score: detail.reduce((s, d) => s + d.points, 0), detail };
}

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v) => (v === '' || v === null || v === undefined ? NaN : Math.round(Number(v)));

export const BOARDS = ['State board', 'CBSE', 'ICSE', 'Other'];
export const SHIFTS = ['Single shift', 'Two shifts'];
export const AREA_TYPES = ['Rural', 'Urban'];
export const AREA_TAGS = ['Tribal area', 'Hilly / remote', 'Flood-prone', 'Drought-prone', 'Border area', 'Urban slum'];
// What a field executive or manager confirms before marking a school verified. All are required.
export const VERIFICATION_CHECKS = [
  { key: 'visited', label: 'I visited the school in person' },
  { key: 'udise', label: 'The UDISE code is on the UDISE+ portal and matches this school' },
  { key: 'headmaster', label: 'I met the headmaster (or an SDMC member) named in the profile' },
  { key: 'enrolment', label: 'Enrolment and teacher numbers roughly match the school register' },
  { key: 'facilities', label: 'The facilities checklist matches what I saw' },
];

export const PHOTO_KINDS = {
  front: 'Front of the school',
  classroom: 'Classroom',
  toilet: 'Toilets',
  water: 'Drinking water',
  kitchen: 'Kitchen / midday meal',
  playground: 'Playground',
  other: 'Other',
};

// The facilities checklist, modelled on the UDISE+ school census. `count` = a number, `yesno` = Yes/No, `choice` = one of `options`.
export const FACILITIES = [
  { key: 'building', label: 'School building', type: 'choice', required: true, options: ['Pucca', 'Partially pucca', 'Kutcha', 'Rented', 'No building'] },
  { key: 'classrooms_repair', label: 'Classrooms needing major repair', type: 'count', required: true },
  { key: 'electricity', label: 'Electricity', type: 'choice', required: true, options: ['Yes, working', 'Yes, not working', 'No connection'] },
  { key: 'drinking_water', label: 'Drinking water source', type: 'choice', required: true, options: ['Tap water', 'Borewell / hand pump', 'Well', 'Tanker / packaged', 'None'] },
  { key: 'toilets_boys', label: "Working boys' toilets", type: 'count', required: true },
  { key: 'toilets_girls', label: "Working girls' toilets", type: 'count', required: true },
  { key: 'toilet_cwsn', label: 'Toilet usable by children with disabilities', type: 'yesno', required: true },
  { key: 'handwash', label: 'Handwash facility', type: 'yesno', required: true },
  { key: 'boundary_wall', label: 'Boundary wall', type: 'choice', required: true, options: ['Pucca', 'Partial / broken', 'Fencing only', 'None'] },
  { key: 'ramp', label: 'Ramp for wheelchairs', type: 'yesno', required: true },
  { key: 'kitchen', label: 'Midday meal kitchen shed', type: 'yesno', required: true },
  { key: 'library', label: 'Library or book corner', type: 'yesno', required: false },
  { key: 'playground', label: 'Playground', type: 'yesno', required: false },
  { key: 'computers', label: 'Working computers', type: 'count', required: false },
  { key: 'internet', label: 'Internet connection', type: 'yesno', required: false },
];

/** Serious gaps in a school's basic facilities, worded for staff. Used to flag requests and the schools list. */
export function facilityGaps(s) {
  const f = s.facilities || {};
  const gaps = [];
  if (['Kutcha', 'No building'].includes(f.building)) gaps.push(f.building === 'Kutcha' ? 'Kutcha building' : 'No school building');
  if (f.electricity && f.electricity !== 'Yes, working') gaps.push(f.electricity === 'No connection' ? 'No electricity connection' : 'Electricity not working');
  if (f.drinking_water === 'None') gaps.push('No drinking water');
  if (s.girls > 0 && f.toilets_girls === 0) gaps.push(`No working girls' toilet for ${s.girls} girls`);
  if (s.boys > 0 && f.toilets_boys === 0) gaps.push(`No working boys' toilet for ${s.boys} boys`);
  if (f.handwash === 'No') gaps.push('No handwash facility');
  if (f.boundary_wall === 'None') gaps.push('No boundary wall');
  if (s.cwsn > 0 && f.ramp === 'No') gaps.push(`No ramp, ${s.cwsn} children with disabilities`);
  if (f.classrooms_repair > 0 && s.classrooms) gaps.push(`${f.classrooms_repair} of ${s.classrooms} classrooms need major repair`);
  if (s.students && s.teachers && s.students / s.teachers > 40) gaps.push(`${Math.round(s.students / s.teachers)} pupils per teacher`);
  return gaps;
}

/** How complete a school's profile is. Requests can be made once everything `required` is done. */
export function profileStatus(s, photos = []) {
  if (!s) return { percent: 0, ready: false, missing: ['School profile'] };
  const f = s.facilities || {};
  const kinds = new Set(photos.map((p) => p.kind));
  const items = [
    ['Students by gender', s.boys != null && s.girls != null, true],
    ['Teachers by gender', s.male_teachers != null && s.female_teachers != null, true],
    ['Classrooms', s.classrooms != null, true],
    ['Taluk and rural / urban', !!(s.taluk && s.area_type), true],
    ['Facilities checklist', FACILITIES.filter((x) => x.required).every((x) => f[x.key] !== undefined && f[x.key] !== null && f[x.key] !== ''), true],
    ['Photo of the front of the school', kinds.has('front'), true],
    ['School location (geo-tag)', s.latitude != null && s.longitude != null, false],
    ['Classroom photo', kinds.has('classroom'), false],
    ['Toilet photo', kinds.has('toilet'), false],
  ];
  const done = items.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / items.length) * 100),
    ready: items.every(([, ok, required]) => ok || !required),
    missing: items.filter(([, ok, required]) => !ok && required).map(([label]) => label),
    suggested: items.filter(([, ok, required]) => !ok && !required).map(([label]) => label),
  };
}

export function validateSchool(input) {
  const errors = {};
  const d = {};
  const req = (k, label, max) => { d[k] = str(input[k], max); if (!d[k]) errors[k] = `${label} is required.`; };
  const pick = (k, list, msg, optional) => {
    if (list.includes(input[k])) return input[k];
    if (!(optional && !input[k])) errors[k] = msg;
    return null;
  };
  req('name', 'School name', 200);
  req('headmaster', "Headmaster's name", 100);
  req('district', 'District', 100);
  req('state', 'State', 100);
  req('taluk', 'Taluk / block', 100);
  d.udise_code = String(input.udise_code || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(d.udise_code)) errors.udise_code = 'UDISE code is 11 digits. Find it on the UDISE+ portal or your school certificate.';
  d.school_type = pick('school_type', SCHOOL_TYPES, 'Choose the school type.');
  d.level = pick('level', SCHOOL_LEVELS, 'Choose the classes taught.');
  d.area_type = pick('area_type', AREA_TYPES, 'Choose rural or urban.');
  d.board = pick('board', BOARDS, 'Choose the board.', true);
  d.shifts = pick('shifts', SHIFTS, 'Choose the shifts.', true);
  for (const k of ['medium', 'contact_role', 'address', 'village', 'gram_panchayat']) d[k] = str(input[k], 300);
  d.email = str(input.email, 120);
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) errors.email = 'Check the email address.';
  d.pin = String(input.pin || '').replace(/\D/g, '');
  if (d.pin && !/^\d{6}$/.test(d.pin)) errors.pin = 'PIN code is 6 digits.';
  d.headmaster_phone = String(input.headmaster_phone || '').replace(/\D/g, '').slice(-10);
  if (d.headmaster_phone && !/^[6-9]\d{9}$/.test(d.headmaster_phone)) errors.headmaster_phone = '10 digits, starting with 6, 7, 8 or 9.';
  const tags = Array.isArray(input.area_tags) ? input.area_tags : String(input.area_tags || '').split(',');
  d.area_tags = tags.filter((t) => AREA_TAGS.includes(t)).join(',');

  const count = (k, label, lo, hi, optional) => {
    const v = int(input[k]);
    if (optional && Number.isNaN(v)) return null;
    if (Number.isNaN(v) || v < lo || v > hi) { errors[k] = `${label}: enter a number from ${lo} to ${hi}.`; return 0; }
    return v;
  };
  d.boys = count('boys', 'Boys enrolled', 0, 10000);
  d.girls = count('girls', 'Girls enrolled', 0, 10000);
  d.students = d.boys + d.girls;
  if (!errors.boys && !errors.girls && d.students < 1) errors.boys = 'Enter how many boys and girls are enrolled.';
  d.cwsn = count('cwsn', 'Children with special needs', 0, 10000, true);
  if (d.cwsn && d.cwsn > d.students) errors.cwsn = 'Cannot be more than total students.';
  d.male_teachers = count('male_teachers', 'Male teachers', 0, 500);
  d.female_teachers = count('female_teachers', 'Female teachers', 0, 500);
  d.teachers = d.male_teachers + d.female_teachers;
  if (!errors.male_teachers && !errors.female_teachers && d.teachers < 1) errors.male_teachers = 'Enter at least one teacher.';
  d.non_teaching = count('non_teaching', 'Non-teaching staff', 0, 200, true);
  d.classrooms = count('classrooms', 'Classrooms', 0, 300);
  const year = new Date().getFullYear();
  d.established = count('established', 'Year established', 1800, year, true);

  // Geo-tag: optional, but if given it must be a real point in India.
  const lat = input.latitude === '' || input.latitude == null ? null : Number(input.latitude);
  const lng = input.longitude === '' || input.longitude == null ? null : Number(input.longitude);
  if ((lat === null) !== (lng === null)) errors.latitude = 'Give both latitude and longitude, or capture the location.';
  else if (lat !== null && !(lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5)) errors.latitude = 'This location is outside India. Capture it again at the school.';
  d.latitude = lat; d.longitude = lng;
  const acc = Number(input.location_accuracy);
  d.location_accuracy = lat !== null && Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null;

  d.facilities = {};
  const fin = input.facilities && typeof input.facilities === 'object' ? input.facilities : {};
  for (const q of FACILITIES) {
    const v = fin[q.key];
    const empty = v === undefined || v === null || v === '';
    if (empty) { if (q.required) errors[`f_${q.key}`] = 'Answer this.'; continue; }
    if (q.type === 'count') {
      const n = int(v);
      if (Number.isNaN(n) || n < 0 || n > 500) errors[`f_${q.key}`] = 'Enter a number.';
      else d.facilities[q.key] = n;
    } else {
      const options = q.type === 'yesno' ? ['Yes', 'No'] : q.options;
      if (options.includes(v)) d.facilities[q.key] = v;
      else errors[`f_${q.key}`] = 'Choose one.';
    }
  }
  if (d.facilities.classrooms_repair > d.classrooms) errors.f_classrooms_repair = 'Cannot be more than the number of classrooms.';
  return { data: d, errors };
}

export function validateRequest(input, school) {
  const errors = {};
  const d = {};
  d.title = str(input.title, 120);
  if (!d.title) errors.title = 'Give the request a short title, e.g. "Desks for Class 6 and 7".';
  d.urgency = URGENCY[input.urgency] ? input.urgency : (errors.urgency = 'Choose how urgent this is.', 'normal');
  d.justification = str(input.justification, 3000);
  if (d.justification.length < 80) errors.justification = 'Explain the need in at least 80 characters: what is missing, and how students are affected today.';
  d.beneficiaries = int(input.beneficiaries);
  if (!(d.beneficiaries >= 1 && d.beneficiaries <= school.students)) errors.beneficiaries = `Between 1 and ${school.students} (your enrolment).`;

  const lines = Array.isArray(input.items) ? input.items.slice(0, 30) : [];
  d.items = [];
  lines.forEach((l, i) => {
    const cat = INFRA_CATALOG.find((c) => c.key === l.item_key);
    const name = cat ? cat.name : str(l.name, 120);
    const category = cat ? cat.category : (INFRA_CATEGORIES[l.category] ? l.category : 'other');
    const quantity = int(l.quantity), unit_cost = int(l.unit_cost);
    if (!name) errors[`item_${i}`] = 'Name the item.';
    else if (!(quantity >= 1 && quantity <= 1000)) errors[`item_${i}`] = `${name}: quantity from 1 to 1000.`;
    else if (!(unit_cost >= 0 && unit_cost <= 2000000)) errors[`item_${i}`] = `${name}: enter the cost per ${cat?.unit || 'item'} in rupees.`;
    else d.items.push({ item_key: cat ? cat.key : 'custom', name, category, quantity, unit_cost, note: str(l.note, 200) });
  });
  if (!lines.length) errors.items = 'Add at least one item.';
  d.estimate = d.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  if (d.items.length && !(d.estimate >= 500 && d.estimate <= 5000000)) errors.items = 'The total must be between ₹500 and ₹50,00,000.';
  return { data: d, errors };
}
