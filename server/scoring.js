// Need-based scoring. Each question's weight is its share of the 100-point Need Score;
// each option's value (0..1) says how strongly it signals need. Change weights here.
export const NEED_SHARE = 0.7;

export const QUESTIONS = [
 {
  "key": "income",
  "en": "Annual family income",
  "hi": "परिवार की वार्षिक आय",
  "weight": 15,
  "options": [
   {
    "key": "lt1",
    "en": "Below ₹1 lakh",
    "hi": "₹1 लाख से कम",
    "value": 1.0
   },
   {
    "key": "1to2.5",
    "en": "₹1–2.5 lakh",
    "hi": "₹1–2.5 लाख",
    "value": 0.7
   },
   {
    "key": "2.5to5",
    "en": "₹2.5–5 lakh",
    "hi": "₹2.5–5 लाख",
    "value": 0.35
   },
   {
    "key": "gt5",
    "en": "Above ₹5 lakh",
    "hi": "₹5 लाख से अधिक",
    "value": 0.0
   }
  ]
 },
 {
  "key": "ration",
  "en": "Ration card",
  "hi": "राशन कार्ड",
  "weight": 10,
  "options": [
   {
    "key": "antyodaya",
    "en": "Antyodaya",
    "hi": "अंत्योदय",
    "value": 1.0
   },
   {
    "key": "bpl",
    "en": "BPL",
    "hi": "बीपीएल",
    "value": 0.8
   },
   {
    "key": "apl",
    "en": "APL",
    "hi": "एपीएल",
    "value": 0.3
   },
   {
    "key": "none",
    "en": "None",
    "hi": "कोई नहीं",
    "value": 0.2
   }
  ]
 },
 {
  "key": "category",
  "en": "Category",
  "hi": "वर्ग",
  "weight": 10,
  "options": [
   {
    "key": "sc",
    "en": "SC",
    "hi": "अनुसूचित जाति",
    "value": 1.0
   },
   {
    "key": "st",
    "en": "ST",
    "hi": "अनुसूचित जनजाति",
    "value": 1.0
   },
   {
    "key": "obc",
    "en": "OBC",
    "hi": "अन्य पिछड़ा वर्ग",
    "value": 0.6
   },
   {
    "key": "minority",
    "en": "Minority",
    "hi": "अल्पसंख्यक",
    "value": 0.6
   },
   {
    "key": "general",
    "en": "General",
    "hi": "सामान्य",
    "value": 0.2
   }
  ]
 },
 {
  "key": "parents",
  "en": "Parent status",
  "hi": "माता-पिता की स्थिति",
  "weight": 10,
  "options": [
   {
    "key": "orphan",
    "en": "Orphan",
    "hi": "अनाथ",
    "value": 1.0
   },
   {
    "key": "single",
    "en": "Single parent",
    "hi": "एकल अभिभावक",
    "value": 0.7
   },
   {
    "key": "both",
    "en": "Both parents",
    "hi": "दोनों अभिभावक",
    "value": 0.0
   }
  ]
 },
 {
  "key": "house_type",
  "en": "House type",
  "hi": "घर का प्रकार",
  "weight": 10,
  "options": [
   {
    "key": "kachha",
    "en": "Kachha",
    "hi": "कच्चा",
    "value": 1.0
   },
   {
    "key": "semi",
    "en": "Semi-pucca",
    "hi": "अर्ध-पक्का",
    "value": 0.6
   },
   {
    "key": "pucca",
    "en": "Pucca",
    "hi": "पक्का",
    "value": 0.1
   }
  ]
 },
 {
  "key": "guardian_job",
  "en": "Father's / guardian's work",
  "hi": "पिता / अभिभावक का काम",
  "weight": 5,
  "options": [
   {
    "key": "daily",
    "en": "Daily wager",
    "hi": "दिहाड़ी मजदूर",
    "value": 1.0
   },
   {
    "key": "farmer",
    "en": "Small farmer",
    "hi": "छोटे किसान",
    "value": 0.8
   },
   {
    "key": "self",
    "en": "Self-employed",
    "hi": "स्वनियोजित",
    "value": 0.5
   },
   {
    "key": "private",
    "en": "Private job",
    "hi": "निजी नौकरी",
    "value": 0.4
   },
   {
    "key": "govt",
    "en": "Govt employee",
    "hi": "सरकारी नौकरी",
    "value": 0.0
   },
   {
    "key": "na",
    "en": "Not applicable",
    "hi": "लागू नहीं",
    "value": 1.0
   }
  ]
 },
 {
  "key": "mother_job",
  "en": "Mother's work",
  "hi": "माता का काम",
  "weight": 5,
  "options": [
   {
    "key": "daily",
    "en": "Daily wager",
    "hi": "दिहाड़ी मजदूर",
    "value": 1.0
   },
   {
    "key": "home",
    "en": "Homemaker",
    "hi": "गृहिणी",
    "value": 0.7
   },
   {
    "key": "working",
    "en": "Salaried",
    "hi": "वेतनभोगी",
    "value": 0.2
   },
   {
    "key": "na",
    "en": "Not applicable",
    "hi": "लागू नहीं",
    "value": 1.0
   }
  ]
 },
 {
  "key": "first_gen",
  "en": "First in family to go to college",
  "hi": "परिवार में पहली पीढ़ी के विद्यार्थी",
  "weight": 5,
  "options": [
   {
    "key": "yes",
    "en": "Yes",
    "hi": "हाँ",
    "value": 1.0
   },
   {
    "key": "no",
    "en": "No",
    "hi": "नहीं",
    "value": 0.0
   }
  ]
 },
 {
  "key": "disability",
  "en": "Disability",
  "hi": "विकलांगता",
  "weight": 5,
  "options": [
   {
    "key": "self",
    "en": "Yes, self",
    "hi": "हाँ, स्वयं",
    "value": 1.0
   },
   {
    "key": "parent",
    "en": "Yes, parent",
    "hi": "हाँ, अभिभावक",
    "value": 0.7
   },
   {
    "key": "no",
    "en": "No",
    "hi": "नहीं",
    "value": 0.0
   }
  ]
 },
 {
  "key": "ownership",
  "en": "House ownership",
  "hi": "घर का स्वामित्व",
  "weight": 5,
  "options": [
   {
    "key": "rented",
    "en": "Rented",
    "hi": "किराये का",
    "value": 1.0
   },
   {
    "key": "owned",
    "en": "Owned",
    "hi": "स्वयं का",
    "value": 0.2
   }
  ]
 },
 {
  "key": "siblings",
  "en": "Brothers and sisters also studying",
  "hi": "पढ़ाई कर रहे भाई-बहन",
  "weight": 5,
  "options": [
   {
    "key": "2plus",
    "en": "Two or more",
    "hi": "दो या अधिक",
    "value": 1.0
   },
   {
    "key": "1",
    "en": "One",
    "hi": "एक",
    "value": 0.6
   },
   {
    "key": "0",
    "en": "None",
    "hi": "कोई नहीं",
    "value": 0.2
   }
  ]
 },
 {
  "key": "earners",
  "en": "Earning members in family",
  "hi": "कमाने वाले सदस्य",
  "weight": 5,
  "options": [
   {
    "key": "le1",
    "en": "Up to one",
    "hi": "एक तक",
    "value": 1.0
   },
   {
    "key": "gt1",
    "en": "More than one",
    "hi": "एक से अधिक",
    "value": 0.2
   }
  ]
 },
 {
  "key": "utilities",
  "en": "Household items (AC, vehicle, fridge, washing machine)",
  "hi": "घरेलू सामान (AC, वाहन, फ्रिज, वाशिंग मशीन)",
  "weight": 2,
  "options": [
   {
    "key": "none",
    "en": "None",
    "hi": "कोई नहीं",
    "value": 1.0
   },
   {
    "key": "one",
    "en": "One",
    "hi": "एक",
    "value": 0.5
   },
   {
    "key": "more",
    "en": "More than one",
    "hi": "एक से अधिक",
    "value": 0.0
   }
  ]
 },
 {
  "key": "land",
  "en": "Agricultural land",
  "hi": "खेती की जमीन",
  "weight": 2,
  "options": [
   {
    "key": "none",
    "en": "None",
    "hi": "नहीं",
    "value": 1.0
   },
   {
    "key": "small",
    "en": "1–6 bigha",
    "hi": "1–6 बीघा",
    "value": 0.6
   },
   {
    "key": "large",
    "en": "7 bigha or more",
    "hi": "7 बीघा से अधिक",
    "value": 0.0
   }
  ]
 },
 {
  "key": "device",
  "en": "Owns a smartphone or laptop",
  "hi": "स्मार्टफोन या लैपटॉप है",
  "weight": 2,
  "options": [
   {
    "key": "neither",
    "en": "Neither",
    "hi": "कोई नहीं",
    "value": 1.0
   },
   {
    "key": "phone",
    "en": "Phone only",
    "hi": "केवल फोन",
    "value": 0.6
   },
   {
    "key": "both",
    "en": "Both",
    "hi": "दोनों",
    "value": 0.0
   }
  ]
 },
 {
  "key": "girl",
  "en": "Girl student",
  "hi": "छात्रा",
  "weight": 2,
  "options": [
   {
    "key": "yes",
    "en": "Yes",
    "hi": "हाँ",
    "value": 1.0
   },
   {
    "key": "no",
    "en": "No",
    "hi": "नहीं",
    "value": 0.0
   }
  ]
 },
 {
  "key": "motivation",
  "en": "Clarity of goal and family support (field officer's view)",
  "hi": "लक्ष्य की स्पष्टता और परिवार का सहयोग",
  "weight": 2,
  "options": [
   {
    "key": "good",
    "en": "Good",
    "hi": "अच्छा",
    "value": 1.0
   },
   {
    "key": "moderate",
    "en": "Moderate",
    "hi": "मध्यम",
    "value": 0.5
   },
   {
    "key": "low",
    "en": "Low",
    "hi": "कम",
    "value": 0.0
   }
  ]
 }
];

const total = QUESTIONS.reduce((s, q) => s + q.weight, 0);
if (total !== 100) throw new Error(`Question weights must total 100 (now ${total})`);

const round1 = (n) => Math.round(n * 10) / 10;

export function needScore(answers) {
  let sum = 0;
  for (const q of QUESTIONS) {
    const opt = q.options.find((o) => o.key === answers[q.key]);
    if (opt) sum += q.weight * opt.value;
  }
  return round1(sum);
}
export const meritScore = (pct) => round1(Math.max(0, Math.min(100, Number(pct) || 0)));
export const finalScore = (need, merit) => round1(NEED_SHARE * need + (1 - NEED_SHARE) * merit);

export function breakdown(answers) {
  return QUESTIONS.map((q) => {
    const opt = q.options.find((o) => o.key === answers[q.key]);
    return { question: q.en, answer: opt ? opt.en : 'Not answered', points: opt ? round1(q.weight * opt.value) : 0, weight: q.weight };
  });
}
