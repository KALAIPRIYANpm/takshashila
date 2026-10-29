// Demo data: node server/seed.js  (wipes the database and uploads; refuses in production unless --force; --if-empty seeds only an empty database)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { DOCUMENTS } from './constants.js';
import { get, insert, migrate, pool, reset, run, tx } from './db.js';
import { INFRA_CATALOG, priorityScore } from './infrastructure.js';
import { hashAadhaar } from './lib/auth.js';
import { QUESTIONS, finalScore, meritScore, needScore } from './scoring.js';

let s = 42; // deterministic pseudo-random numbers
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const iso = (d) => d.toISOString();
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

const STAFF = [
  ['Anita Rao', '9000000001', 'admin', 'Bengaluru Urban'],
  ['Ravi Kulkarni', '9000000002', 'manager', 'Belagavi'],
  ['Deepa Patil', '9000000003', 'field', 'Belagavi'],
  ['Imran Sheikh', '9000000004', 'field', 'Dharwad'],
];
const STUDENTS = [
  ['Sayali Bandekar', 'Female', 'Belagavi', 'Undergraduate', 'B.Sc. Nursing', 'KLE Institute of Nursing Sciences', 78, 42000, 'disbursed'],
  ['Jayashri Chikkodi', 'Female', 'Belagavi', 'Diploma / ITI', 'Diploma in Computer Science', 'Govt Polytechnic Belagavi', 71, 18500, 'approved'],
  ['Mahesh Naik', 'Male', 'Belagavi', 'Undergraduate', 'B.E. Civil Engineering', 'Gogte Institute of Technology', 82, 96000, 'field_verified'],
  ['Pooja Hiremath', 'Female', 'Dharwad', 'Class 11–12', 'Class 11 Science', 'Govt PU College Dharwad', 88, 9000, 'disbursed'],
  ['Arjun Kamble', 'Male', 'Kalaburagi', 'Undergraduate', 'B.Com', 'Govt First Grade College Kalaburagi', 64, 14000, 'field_verified'],
  ['Fathima Begum', 'Female', 'Vijayapura', 'Undergraduate', 'B.A. Education', "Karnataka State Akkamahadevi Women's University", 75, 16000, 'approved'],
  ['Santosh Lamani', 'Male', 'Raichur', 'Diploma / ITI', 'ITI Electrician', 'Govt ITI Raichur', 69, 8000, 'submitted'],
  ['Kavya Gowda', 'Female', 'Mysuru', 'Postgraduate', 'M.Sc. Microbiology', 'University of Mysore', 84, 38000, 'submitted'],
  ['Rahul Pujari', 'Male', 'Belagavi', 'Class 8–10', 'Class 10', 'Govt High School Hukkeri', 79, 3000, 'submitted'],
  ['Lakshmi Talawar', 'Female', 'Dharwad', 'Undergraduate', 'B.Sc. Agriculture', 'University of Agricultural Sciences Dharwad', 81, 52000, 'field_verified'],
  ['Ganesh Madar', 'Male', 'Bagalkot', 'Undergraduate', 'B.Pharm', 'HSK College of Pharmacy', 67, 61000, 'rejected'],
  ['Shabana Mulla', 'Female', 'Belagavi', 'Diploma / ITI', 'Diploma in Electronics', 'Govt Polytechnic Belagavi', 73, 18500, 'submitted'],
  ['Prakash Hadimani', 'Male', 'Ballari', 'Undergraduate', 'BCA', 'VSK University', 70, 22000, 'approved'],
  ['Neha Desai', 'Female', 'Bengaluru Urban', 'Undergraduate', 'B.Tech Computer Science', 'Govt Engineering College KR Puram', 91, 74000, 'disbursed'],
  ['Basavaraj Kori', 'Male', 'Kalaburagi', 'Class 11–12', 'Class 12 Commerce', 'Govt PU College Aland', 58, 7000, 'submitted'],
  ['Ayesha Nadaf', 'Female', 'Vijayapura', 'Undergraduate', 'B.Sc. Nursing', 'BLDE Nursing College', 76, 45000, 'field_verified'],
  ['Vinay Hosamani', 'Male', 'Hubballi', 'Diploma / ITI', 'Diploma in Mechanical', 'Govt Polytechnic Hubballi', 66, 17500, 'submitted'],
  ['Rekha Banakar', 'Female', 'Dharwad', 'Undergraduate', 'B.A. Kannada', 'Karnatak University', 72, 11000, 'approved'],
];
const STORIES = [
  'My father passed away when I was in Class 9. My mother works on daily wages in nearby farms and earns about ₹250 a day. I have one younger brother who is also studying. I scored well in my PUC and got a seat, but we could not pay the full fee, so I borrowed from relatives. I want to complete my course and get a government job so that my mother does not have to work in the fields anymore.',
  "We live in a rented one-room house. My father is a construction worker and work is not regular, especially in the rainy season. I travel 18 km every day by bus to reach college. I am the first in my family to go to college. With a laptop I can practise coding at home instead of waiting for the college lab. I want to become a software engineer and support my younger sisters' education.",
  "My parents are small farmers with less than two acres of dry land. Last year the crop failed and we had to take a loan. I have always been good at science and want to become a nurse in our taluk hospital, where there are very few nurses. A scholarship would let me stay in the hostel instead of travelling three hours every day.",
];
const BASE_DOCS = ['aadhaar_front', 'aadhaar_back', 'photo', 'marksheet', 'income', 'admission', 'fee_structure', 'bank', 'consent'];
const LABEL = Object.fromEntries(DOCUMENTS.map((d) => [d.key, d.label]));

