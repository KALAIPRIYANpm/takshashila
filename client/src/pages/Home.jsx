import { Icon, useTitle } from '../components/ui.jsx';
import { inr } from '../lib.js';
import { Link } from '../router.jsx';
import { useApi } from '../state.jsx';

const OFFER = [
  ['rupee', 'Scholarship for fees', 'Tuition, exam and hostel fees, paid directly to your school or college.'],
  ['laptop', 'Laptop, tablet or books', 'Bought from a local vendor and handed to you, with the bill in your name.'],
  ['class', 'Skill training', 'Spoken English, computers, coding and interview practice near your district.'],
  ['user', 'A mentor', 'A professional in your field calls you every month and helps you plan.'],
  ['brief', 'Internships and jobs', 'Openings from partner companies, shown only when they fit your course.'],
  ['bank', 'Government scholarships', 'We check which public schemes you qualify for and remind you before deadlines.'],
];

const JOURNEY = [
  ['Sign in with your phone', 'A 6-digit code by SMS. No password to remember.'],
  ['Complete the application', 'Your studies, your family, and what you want to become.'],
  ['Upload documents and a video', 'Clear phone photos are fine, plus a short video interview.'],
  ['Home visit', 'A field executive meets you and your family within 7 days.'],
  ['Committee review', 'Applications are ranked by financial need first, then marks.'],
  ['Fees paid, support begins', 'Money goes to your institution. Training and mentoring start.'],
  ['Renew each semester', 'Share marks, attendance and the fee receipt to continue.'],
];

const DOCS = ['Aadhaar card, front and back', 'Latest marksheet', 'Income certificate', 'Admission letter or bonafide certificate',
  'Fee structure from your institution', 'Bank passbook', 'Caste or disability certificate, if applicable', 'A recent photograph'];

const FAQ = [
  ['Is there a fee to apply?', 'No. Applying is completely free. Takshashila staff will never ask you for money at any stage. If anyone does, call the helpline.'],
  ['How long does the application take?', 'About 20 minutes on a phone. You can upload any missing documents later from your account.'],
  ['Who decides if I am selected?', 'A field executive verifies your details at a home visit, then a programme committee reviews your application. Financial need carries 70% of the score and marks 30%.'],
  ['Where does the scholarship money go?', 'Fees are paid directly to your school or college. Devices and books are bought from a vendor and handed over to you with the bill.'],
  ['Can someone help me fill the form?', 'Yes. Your district field executive can register you and complete the application with you and a parent.'],
  ['Can my school get help too?', 'Yes. Headmasters or SDMC members can request furniture, fans, drinking water, toilet repairs and other essentials from the school portal. Requests are verified on site and the vendor is paid directly.'],
  ['Do I need to re-apply every year?', 'No. Selected students renew each semester by sharing marks, attendance and the fee receipt from their account.'],
];

