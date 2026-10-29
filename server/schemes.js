// Government scholarship finder: a first-pass match on the profile already collected.
// Rules are simplified; students confirm eligibility and deadlines on the official portal.
const NSP = 'https://scholarships.gov.in';
const SSP = 'https://ssp.postmatric.karnataka.gov.in';
const AICTE = 'https://www.aicte-india.org/schemes/students-development-schemes';
const notSchool = (a) => a.level !== 'Class 8–10';
const lowIncome = (x) => ['lt1', '1to2.5', '2.5to5'].includes(x.income);

const SCHEMES = [
  { name: 'Post-matric scholarship for SC students', by: 'Ministry of Social Justice (NSP / state portal)', url: NSP, rule: (a, x) => x.category === 'sc' && notSchool(a) },
  { name: 'Post-matric scholarship for ST students', by: 'Ministry of Tribal Affairs (NSP / state portal)', url: NSP, rule: (a, x) => x.category === 'st' && notSchool(a) },
  { name: 'Post-matric scholarship for OBC students', by: 'Karnataka backward classes department', url: SSP, rule: (a, x) => x.category === 'obc' && a.state === 'Karnataka' && notSchool(a) },
  { name: 'Post-matric scholarship for minorities', by: 'Ministry of Minority Affairs (NSP)', url: NSP, rule: (a, x) => x.category === 'minority' && notSchool(a) },
  { name: 'Central Sector Scheme of Scholarships for college students', by: 'Department of Higher Education (NSP)', url: NSP, rule: (a, x) => ['Undergraduate', 'Postgraduate'].includes(a.level) && lowIncome(x) && a.last_percentage >= 80 },
  { name: 'Pragati scholarship for girl students (technical education)', by: 'AICTE', url: AICTE, rule: (a, x) => x.girl === 'yes' && ['Diploma / ITI', 'Undergraduate'].includes(a.level) },
  { name: 'Saksham scholarship for students with disabilities', by: 'AICTE', url: AICTE, rule: (a, x) => x.disability === 'self' && ['Diploma / ITI', 'Undergraduate'].includes(a.level) },
  { name: 'National Means-cum-Merit Scholarship', by: 'Ministry of Education (NSP)', url: NSP, rule: (a, x) => a.level === 'Class 8–10' && lowIncome(x) },
];

export function matchSchemes(app) {
  const answers = typeof app.answers === 'string' ? JSON.parse(app.answers) : app.answers;
  return SCHEMES.filter((s) => s.rule(app, answers)).map(({ rule, ...s }) => s);
}
