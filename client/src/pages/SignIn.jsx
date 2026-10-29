import { useEffect, useRef, useState } from 'react';
import { ErrorNote, Icon, Spinner, useTitle } from '../components/ui.jsx';
import { api, homeFor } from '../lib.js';
import { Link, navigate, useLocation } from '../router.jsx';
import { useApp } from '../state.jsx';

const RESEND_AFTER = 30; // seconds; matches the server's limit

// Copy for each portal. Students and schools get an account on first sign-in; staff accounts are created by an admin.
const PORTALS = {
  student: {
    title: 'Sign in', tag: null, side: 'signin-side',
    pitch: 'Scholarships and support, from admission to first job.',
    points: [['lock', 'Secure sign-in with a one-time code. No password needed.'], ['clock', 'Save your progress and track every step of your application.'], ['shield', 'Your documents are private and visible only to programme staff.']],
    intro: 'Enter your mobile number. New applicants get an account created automatically.',
    foot: 'Need help? Call 1800-000-0000, Mon–Sat, 9am–6pm.',
  },
  school: {
    title: 'School sign in', tag: 'School portal', side: 'signin-side signin-side-school',
    pitch: 'Better classrooms: desks, fans, clean water and safe toilets for your school.',
    points: [['school', 'Request furniture, electricals, water, sanitation and repairs.'], ['bank', 'We pay vendors directly. Your school never handles money.'], ['camera', 'Track every step and confirm delivery with photos.']],
    intro: "Enter the headmaster's or SDMC member's mobile number. New schools are registered on first sign-in.",
    foot: 'For government, aided and low-fee private schools in our districts.',
  },
  staff: {
    title: 'Staff sign in', tag: 'Staff portal', side: 'signin-side signin-side-staff',
    pitch: 'Review applications, approve payments and track every student.',
    points: [['list', 'Ranked queues for student applications and school requests.'], ['rupee', 'Maker-checker payments with bank UTR records.'], ['shield', 'Access is limited to your role and district.']],
    intro: 'Enter the mobile number registered for your staff account.',
    foot: 'Accounts are created by your administrator.',
  },
};

export default function SignIn({ portal = 'student' }) {
  const P = PORTALS[portal];
  useTitle(P.title);
  const { query } = useLocation();
  const { auth, setAuth, meta } = useApp();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [code, setCode] = useState('');
  const [testCode, setTestCode] = useState(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const verifying = useRef(false);
  const leaving = useRef(false);

  // Already signed in: go straight to the right dashboard.
  useEffect(() => {
    if (!auth.loading && auth.user && !leaving.current) navigate(homeFor(auth), { replace: true });
  }, [auth]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const requestCode = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.post('/api/auth/otp', { phone, portal });
      setTestCode(r.demoCode || null);
      setStep('code'); setCode(''); setWait(RESEND_AFTER);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const verify = async (value = code) => {
    if (verifying.current || value.length !== 6) return;
    verifying.current = true;
    setBusy(true); setError(null);
    try {
      const r = await api.post('/api/auth/verify', { phone, code: value, portal });
      const next = query.get('next');
      const home = homeFor(r);
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('sign-in') ? next : null;
      const area = { student: '/', school: '/school', field: '/staff', manager: '/staff', admin: '/staff' }[r.user.role];
      const allowed = safeNext && (r.user.role === 'student'
        ? !safeNext.startsWith('/staff') && !safeNext.startsWith('/school') && !(safeNext === '/apply' && r.hasApplication)
        : safeNext.startsWith(area));
      leaving.current = true;
      setAuth({ loading: false, user: r.user, hasApplication: r.hasApplication });
      navigate(allowed ? safeNext : home, { replace: true });
    } catch (err) { setError(err); setCode(''); } finally { setBusy(false); verifying.current = false; }
  };

  if (auth.loading || auth.user) return <div className="center-screen"><Spinner /></div>;
  const shownPhone = phone.replace(/\D/g, '').slice(-10).replace(/(\d{5})(\d{5})/, '$1 $2');
  const tests = portal !== 'student' && meta?.demoMode
    ? (meta.testAccounts || []).filter((t) => (portal === 'school' ? t.role === 'school' : t.role !== 'school')) : [];

  return (
    <div className="signin">
      <aside className={P.side}>
        <div>
          {P.tag && <span className="portal-tag">{P.tag}</span>}
          <h2>{P.pitch}</h2>
          <ul>{P.points.map(([icon, text]) => <li key={text}><Icon name={icon} />{text}</li>)}</ul>
        </div>
        <p>{P.foot}</p>
      </aside>

      <div className="signin-main">
        <div className="signin-card">
          {step === 'phone' ? (
            <form onSubmit={(e) => { e.preventDefault(); requestCode(); }} noValidate>
              <h1>{P.title}</h1>
              <p className="muted">{P.intro}</p>
              <ErrorNote error={error} />
              <div className="field">
                <label htmlFor="phone">Mobile number{portal !== 'staff' && <span className="hi" lang="hi"> / मोबाइल नंबर</span>}</label>
                <div className="input-prefix">
                  <span>+91</span>
                  <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210"
                    value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus required />
                </div>
              </div>
              <button className="btn btn-lg btn-block" disabled={busy || phone.replace(/\D/g, '').length < 10}>{busy ? 'Sending…' : 'Send verification code'}</button>
              {tests.length > 0 && (
                <div className="test-accounts">
                  <b>Test environment accounts</b>
                  {tests.map((t) => (
                    <button type="button" key={t.phone} onClick={() => setPhone(t.phone)}>
                      <span>{t.name}</span><span>{meta.roles[t.role]}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="signin-switch">
                {portal !== 'student' && <Link to="/sign-in">Student sign in</Link>}
                {portal !== 'school' && <Link to="/school/sign-in">School portal</Link>}
                {portal !== 'staff' && <Link to="/staff/sign-in">Staff portal</Link>}
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
              <h1>Verify your number</h1>
              <p className="muted">Enter the 6-digit code sent to +91 {shownPhone}. It expires in 5 minutes.</p>
              {testCode && <p className="test-code"><b>Test environment:</b> SMS is disabled. Use code <code>{testCode}</code></p>}
              <ErrorNote error={error} />
              <div className="field">
                <label htmlFor="code">Verification code</label>
                <input id="code" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
                  value={code} disabled={busy} autoFocus required
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) verify(v); }} />
              </div>
              <button className="btn btn-lg btn-block" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
              <div className="signin-alt">
                <button type="button" className="linkish" onClick={() => { setStep('phone'); setError(null); setCode(''); setTestCode(null); }}>Change number</button>
                {wait > 0
                  ? <span className="muted">Resend code in {wait}s</span>
                  : <button type="button" className="linkish" disabled={busy} onClick={requestCode}>Resend code</button>}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