const sampleDoc = (label, name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F1EFEA"/>
<rect x="24" y="24" width="352" height="252" rx="10" fill="#fff" stroke="#E2DED4" stroke-width="2"/>
<path d="M44 140V84a35 35 0 0 1 70 0v56z" fill="#E6EEEC"/><circle cx="79" cy="92" r="15" fill="#B9CFCB"/>
<rect x="132" y="60" width="200" height="12" rx="6" fill="#0D4D4A" opacity=".85"/>
<rect x="132" y="86" width="160" height="10" rx="5" fill="#D9D4C8"/><rect x="132" y="106" width="180" height="10" rx="5" fill="#D9D4C8"/>
<rect x="44" y="164" width="300" height="10" rx="5" fill="#ECE8DF"/><rect x="44" y="186" width="260" height="10" rx="5" fill="#ECE8DF"/>
<text x="44" y="244" font-family="sans-serif" font-size="18" font-weight="700" fill="#13302E">${label}</text>
<text x="44" y="264" font-family="sans-serif" font-size="13" fill="#6B6A63">Sample for ${name}</text></svg>`;

// --if-empty: seed only a brand-new database. The free test deploy runs this on every start because it has no shell.
if (process.argv.includes('--if-empty')) {
  await migrate();
  if ((await get('SELECT COUNT(*) AS n FROM users')).n > 0) {
    console.log('Database already has data; not seeding.');
    await pool.end();
    process.exit(0);
  }
}
if (config.production && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Use "npm run add-staff" to create real accounts, or pass --force for a demo site.');
  process.exit(1);
}
await reset();
fs.rmSync(config.uploadDir, { recursive: true, force: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

const ids = {};
await tx(async () => {
  for (const [name, phone, role, district] of STAFF) {
    ids[phone] = await insert('INSERT INTO users (name, phone, role, district) VALUES (?,?,?,?)', name, phone, role, district);
  }
  const deepa = ids['9000000003'], imran = ids['9000000004'], ravi = ids['9000000002'], anita = ids['9000000001'];
  const apps = {};
  const start = Date.now() - 80 * 864e5;

  for (const [i, [name, gender, district, level, course, inst, pct, fee, status]] of STUDENTS.entries()) {
    const phone = `98765${String(i + 1).padStart(5, '0')}`;
    const sid = await insert("INSERT INTO users (name, phone, role, district) VALUES (?,?, 'student', ?)", name, phone, district);
    const answers = {};
    for (const q of QUESTIONS) {
      const weighted = q.options.flatMap((o) => (o.value >= 0.6 ? [o, o, o] : [o]));
      answers[q.key] = pick(weighted).key;
    }
    answers.girl = gender === 'Female' ? 'yes' : 'no';
    const need = needScore(answers), merit = meritScore(pct), final = finalScore(need, merit);
    const mob = district === 'Belagavi' ? deepa : district === 'Dharwad' ? imran : null;
    let t = new Date(start + i * 3 * 864e5 + int(9, 17) * 36e5);
    const aad = `${int(2, 9)}${String(int(1e10, 99999999999)).padStart(11, '0')}`;
    const needsDevice = /Computer|BCA/.test(course);
    const requested = fee + (needsDevice ? 35000 : 0);
    const sanctioned = ['approved', 'disbursed'].includes(status) ? Math.floor((requested * 0.9) / 500) * 500 : null;
    const support = needsDevice ? 'fees,device,mentor' : pick(['fees,books,training', 'fees,hostel,mentor', 'fees,internship']);
    const id = await insert(`INSERT INTO applications (code, student_id, mobilizer_id, project, status, aadhaar_hash, aadhaar_last4, whatsapp,
        full_name, gender, dob, address, village, district, state, pin, languages, religion, level, institution, institution_type,
        course, study_year, last_percentage, annual_fee, fee_paid, distance_km, career_goal, answers, need_score, merit_score, final_score,
        support_types, amount_requested, amount_sanctioned, story, created_at, updated_at, visit_lat, visit_lng)
        VALUES (${Array(40).fill('?').join(',')})`,
      `TK-26-${String(4101 + i).padStart(5, '0')}`, sid, mob, pick(['Project Bharat', 'Project Synopsys']), status, hashAadhaar(aad), aad.slice(-4), phone,
      name, gender, `${2004 + (i % 5)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(3 + i).padStart(2, '0')}`, `#${12 + i}, Ward ${3 + (i % 7)}`,
      pick(['Hukkeri', 'Gokak', 'Saundatti', 'Athani', 'Navalgund', 'Aland', 'Sindhanur']), district, 'Karnataka', `5${int(80000, 89999)}`,
      'Kannada, Hindi', pick(['Hindu', 'Muslim', 'Hindu', 'Christian']), level, inst, pick(['Government', 'Aided', 'Private']), course,
      pick(['1st year', '2nd year', '3rd year']), pct, fee, pick([0, 2000, 5000]), pick([4, 12, 18, 27]),
      pick(['Nurse in a government hospital', 'Software engineer', 'Teacher', 'Civil engineer', 'Bank officer']),
      JSON.stringify(answers), need, merit, final, support, requested, sanctioned, STORIES[i % 3], iso(t), iso(t),
      mob ? 15.85 + rnd() / 10 : null, mob ? 74.5 + rnd() / 10 : null);
    apps[name] = { id, inst, fee, sanctioned };

    let docs = status !== 'submitted' || i % 2 === 0 ? [...BASE_DOCS] : BASE_DOCS.slice(0, 5);
    if (status !== 'submitted') {
      if (['sc', 'st', 'obc'].includes(answers.category)) docs.push('caste');
      if (answers.disability === 'self') docs.push('disability');
      if (['orphan', 'single'].includes(answers.parents)) docs.push('death_cert');
    }
    for (const d of docs) {
      const stored = `${crypto.randomUUID()}.svg`;
      fs.writeFileSync(path.join(config.uploadDir, stored), sampleDoc(LABEL[d], name));
      await run('INSERT INTO documents (application_id, doc_type, file_name, stored_name, mime) VALUES (?,?,?,?,?)', id, d, `${d}.svg`, stored, 'image/svg+xml');
    }
    if (status !== 'submitted') { // demo stand-in for the interview video
      const stored = `${crypto.randomUUID()}.txt`;
      fs.writeFileSync(path.join(config.uploadDir, stored), 'Demo placeholder: upload a real video to replace this.');
      await run('INSERT INTO documents (application_id, doc_type, file_name, stored_name, mime) VALUES (?,?,?,?,?)', id, 'video', 'video.txt', stored, 'text/plain');
    }

    const review = async (actor, action, comment = null, amount = null, days = 2) => {
      t = new Date(t.getTime() + days * 864e5 + int(1, 5) * 36e5);
      await run('INSERT INTO reviews (application_id, actor_id, action, comment, amount, created_at) VALUES (?,?,?,?,?,?)', id, actor, action, comment, amount, iso(t));
    };
    await review(mob || sid, 'submitted', null, null, 0);
    const field = mob || deepa;
    if (['field_verified', 'approved', 'disbursed'].includes(status)) await review(field, 'forwarded', 'Visited home with mother present. Documents match. Family situation as described.', null, 5);
    if (['approved', 'disbursed'].includes(status)) await review(ravi, 'approved', 'Strong need and consistent marks. Sanctioned fees and support asked for.', sanctioned, 4);
    if (status === 'rejected') {
      await review(field, 'forwarded', 'Visited home. Family runs a medical shop; income appears higher than declared.', null, 5);
      await review(ravi, 'rejected', "Family income seen during the home visit was well above this year's limit. You can still apply for the government scholarships listed on your page.", null, 3);
    }
    if (status === 'disbursed') {
      await run(`INSERT INTO payments (application_id, kind, payee, payee_account, amount, purpose, status, utr, requested_by, approved_by, created_at, paid_at)
           VALUES (?,?,?,?,?,?,'paid',?,?,?,?,?)`, id, 'scholarship', inst, 'A/c 0041…2290, IFSC CNRB0000412', Math.min(fee, sanctioned),
        'Annual tuition fee', `UTR${int(1e9, 9e9)}`, field, anita, iso(t), iso(new Date(t.getTime() + 2 * 864e5)));
    }
  }

  await run(`INSERT INTO payments (application_id, kind, payee, payee_account, amount, purpose, status, requested_by) VALUES (?,?,?,?,?,?,'requested',?)`,
    apps['Jayashri Chikkodi'].id, 'scholarship', 'Govt Polytechnic Belagavi', 'A/c 1200…8812, IFSC SBIN0001011', 18500, 'Year 2 tuition and exam fee', deepa);
  await run(`INSERT INTO payments (application_id, kind, payee, payee_account, amount, purpose, status, requested_by, approved_by) VALUES (?,?,?,?,?,?,'approved',?,?)`,
    apps['Fathima Begum'].id, 'scholarship', "Karnataka State Akkamahadevi Women's University", 'A/c 3301…0021, IFSC KARB0000330', 16000, 'Annual fee', imran, ravi);
  await run(`INSERT INTO payments (application_id, kind, payee, payee_account, amount, purpose, status, requested_by) VALUES (?,?,?,?,?,?,'requested',?)`,
    apps['Jayashri Chikkodi'].id, 'vendor', 'Sri Sai Computers, Belagavi', 'A/c 5520…1187, IFSC HDFC0001234', 32500, 'Laptop (quotation attached)', deepa);
  await run(`INSERT INTO payments (kind, payee, amount, purpose, status, requested_by, approved_by, utr, paid_at) VALUES ('training','STG Office, Belagavi',300,'Orientation venue and snacks','paid',?,?,'UTR8812004412',?)`,
    deepa, ravi, iso(new Date(Date.now() - 9 * 864e5)));

  await run("INSERT INTO renewals (application_id, semester, marks, attendance, status) VALUES (?, 'Sem 3, 2026', 74, 88, 'accepted')", apps['Sayali Bandekar'].id);
  await run("INSERT INTO renewals (application_id, semester, marks, attendance, status) VALUES (?, 'Sem 4, 2026', 46, 71, 'at_risk')", apps['Neha Desai'].id);
  await run("INSERT INTO renewals (application_id, semester, marks, attendance, status) VALUES (?, 'Term 1, 2026', 86, 93, 'pending')", apps['Pooja Hiremath'].id);

  const funded = ['Sayali Bandekar', 'Jayashri Chikkodi', 'Pooja Hiremath', 'Neha Desai', 'Fathima Begum', 'Prakash Hadimani'].map((n) => apps[n].id);
  const t1 = await insert("INSERT INTO trainings (title, kind, venue, location, held_on, budget, trainer, created_by) VALUES ('Orientation for new scholars','orientation','STG Office','Belagavi',?,300,'Ravi Kulkarni',?)", day(-10), ravi);
  for (const [k, a] of funded.entries()) await run('INSERT INTO attendance VALUES (?,?,?)', t1, a, k === 4 ? 0 : 1);
  const t2 = await insert("INSERT INTO trainings (title, kind, venue, location, held_on, budget, trainer, created_by) VALUES ('Spoken English, batch 1','skill','KLE Hall','Belagavi',?,1500,'Meera Joshi',?)", day(6), ravi);
  for (const a of funded) await run('INSERT INTO attendance VALUES (?,?,0)', t2, a);

  for (const o of [
    ['Synopsys', 'Summer intern, chip design support', 'internship', 'Bengaluru', 'Undergraduate,Postgraduate', '₹15,000 a month', day(21)],
    ['KLE Hospital', 'Nursing trainee', 'internship', 'Belagavi', 'Undergraduate,Diploma / ITI', '₹8,000 a month', day(14)],
    ['Infosys Springboard', 'Free course: Python for beginners', 'course', 'Online', '', 'Free, with certificate', day(30)],
    ['Hubballi Electric Co.', 'Apprentice electrician', 'job', 'Hubballi', 'Diploma / ITI', '₹12,500 a month', day(10)],
    ['District Library', 'Weekend tutor for Class 8 students', 'internship', 'Dharwad', 'Class 11–12,Undergraduate', '₹3,000 a month', day(18)],
  ]) await run('INSERT INTO opportunities (company, title, kind, location, for_levels, stipend, deadline) VALUES (?,?,?,?,?,?,?)', ...o);
});
// ---------------- school infrastructure ----------------
const SCHOOLS = [
  // Facilities and gaps match each school's request below, so the staff screens show a coherent picture.
  {
    name: 'Govt Higher Primary School, Hukkeri', phone: '9100000001', udise: '29010300101', type: 'Government', level: 'Upper primary (1–8)',
    hm: 'Shivanand Patil', village: 'Hukkeri', taluk: 'Hukkeri', district: 'Belagavi', area: 'Rural', tags: 'Drought-prone', est: 1962,
    boys: 206, girls: 214, cwsn: 6, male: 4, female: 5, nonTeaching: 2, classrooms: 8, at: [16.2310, 74.6005],
    f: { building: 'Pucca', classrooms_repair: 2, electricity: 'Yes, working', drinking_water: 'Borewell / hand pump', toilets_boys: 2, toilets_girls: 2, toilet_cwsn: 'No', handwash: 'Yes', boundary_wall: 'Partial / broken', ramp: 'No', kitchen: 'Yes', library: 'No', playground: 'Yes', computers: 0, internet: 'No' },
  },
  {
    name: 'Govt Urdu Primary School, Dharwad', phone: '9100000002', udise: '29110500207', type: 'Government', level: 'Primary (1–5)',
    hm: 'Nasreen Khazi', village: 'Dharwad', taluk: 'Dharwad', district: 'Dharwad', area: 'Urban', tags: 'Urban slum', est: 1978,
    boys: 83, girls: 97, cwsn: 2, male: 1, female: 3, nonTeaching: 1, classrooms: 5, at: [15.4589, 75.0078],
    f: { building: 'Partially pucca', classrooms_repair: 1, electricity: 'Yes, working', drinking_water: 'None', toilets_boys: 1, toilets_girls: 1, toilet_cwsn: 'No', handwash: 'No', boundary_wall: 'None', ramp: 'No', kitchen: 'No', library: 'No', playground: 'No', computers: 0, internet: 'No' },
  },
  {
    name: 'Govt High School, Aland', phone: '9100000003', udise: '29040200315', type: 'Government', level: 'Secondary (1–10)',
    hm: 'Mallikarjun Biradar', village: 'Aland', taluk: 'Aland', district: 'Kalaburagi', area: 'Rural', tags: 'Drought-prone,Border area', est: 1971,
    boys: 288, girls: 322, cwsn: 9, male: 8, female: 6, nonTeaching: 3, classrooms: 12, at: [17.5642, 76.5683],
    f: { building: 'Pucca', classrooms_repair: 3, electricity: 'Yes, not working', drinking_water: 'Borewell / hand pump', toilets_boys: 3, toilets_girls: 0, toilet_cwsn: 'No', handwash: 'Yes', boundary_wall: 'Fencing only', ramp: 'Yes', kitchen: 'Yes', library: 'Yes', playground: 'Yes', computers: 4, internet: 'No' },
  },
  {
    name: 'Sri Basaveshwara Aided School, Gokak', phone: '9100000004', udise: '29010700422', type: 'Aided', level: 'Secondary (1–10)',
    hm: 'Gangadhar Hiremath', village: 'Gokak', taluk: 'Gokak', district: 'Belagavi', area: 'Urban', tags: '', est: 1985,
    boys: 139, girls: 121, cwsn: 3, male: 4, female: 4, nonTeaching: 2, classrooms: 8, at: [16.1691, 74.8239],
    f: { building: 'Pucca', classrooms_repair: 0, electricity: 'Yes, working', drinking_water: 'Tap water', toilets_boys: 3, toilets_girls: 3, toilet_cwsn: 'No', handwash: 'Yes', boundary_wall: 'Pucca', ramp: 'No', kitchen: 'Yes', library: 'Yes', playground: 'No', computers: 2, internet: 'Yes' },
  },
  {
    name: 'Govt Model Primary School, Navalgund', phone: '9100000005', udise: '29110900518', type: 'Government', level: 'Primary (1–5)',
    hm: 'Savitri Kulkarni', village: 'Navalgund', taluk: 'Navalgund', district: 'Dharwad', area: 'Rural', tags: 'Drought-prone', est: 1958,
    boys: 70, girls: 70, cwsn: 1, male: 2, female: 3, nonTeaching: 1, classrooms: 5, at: [15.5580, 75.3639],
    f: { building: 'Pucca', classrooms_repair: 0, electricity: 'Yes, working', drinking_water: 'Tap water', toilets_boys: 2, toilets_girls: 2, toilet_cwsn: 'Yes', handwash: 'Yes', boundary_wall: 'Pucca', ramp: 'Yes', kitchen: 'Yes', library: 'No', playground: 'Yes', computers: 0, internet: 'No' },
  },
];
const REQUESTS = [
  // school index, status, urgency, title, beneficiaries, [item_key, qty], justification, days ago
  [0, 'submitted', 'high', 'Desks for Classes 5 to 7', 160, [['dual_desk', 60], ['green_board', 3]],
    'Classes 5, 6 and 7 sit on the floor on old mats. About 160 children write on their laps, and the blackboards are cracked so the back rows cannot read them. Parents have asked the SDMC for help.', 3],
  [1, 'verified', 'critical', 'Safe drinking water and handwash', 180, [['ro_purifier', 1], ['water_tank', 2], ['handwash', 1]],
    'The only water source is a borewell with high fluoride. Children bring water from home and many run out by noon. There is no place to wash hands before the midday meal, and we had diarrhoea cases last month.', 9],
  [2, 'approved', 'critical', "Girls' toilet repair and sanitary pad machine", 322, [['toilet_repair', 2], ['pad_vending', 1]],
    "Both girls' toilet blocks have broken doors and no running water. Attendance of girls in Classes 8 to 10 drops every month for several days. A pad vending machine and incinerator will also help them stay in school.", 18],
  [3, 'ordered', 'high', 'Fans and lights for 6 classrooms', 260, [['ceiling_fan', 12], ['led_light', 18], ['wiring', 2]],
    'Six classrooms have no working fans and only one bulb each. In April and May the rooms reach 40°C and children cannot concentrate after lunch. Two rooms also have unsafe old wiring.', 30],
  [4, 'delivered', 'normal', 'Library books and science kit', 140, [['library_set', 3], ['science_kit', 1]],
    'The school has no library. Teachers want a reading period every day and simple experiments for Classes 4 and 5, which currently learn science only from the textbook.', 55],
  [0, 'rejected', 'normal', 'Smart TV for the staff room', 9, [['smart_tv', 1]],
    'A smart TV would help teachers watch training videos from the education department during free periods and staff meetings.', 70],
];
const isoAgo = (days, hours = 0) => new Date(Date.now() - days * 864e5 + hours * 36e5).toISOString();
await tx(async () => {
  const staff = {};
  for (const [, phone] of STAFF) staff[phone] = (await get('SELECT id FROM users WHERE phone = ?', phone)).id;
  const deepa = staff['9000000003'], imran = staff['9000000004'], ravi = staff['9000000002'], anita = staff['9000000001'];
  const schoolRows = [];
  for (const sc of SCHOOLS) {
    const uid = await insert("INSERT INTO users (name, phone, role, district) VALUES (?,?, 'school', ?)", sc.name, sc.phone, sc.district);
    const students = sc.boys + sc.girls, teachers = sc.male + sc.female;
    const sid = await insert(`INSERT INTO schools (user_id, name, udise_code, school_type, level, medium, board, shifts, established, headmaster, headmaster_phone,
                                contact_role, village, taluk, district, state, pin, area_type, area_tags, boys, girls, students, cwsn,
                                male_teachers, female_teachers, teachers, non_teaching, classrooms, latitude, longitude, location_accuracy, located_at, facilities)
                              VALUES (${Array(33).fill('?').join(',')})`,
      uid, sc.name, sc.udise, sc.type, sc.level, sc.name.includes('Urdu') ? 'Urdu' : 'Kannada', 'State board', 'Single shift', sc.est, sc.hm, sc.phone,
      'Headmaster / Principal', sc.village, sc.taluk, sc.district, 'Karnataka', `5${int(80000, 89999)}`, sc.area, sc.tags, sc.boys, sc.girls, students, sc.cwsn,
      sc.male, sc.female, teachers, sc.nonTeaching, sc.classrooms, sc.at[0], sc.at[1], int(6, 18), isoAgo(int(60, 90)), JSON.stringify(sc.f));
    // Geo-tagged school photos, a few metres apart, as a phone would record them on a walk around the school.
    for (const [kind, label] of [['front', 'Front of the school'], ['classroom', 'Classroom'], ['toilet', 'Toilet block']]) {
      const stored = `${crypto.randomUUID()}.svg`;
      fs.writeFileSync(path.join(config.uploadDir, stored), sampleDoc(label, sc.name));
      await run(`INSERT INTO school_photos (school_id, kind, file_name, stored_name, mime, latitude, longitude, accuracy, uploaded_by, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`, sid, kind, `${kind}.svg`, stored, 'image/svg+xml',
        sc.at[0] + (rnd() - 0.5) / 2000, sc.at[1] + (rnd() - 0.5) / 2000, int(5, 20), uid, isoAgo(int(60, 90)));
    }
    schoolRows.push({ id: sid, uid, name: sc.name, district: sc.district, school_type: sc.type, students, teachers });
  }
  for (const [n, [si, status, urgency, title, beneficiaries, lines, justification, ago]] of REQUESTS.entries()) {
    const school = schoolRows[si];
    const items = lines.map(([key, quantity]) => { const c = INFRA_CATALOG.find((x) => x.key === key); return { ...c, quantity }; });
    const estimate = items.reduce((s, i) => s + i.cost * i.quantity, 0);
    const { score, detail } = priorityScore(school, items, urgency);
    const sanctioned = ['approved', 'ordered', 'delivered'].includes(status) ? Math.floor((estimate * 0.95) / 500) * 500 : null;
    const field = school.district === 'Dharwad' ? imran : deepa;
    const rid = await insert(`INSERT INTO infra_requests (code, school_id, status, title, urgency, justification, beneficiaries, estimate, amount_sanctioned,
                                priority, priority_detail, created_by, created_at, updated_at, delivered_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      `INF-26-${String(1001 + n).padStart(5, '0')}`, school.id, status, title, urgency, justification, beneficiaries, estimate, sanctioned,
      score, JSON.stringify(detail), school.uid, isoAgo(ago), isoAgo(Math.max(0, ago - 10)), status === 'delivered' ? isoAgo(ago - 20) : null);
    for (const i of items) {
      await run('INSERT INTO infra_items (request_id, item_key, name, category, quantity, unit_cost) VALUES (?,?,?,?,?,?)', rid, i.key, i.name, i.category, i.quantity, i.cost);
    }
    const doc = async (kind, label) => {
      const stored = `${crypto.randomUUID()}.svg`;
      fs.writeFileSync(path.join(config.uploadDir, stored), sampleDoc(label, school.name));
      await run('INSERT INTO infra_documents (request_id, kind, file_name, stored_name, mime, uploaded_by) VALUES (?,?,?,?,?,?)', rid, kind, `${kind}.svg`, stored, 'image/svg+xml', school.uid);
    };
    await doc('condition', 'Current condition, photo 1');
    await doc('condition', 'Current condition, photo 2');
    const ev = (actor, action, comment, days, amount = null) =>
      run('INSERT INTO infra_events (request_id, actor_id, action, comment, amount, created_at) VALUES (?,?,?,?,?,?)', rid, actor, action, comment, amount, isoAgo(days));
    await ev(school.uid, 'submitted', null, ago);
    if (status !== 'submitted') {
      await ev(field, 'verified', status === 'rejected'
        ? 'Visited. Classrooms are adequately equipped; the TV is for staff use only and does not reach students directly.'
        : 'Visited the school with the SDMC president. Need is genuine and matches the photos; quantities checked against enrolment.', ago - 3);
    }
    if (status === 'rejected') await ev(ravi, 'rejected', 'Not approved: we fund items that directly reach students. Please apply for classroom needs instead.', ago - 6);
    if (['approved', 'ordered', 'delivered'].includes(status)) await ev(ravi, 'approved', 'Approved. Raise the vendor payment against the quotation.', ago - 6, sanctioned);
    if (['ordered', 'delivered'].includes(status)) {
      await doc('quotation', 'Vendor quotation');
      const vendor = { 3: 'Sri Ganesh Electricals, Gokak', 4: 'Navakarnataka Books and Scientific, Hubballi' }[si];
      await run(`INSERT INTO payments (infra_request_id, kind, payee, payee_account, amount, purpose, status, utr, requested_by, approved_by, created_at, paid_at)
                 VALUES (?,'infrastructure',?,?,?,?,'paid',?,?,?,?,?)`, rid, vendor, 'A/c 7781…3302, IFSC CNRB0002201', sanctioned, title,
        `UTR${int(1e9, 9e9)}`, field, ravi, isoAgo(ago - 8), isoAgo(ago - 9));
      await ev(anita, 'ordered', `Paid ${vendor}`, ago - 9, sanctioned);
    }
    if (status === 'delivered') {
      await doc('delivery', 'Delivered items in use');
      await ev(school.uid, 'delivered', 'All items received in good condition. The reading period started this week.', ago - 20);
    }
    if (status === 'approved') {
      await run(`INSERT INTO payments (infra_request_id, kind, payee, payee_account, amount, purpose, status, requested_by) VALUES (?,'infrastructure',?,?,?,?,'requested',?)`,
        rid, 'Kalaburagi Civil Works', 'A/c 4410…9087, IFSC SBIN0004410', 90000, 'Toilet block repair, advance', ravi);
    }
  }
});
await run("SELECT setval('infra_code_seq', ?)", 1000 + REQUESTS.length);

// keep the demo application codes and new ones from colliding
await run("SELECT setval('application_code_seq', ?)", 4100 + STUDENTS.length);
await pool.end();
console.log(`Seeded ${STUDENTS.length} students, ${SCHOOLS.length} schools and ${STAFF.length} staff.`);
