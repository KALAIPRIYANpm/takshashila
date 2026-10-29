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

export function validateSchool(input) {
  const errors = {};
  const d = {};
  const req = (k, label, max) => { d[k] = str(input[k], max); if (!d[k]) errors[k] = `${label} is required.`; };
  req('name', 'School name', 200);
  req('headmaster', "Headmaster's name", 100);
  req('district', 'District', 100);
  req('state', 'State', 100);
  d.udise_code = String(input.udise_code || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(d.udise_code)) errors.udise_code = 'UDISE code is 11 digits. Find it on the UDISE+ portal or your school certificate.';
  d.school_type = SCHOOL_TYPES.includes(input.school_type) ? input.school_type : (errors.school_type = 'Choose the school type.', '');
  d.level = SCHOOL_LEVELS.includes(input.level) ? input.level : (errors.level = 'Choose the classes taught.', '');
  for (const k of ['medium', 'contact_role', 'address', 'village']) d[k] = str(input[k], 300);
  d.email = str(input.email, 120);
  if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) errors.email = 'Check the email address.';
  d.pin = String(input.pin || '').replace(/\D/g, '');
  if (d.pin && !/^\d{6}$/.test(d.pin)) errors.pin = 'PIN code is 6 digits.';
  const count = (k, label, lo, hi, optional) => {
    const v = int(input[k]);
    if (optional && Number.isNaN(v)) return null;
    if (Number.isNaN(v) || v < lo || v > hi) { errors[k] = `${label}: enter a number from ${lo} to ${hi}.`; return 0; }
    return v;
  };
  d.students = count('students', 'Students enrolled', 1, 10000);
  d.teachers = count('teachers', 'Teachers', 1, 500);
  d.girls = count('girls', 'Girls enrolled', 0, 10000, true);
  d.classrooms = count('classrooms', 'Classrooms', 0, 300, true);
  if (d.girls !== null && d.students && d.girls > d.students) errors.girls = 'Cannot be more than total students.';
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
