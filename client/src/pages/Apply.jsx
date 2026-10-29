import { useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/layout.jsx';
import { ArchGauge, Choices, FileSlot, Input, Select, Spinner, useTitle } from '../components/ui.jsx';
import { api, cx, inr, uploadFile } from '../lib.js';
import { navigate } from '../router.jsx';
import { useApp } from '../state.jsx';

const STEPS = [
  { title: 'Sign-up details', sub: 'Aadhaar and phone are required. We use Aadhaar only to make sure each student applies once.', fields: ['phone', 'project', 'aadhaar', 'whatsapp', 'email'] },
  { title: 'About you', sub: 'Write your name exactly as it is on your marksheet.', fields: ['full_name', 'gender', 'dob', 'languages', 'alt_phone', 'alt_phone_owner', 'address', 'village', 'district', 'pin', 'state', 'religion'] },
  { title: 'Your studies', sub: 'Where you study now, or where you have taken admission.', fields: ['level', 'institution', 'institution_type', 'course', 'study_year', 'last_percentage', 'annual_fee', 'fee_paid', 'distance_km', 'career_goal'] },
  { title: 'Your family', sub: 'Each answer adds to your need score. Answer honestly; the field executive checks during the home visit.', fields: [] },
  { title: 'Support and your story', sub: 'Choose everything that would help. Then tell us, in your own words, why.', fields: ['support', 'amount_requested', 'other_benefits', 'story'] },
  { title: 'Documents', sub: 'Photos or PDFs. Green means attached. You can add missing ones later from your page.', fields: [] },
  { title: 'Video interview', sub: 'Record at least 3 minutes at home or college, on any phone. Speak comfortably, but cover these questions.', fields: [] },
  { title: 'Check and submit', sub: 'Go back to any step to change an answer.', fields: ['consent'] },
];

const digits = (v) => String(v || '').replace(/\D/g, '');

export default function Apply({ onBehalf = false }) {
  useTitle(onBehalf ? 'Register a student' : 'Apply');
  const { meta, auth, refreshAuth, notify } = useApp();
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(new Set([0]));
  const [f, setF] = useState({ state: 'Karnataka', project: 'Project Bharat', district: onBehalf ? auth.user?.district || '' : '' });
  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(null); // {phase, progress:{}}
  const [geo, setGeo] = useState('');
  const topRef = useRef(null);

  const set = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((s) => ({ ...s, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const need = useMemo(() => {
    if (!meta) return 0;
    return Math.round(meta.questions.reduce((sum, q) => {
      const o = q.options.find((x) => x.key === answers[q.key]);
      return sum + (o ? q.weight * o.value : 0);
    }, 0) * 10) / 10;
  }, [answers, meta]);
  const merit = f.last_percentage === undefined || f.last_percentage === '' ? null : Math.max(0, Math.min(100, Number(f.last_percentage)));
  const overall = merit === null || !meta ? null : Math.round(meta.needShare * need + (1 - meta.needShare) * merit);

  if (!meta) return <Spinner />;

  const docs = meta.documents.filter((d) => !d.video && (!d.when || d.when[1].includes(answers[d.when[0]])));
  const answeredCount = meta.questions.filter((q) => answers[q.key]).length;

  function validate(i) {
    const e = {};
    const req = (k, msg) => { if (!String(f[k] ?? '').trim()) e[k] = msg; };
    const range = (k, lo, hi, msg, optional) => {
      if (optional && (f[k] === undefined || f[k] === '')) return;
      const n = Number(f[k]);
      if (f[k] === undefined || f[k] === '' || Number.isNaN(n) || n < lo || n > hi) e[k] = msg;
    };
    if (i === 0) {
      if (onBehalf && !/^[6-9]\d{9}$/.test(digits(f.phone).slice(-10))) e.phone = '10 digits, starting with 6, 7, 8 or 9.';
      if (!/^[2-9]\d{11}$/.test(digits(f.aadhaar))) e.aadhaar = '12 digits. It cannot start with 0 or 1.';
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Check the email address.';
    }
    if (i === 1) {
      req('full_name', 'Enter your full name.'); req('dob', 'Enter your date of birth.'); req('district', 'Enter your district.'); req('state', 'Choose your state.');
      if (!f.gender) e.gender = 'Choose one.';
    }
    if (i === 2) {
      if (!f.level) e.level = 'Choose one.';
      req('institution', 'Enter your school or college.'); req('course', 'Enter your course or class.');
      range('last_percentage', 0, 100, 'Marks between 0 and 100.');
      range('annual_fee', 0, 2000000, 'Enter the yearly fee in rupees.');
      range('fee_paid', 0, 2000000, 'Enter a number in rupees.', true);
      range('distance_km', 0, 500, 'Enter kilometres.', true);
    }
    if (i === 3) for (const q of meta.questions) if (!answers[q.key]) e[`q_${q.key}`] = 'Choose one.';
    if (i === 4) {
      if (!(f.support || []).length) e.support = 'Choose at least one.';
      range('amount_requested', 500, 2000000, 'Enter the amount, at least ₹500.');
      if ((f.story || '').trim().length < 150) e.story = 'Write at least 150 characters.';
    }
    if (i === 7 && !f.consent) e.consent = 'Tick this to confirm.';
    return e;
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const go = (i) => { setStep(i); setSeen((s) => new Set([...s, i])); scrollTop(); };
  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      setTimeout(() => document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus(), 30);
      return;
    }
    go(step + 1);
  };
  const jump = (i) => {
    if (i <= step || [...Array(i).keys()].every((k) => seen.has(k) && !Object.keys(validate(k)).length)) go(i);
    else next();
  };

  async function submit(e) {
    e.preventDefault();
    for (let i = 0; i < STEPS.length; i++) {
      const errs = validate(i);
      if (Object.keys(errs).length) { setErrors(errs); go(i); return; }
    }
    setSubmitting({ phase: 'saving', progress: {} });
    try {
      const body = { ...f, answers, aadhaar: digits(f.aadhaar), phone: digits(f.phone) };
      const r = await api.post(onBehalf ? '/api/staff/applications' : '/api/applications', body);
      const queue = Object.entries(files).filter(([, file]) => file);
      const failed = [];
      setSubmitting({ phase: 'uploading', progress: {} });
      for (const [key, file] of queue) {
        try {
          await uploadFile(r.id, key, file, (p) => setSubmitting((s) => ({ ...s, progress: { ...s.progress, [key]: p } })));
          setSubmitting((s) => ({ ...s, progress: { ...s.progress, [key]: 1 } }));
        } catch { failed.push(key); }
      }
      notify(failed.length
        ? `Application ${r.code} saved. ${failed.length} file${failed.length > 1 ? 's' : ''} didn't upload; add ${failed.length > 1 ? 'them' : 'it'} from the documents section.`
        : onBehalf ? `Application ${r.code} saved. The student can sign in with their phone to track it.` : `Application ${r.code} submitted. A field executive will call you within 7 days to plan the home visit.`,
      failed.length ? 'warn' : 'success');
      if (onBehalf) navigate(`/staff/applications/${r.id}`);
      else { await refreshAuth(); navigate('/me'); }
    } catch (err) {
      setSubmitting(null);
      if (err.fields && Object.keys(err.fields).length) {
        const keys = Object.keys(err.fields);
        setErrors(Object.fromEntries(keys.map((k) => [k, err.fields[k]])));
        const target = STEPS.findIndex((s, i) => keys.some((k) => s.fields.includes(k) || (i === 3 && k.startsWith('q_'))));
        if (target >= 0) go(target);
      }
      notify(err.message, 'error');
    }
  }

  const s = STEPS[step];
  const opt = (arr) => arr.map((x) => ({ value: x, label: x }));

  return (
    <div className={cx(!onBehalf && 'wrap', 'apply-page')} ref={topRef}>
      {onBehalf && <PageHead title="Register a student" sub="Fill this in with the student and a parent present. The student can sign in later with their phone to track it." />}
      <form className="wizard" onSubmit={submit} noValidate>
        <aside className="wizard-side">
          <div className="score-card" aria-live="polite">
            <ArchGauge value={need} size="lg" sub={`${answeredCount} of ${meta.questions.length} answered`} />
            <div className="score-split">
              <div><span>Marks</span><b>{merit === null ? '—' : Math.round(merit)}</b></div>
              <div><span>Overall</span><b>{overall ?? '—'}</b></div>
            </div>
            <p>The committee looks at need first ({Math.round(meta.needShare * 100)}%), then marks.</p>
          </div>
          <ol className="steps-nav">
            {STEPS.map((x, i) => (
              <li key={x.title}>
                <button type="button" onClick={() => jump(i)} aria-current={i === step ? 'step' : undefined}
                  className={cx(i < step && seen.has(i) && 'done')}><span className="n">{i + 1}</span>{x.title}</button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="sheet">
          <div className="sheet-head">
            <span className="sheet-step">Step {step + 1} of {STEPS.length}</span>
            <h2>{s.title}</h2>
            <p>{s.sub}</p>
          </div>

          {step === 0 && (
            <>
              {onBehalf ? (
                <div className="grid-2">
                  <Input label="Student's mobile number" hi="मोबाइल नंबर" required type="tel" inputMode="numeric" maxLength={14} value={f.phone || ''} onChange={set('phone')} error={errors.phone} help="The student signs in with this number." />
                  <Select label="Project" required options={meta.projects} value={f.project} onChange={set('project')} />
                </div>
              ) : (
                <div className="field"><span className="label">Mobile number</span><p className="verified">{auth.user.phone.replace(/(\d{5})(\d{5})/, '$1 $2')} <span>verified</span></p></div>
              )}
              <Input label="Aadhaar number" hi="आधार नंबर" required inputMode="numeric" maxLength={14} autoComplete="off" value={f.aadhaar || ''} onChange={set('aadhaar')} error={errors.aadhaar} help="Only the last 4 digits are shown to staff." />
              <div className="grid-2">
                <Input label="WhatsApp number" hi="व्हाट्सऐप" type="tel" inputMode="numeric" maxLength={14} value={f.whatsapp || ''} onChange={set('whatsapp')} help="Leave blank if same as mobile." />
                <Input label="Email" hi="ईमेल" type="email" value={f.email || ''} onChange={set('email')} error={errors.email} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Input label="Full name" hi="पूरा नाम" required autoComplete="name" value={f.full_name || ''} onChange={set('full_name')} error={errors.full_name} />
              <Choices name="gender" legend="Gender" hi="लिंग" required options={opt(meta.genders)} value={f.gender} onChange={set('gender')} error={errors.gender} />
              <div className="grid-2">
                <Input label="Date of birth" hi="जन्म तिथि" required type="date" value={f.dob || ''} onChange={set('dob')} error={errors.dob} />
                <Input label="Languages you speak" hi="भाषाएँ" value={f.languages || ''} onChange={set('languages')} help="For example: Kannada, Hindi" />
              </div>
              <div className="grid-2">
                <Input label="Alternate mobile" hi="वैकल्पिक मोबाइल" type="tel" inputMode="numeric" maxLength={14} value={f.alt_phone || ''} onChange={set('alt_phone')} />
                <Select label="Whose number is this?" hi="यह नंबर किसका है?" options={meta.phoneOwners} value={f.alt_phone_owner || ''} onChange={set('alt_phone_owner')} />
              </div>
              <Input label="House address" hi="पता" value={f.address || ''} onChange={set('address')} />
              <div className="grid-3">
                <Input label="Village or town" hi="गाँव / शहर" value={f.village || ''} onChange={set('village')} />
                <Input label="District" hi="ज़िला" required list="districts" value={f.district || ''} onChange={set('district')} error={errors.district} />
                <Input label="PIN code" hi="पिन" inputMode="numeric" maxLength={6} value={f.pin || ''} onChange={set('pin')} />
              </div>
              <datalist id="districts">{meta.districts.map((d) => <option key={d} value={d} />)}</datalist>
              <div className="grid-2">
                <Select label="State" hi="राज्य" required options={meta.states} value={f.state || ''} onChange={set('state')} error={errors.state} />
                <Select label="Religion" hi="धर्म" options={meta.religions} placeholder="Prefer not to say" value={f.religion || ''} onChange={set('religion')} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Choices name="level" legend="What are you studying now?" hi="अभी क्या पढ़ रहे हैं?" required options={opt(meta.levels)} value={f.level} onChange={set('level')} error={errors.level} />
              <div className="grid-2">
                <Input label="School or college" hi="स्कूल / कॉलेज" required value={f.institution || ''} onChange={set('institution')} error={errors.institution} />
                <Select label="Type of institution" options={meta.institutionTypes} value={f.institution_type || ''} onChange={set('institution_type')} />
              </div>
              <div className="grid-2">
                <Input label="Course or class" hi="कोर्स / कक्षा" required value={f.course || ''} onChange={set('course')} error={errors.course} help="For example: B.Sc. Nursing, Diploma in Civil, Class 11 Science" />
                <Input label="Year" hi="वर्ष" value={f.study_year || ''} onChange={set('study_year')} help="For example: 2nd year" />
              </div>
              <div className="grid-3">
                <Input label="Last exam marks (%)" required type="number" inputMode="decimal" min="0" max="100" step="0.1" value={f.last_percentage ?? ''} onChange={set('last_percentage')} error={errors.last_percentage} />
                <Input label="Fee per year (₹)" required type="number" inputMode="numeric" min="0" step="100" value={f.annual_fee ?? ''} onChange={set('annual_fee')} error={errors.annual_fee} help="Tuition + exam + hostel" />
                <Input label="Already paid (₹)" type="number" inputMode="numeric" min="0" step="100" value={f.fee_paid ?? ''} onChange={set('fee_paid')} error={errors.fee_paid} />
              </div>
              <div className="grid-2">
                <Input label="Distance from home to college (km)" type="number" inputMode="decimal" min="0" value={f.distance_km ?? ''} onChange={set('distance_km')} error={errors.distance_km} />
                <Input label="What do you want to become?" hi="आप क्या बनना चाहते हैं?" value={f.career_goal || ''} onChange={set('career_goal')} />
              </div>
            </>
          )}

          {step === 3 && meta.questions.map((q) => (
            <Choices key={q.key} name={`q_${q.key}`} legend={q.en} hi={q.hi} weight={q.weight} required
              options={q.options.map((o) => ({ value: o.key, label: o.en, sub: o.hi }))}
              value={answers[q.key]} error={errors[`q_${q.key}`]}
              onChange={(v) => { setAnswers((a) => ({ ...a, [q.key]: v })); setErrors((x) => ({ ...x, [`q_${q.key}`]: undefined })); }} />
          ))}

          {step === 4 && (
            <>
              <Choices name="support" legend="What support do you need?" hi="किस प्रकार की मदद चाहिए?" required multiple
                options={meta.supportTypes.map((t) => ({ value: t.key, label: t.en, sub: t.hi }))} value={f.support || []} onChange={set('support')} error={errors.support} />
              <div className="grid-2">
                <Input label="Total amount needed this year (₹)" required type="number" inputMode="numeric" min="500" step="100" value={f.amount_requested ?? ''} onChange={set('amount_requested')} error={errors.amount_requested} help="Fees still to pay, plus any device or books." />
                <Input label="Scholarships you already get" hi="अन्य छात्रवृत्ति" value={f.other_benefits || ''} onChange={set('other_benefits')} help="Name and amount, or leave blank." />
              </div>
              <div className={cx('field', errors.story && 'has-error')}>
                <label htmlFor="story" className="req">Your story <span className="hi" lang="hi">/ आपकी कहानी</span></label>
                <p className="field-help" style={{ marginTop: 0 }}>Your family, what has been hard, what you're proud of, and what you want to become. The committee reads every word. Hindi or Kannada is fine.</p>
                <textarea id="story" rows={8} maxLength={4000} value={f.story || ''} onChange={set('story')} aria-invalid={!!errors.story} />
                <div className={cx('counter', (f.story || '').trim().length >= 150 && 'ok')}>
                  {(f.story || '').trim().length >= 150 ? `${(f.story || '').trim().length} characters` : `${(f.story || '').trim().length} / 150 characters minimum`}
                </div>
                {errors.story && <div className="field-error">{errors.story}</div>}
              </div>
            </>
          )}

          {step === 5 && (
            <div className="slots">
              {docs.map((d) => (
                <FileSlot key={d.key} label={d.label} required={d.required} accept="image/*,application/pdf" capture={d.key === 'photo' || d.key === 'visit_photo' ? 'environment' : undefined}
                  file={files[d.key]} progress={submitting?.progress?.[d.key]} onPick={(file) => setFiles((x) => ({ ...x, [d.key]: file }))} />
              ))}
            </div>
          )}

          {step === 6 && (
            <>
              <ol className="script">{meta.videoQuestions.map((q) => <li key={q}>{q}</li>)}</ol>
              <FileSlot label="Upload the video" required accept="video/*" capture="environment" file={files.video} progress={submitting?.progress?.video}
                onPick={(file) => setFiles((x) => ({ ...x, video: file }))} />
              <p className="field-help">Videos stay private. Only Takshashila staff can watch them. Up to 250 MB.</p>
              {onBehalf && (
                <div className="field geo">
                  <span className="label">Home visit location</span>
                  <div className="row">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
                      if (!navigator.geolocation) return setGeo('This browser cannot share location.');
                      setGeo('Finding location…');
                      navigator.geolocation.getCurrentPosition(
                        (p) => { setF((x) => ({ ...x, visit_lat: p.coords.latitude, visit_lng: p.coords.longitude })); setGeo(`Saved: ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`); },
                        () => setGeo('Location blocked. Allow location access and try again.'), { enableHighAccuracy: true, timeout: 15000 });
                    }}>Use my current location</button>
                    <span className="muted small">{geo || 'Not recorded'}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 7 && (
            <>
              <dl className="review">
                {[
                  ['Name', f.full_name], ['Aadhaar', f.aadhaar ? `XXXX XXXX ${digits(f.aadhaar).slice(-4)}` : ''],
                  ['Studying', [f.course, f.institution].filter(Boolean).join(', ')], ['Location', [f.village, f.district, f.state].filter(Boolean).join(', ')],
                  ['Last exam', f.last_percentage ? `${f.last_percentage}%` : ''], ['Fee per year', f.annual_fee ? inr(f.annual_fee) : ''],
                  ['Support', (f.support || []).map((k) => meta.supportTypes.find((t) => t.key === k)?.en).join(', ')],
                  ['Amount needed', f.amount_requested ? inr(f.amount_requested) : ''], ['Need score', `${Math.round(need)} / 100`],
                  ['Files attached', `${docs.filter((d) => files[d.key]).length + (files.video ? 1 : 0)} of ${docs.length + 1}`],
                ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="text-warn">Missing</span>}</dd></div>)}
              </dl>
              <label className={cx('consent', errors.consent && 'has-error')}>
                <input type="checkbox" checked={!!f.consent} onChange={(e) => { setF((x) => ({ ...x, consent: e.target.checked })); setErrors((x) => ({ ...x, consent: undefined })); }} />
                <span>I confirm these details are true. My parent or guardian agrees to this application. I agree to a home visit, and to share marks and attendance every semester if selected.</span>
              </label>
              {errors.consent && <div className="field-error">{errors.consent}</div>}
            </>
          )}

          <div className="sheet-foot">
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)} style={{ visibility: step ? 'visible' : 'hidden' }}>Back</button>
            {step < STEPS.length - 1
              ? <button type="button" className="btn" onClick={next}>Save and continue</button>
              : <button type="submit" className="btn btn-gold" disabled={!!submitting}>{submitting ? (submitting.phase === 'saving' ? 'Saving…' : 'Uploading files…') : 'Submit application'}</button>}
          </div>
        </div>
      </form>
    </div>
  );
}