export default function Home() {
  useTitle('Scholarships and support for students');
  const { data } = useApi('/api/public/stats');

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Admissions open for {new Date().getFullYear()}–{String(new Date().getFullYear() + 1).slice(2)}</span>
            <h1>No student should stop studying because of money.</h1>
            <p className="lede">Takshashila pays school and college fees for students from low-income families, and supports them with devices, training and mentoring until their first job.</p>
            <div className="hero-actions">
              <Link className="btn btn-lg" to="/sign-in?next=/apply">Start your application <Icon name="arrow" /></Link>
              <Link className="btn btn-lg btn-ghost" to="/sign-in">Track an application</Link>
            </div>
            <ul className="hero-points">
              <li><Icon name="check" />Free to apply</li>
              <li><Icon name="clock" />About 20 minutes</li>
              <li><Icon name="phone" />Works on any phone</li>
            </ul>
          </div>

          <aside className="impact" aria-label="Programme figures">
            <div className="impact-head">
              <span>Programme at a glance</span>
              <span className="live-dot">Live</span>
            </div>
            <dl className="impact-grid">
              <div><dt>Applications received</dt><dd>{data ? data.applied.toLocaleString('en-IN') : '—'}</dd></div>
              <div><dt>Students supported</dt><dd>{data ? data.students.toLocaleString('en-IN') : '—'}</dd></div>
              <div><dt>Districts covered</dt><dd>{data ? data.districts : '—'}</dd></div>
              <div><dt>Paid to institutions</dt><dd>{data ? inr(data.paid) : '—'}</dd></div>
            </dl>
            <div className="impact-foot">
              <Icon name="shield" />
              <p>Every payment goes directly to the institution or vendor and needs two separate approvals.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="trust">
        <div className="wrap trust-row">
          <span><Icon name="lock" />Aadhaar stored as a protected hash</span>
          <span><Icon name="shield" />Consent-based data handling (DPDP Act)</span>
          <span><Icon name="bank" />Direct payment to institutions</span>
          <span><Icon name="check" />Need-based, transparent scoring</span>
        </div>
      </section>

      <section className="section" id="offer">
        <div className="wrap">
          <div className="section-intro">
            <span className="eyebrow">Support</span>
            <h2>What you can apply for</h2>
            <p>Choose what you need when you apply. Most students ask for two or three kinds of support.</p>
          </div>
          <ul className="offer-cards">
            {OFFER.map(([icon, t, d]) => (
              <li key={t}><span className="offer-icon"><Icon name={icon} /></span><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-alt" id="journey">
        <div className="wrap">
          <div className="section-intro">
            <span className="eyebrow">Process</span>
            <h2>From application to first job</h2>
            <p>Apply on your own, or ask your district field executive to fill it in with you.</p>
          </div>
          <ol className="journey">
            {JOURNEY.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="section" id="documents">
        <div className="wrap split">
          <div className="section-intro">
            <span className="eyebrow">Before you start</span>
            <h2>Keep these documents ready</h2>
            <p>Phone photos are accepted as long as every word is readable. You can upload missing documents after submitting.</p>
          </div>
          <ul className="checklist">
            {DOCS.map((d) => <li key={d}><Icon name="check" />{d}</li>)}
          </ul>
        </div>
      </section>

      <section className="section section-schools" id="schools">
        <div className="wrap split">
          <div className="section-intro">
            <span className="eyebrow">For schools</span>
            <h2>Better classrooms for every child</h2>
            <p>Government, aided and low-fee private schools can request desks, fans and lights, clean drinking water, toilet repairs, ramps, books and more. We verify on site and pay the vendor directly.</p>
            <div className="hero-actions">
              <Link className="btn btn-lg" to="/school/sign-in">Request for your school <Icon name="arrow" /></Link>
            </div>
            {data && data.schools > 0 && (
              <p className="fine">{data.schools} school{data.schools === 1 ? '' : 's'} supported so far{data.schoolStudents ? `, reaching ${data.schoolStudents.toLocaleString('en-IN')} students` : ''}.</p>
            )}
          </div>
          <ol className="school-steps">
            {[
              ['school', 'Register your school', "Sign in with the headmaster's or SDMC member's phone and add your UDISE code."],
              ['list', 'List what you need', 'Pick from benches, tables, fans, water purifiers, toilet repairs and more, or add your own items.'],
              ['camera', 'Add photos', 'Show the current condition. A field executive visits to verify.'],
              ['bank', 'We pay the vendor', 'After approval, payment goes directly to the supplier. No money passes through the school.'],
              ['truck', 'Confirm delivery', 'Upload photos of the items in use. Every rupee is accounted for.'],
            ].map(([icon, t, d]) => (
              <li key={t}><span className="offer-icon"><Icon name={icon} /></span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-alt" id="faq">
        <div className="wrap split">
          <div className="section-intro">
            <span className="eyebrow">FAQ</span>
            <h2>Common questions</h2>
            <p>Can't find your answer? Call the helpline at 1800-000-0000, Monday to Saturday.</p>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta-row">
          <div>
            <h2>Ready to apply?</h2>
            <p>Sign in with your mobile number to start. Your progress is saved to your account.</p>
          </div>
          <Link className="btn btn-lg btn-light" to="/sign-in?next=/apply">Start your application <Icon name="arrow" /></Link>
        </div>
      </section>
    </>
  );
}
