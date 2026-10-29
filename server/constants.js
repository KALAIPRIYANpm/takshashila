export const STATUSES = {
  submitted: 'Submitted',
  field_verified: 'Field verified',
  approved: 'Approved',
  disbursed: 'Funds released',
  rejected: 'Not selected',
};
export const STATUS_FLOW = ['submitted', 'field_verified', 'approved', 'disbursed'];

export const ROLES = { student: 'Student', school: 'School', field: 'Field executive', manager: 'Program manager', admin: 'Admin / finance' };
export const STAFF_ROLES = ['field', 'manager', 'admin'];

export const LEVELS = ['Class 8–10', 'Class 11–12', 'Diploma / ITI', 'Undergraduate', 'Postgraduate', 'PhD'];
export const INSTITUTION_TYPES = ['Government', 'Aided', 'Private'];
export const GENDERS = ['Female', 'Male', 'Other'];
export const PHONE_OWNERS = ['Self', 'Parent', 'Other'];
export const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
export const PROJECTS = ['Project Bharat', 'Project Synopsys', 'Project Udaan'];
export const DISTRICTS = ['Belagavi', 'Dharwad', 'Bengaluru Urban', 'Kalaburagi', 'Vijayapura', 'Mysuru', 'Raichur', 'Ballari', 'Bagalkot', 'Hubballi'];
export const STATES = ['Karnataka', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Goa', 'Tamil Nadu', 'Kerala', 'Other'];

export const SUPPORT_TYPES = [
  { key: 'fees', en: 'Scholarship for fees', hi: 'फीस के लिए छात्रवृत्ति' },
  { key: 'hostel', en: 'Hostel and food', hi: 'छात्रावास और भोजन' },
  { key: 'device', en: 'Laptop or tablet', hi: 'लैपटॉप या टैबलेट' },
  { key: 'books', en: 'Books and kit', hi: 'किताबें और सामग्री' },
  { key: 'training', en: 'Skill training', hi: 'कौशल प्रशिक्षण' },
  { key: 'mentor', en: 'A mentor', hi: 'मार्गदर्शक' },
  { key: 'internship', en: 'Internship or job', hi: 'इंटर्नशिप या नौकरी' },
];

// `when` = [questionKey, [answers that make this document required]]
export const DOCUMENTS = [
  { key: 'aadhaar_front', label: 'Aadhaar front', required: true },
  { key: 'aadhaar_back', label: 'Aadhaar back', required: true },
  { key: 'photo', label: 'Student photo', required: true },
  { key: 'marksheet', label: 'Latest marksheet', required: true },
  { key: 'income', label: 'Income certificate', required: true },
  { key: 'admission', label: 'Admission letter or bonafide certificate', required: true },
  { key: 'fee_structure', label: 'Fee structure or fee demand', required: true },
  { key: 'bank', label: "Bank passbook (student's account)", required: true },
  { key: 'consent', label: 'Consent and declaration (student and parent)', required: true },
  { key: 'caste', label: 'Caste certificate', required: true, when: ['category', ['sc', 'st', 'obc']] },
  { key: 'disability', label: 'Disability certificate', required: true, when: ['disability', ['self']] },
  { key: 'death_cert', label: "Parent's death certificate", required: true, when: ['parents', ['orphan', 'single']] },
  { key: 'visit_photo', label: 'Home visit photo', required: false },
  { key: 'video', label: 'Video interview (3 min)', required: true, video: true },
];

export const VIDEO_QUESTIONS = [
  'We are from Takshashila Trust. What is your name?',
  'What are you studying, and in which college or school?',
  'What do your parents do?',
  'How many people are in your family, and how many earn?',
  "What is your family's monthly income and expense?",
  'What marks did you get in your last exam?',
  'What help do you need from us?',
  'If we support you, what will change? What do you want to become?',
  'You will attend one orientation and skill session, and share marks and attendance every semester.',
];
