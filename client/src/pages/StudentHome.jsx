import { useState } from 'react';
import { Panel } from '../components/layout.jsx';
import { ArchGauge, Avatar, Badge, Empty, ErrorNote, FileSlot, Input, Spinner, useTitle } from '../components/ui.jsx';
import { api, cx, inr, niceDate, uploadFile } from '../lib.js';
import { Link } from '../router.jsx';
import { useApi, useApp } from '../state.jsx';

const STEP_NOTE = {
  submitted: 'Application received',
  field_verified: 'Home visit and documents checked',
  approved: 'Committee decision',
  disbursed: 'Fees paid to your college',
};

const ACTION = { submitted: 'Application submitted', forwarded: 'Verified by field executive', approved: 'Approved by the committee', rejected: 'Not selected', sent_back: 'Sent back for more checks' };
export default function StudentHome() {
  useTitle('My application');
  const { meta, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/me/application');
  const [pending, setPending] = useState({});
  const [progress, setProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  const [rn, setRn] = useState({ semester: '', marks: '', attendance: '' });
  const [rnFile, setRnFile] = useState(null);
  const [rnErr, setRnErr] = useState({});
  const [rnBusy, setRnBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data.application) {
    return <Empty title="You haven't applied yet" action={<Link className="btn" to="/apply">Start your application</Link>}>It takes about 20 minutes. Keep your Aadhaar and latest marksheet ready.</Empty>;
  }
  const { application: a, checklist, missing, reviews, payments, renewals, trainings, opportunities, schemes, received } = data;
  const flow = meta.statusFlow;
  const idx = flow.indexOf(a.status);
  const first = a.full_name.split(' ')[0];

  const uploadMissing = async () => {
    setUploading(true);
    let ok = 0;
    for (const [key, file] of Object.entries(pending)) {
      if (!file) continue;
      try {
        await uploadFile(a.id, key, file, (p) => setProgress((x) => ({ ...x, [key]: p })));
        ok += 1;
      } catch (e) { notify(e.message, 'error'); }
    }
    setUploading(false); setPending({}); setProgress({});
    if (ok) notify(`Uploaded ${ok} file${ok > 1 ? 's' : ''}.`);
    reload();
  };//kalaipriyan  

  const sendRenewal = async (e) => {
    e.preventDefault();
    setRnBusy(true); setRnErr({});
    try {
      let receiptDocId;
      if (rnFile) receiptDocId = (await uploadFile(a.id, `receipt_${rn.semester.replace(/[^\w-]+/g, '-').slice(0, 30) || 'term'}`, rnFile)).id;
      const r = await api.post('/api/me/renewals', { ...rn, receiptDocId });
      notify(r.status === 'at_risk'
        ? 'Sent. Your marks or attendance are below the renewal limit, so your field executive will call you to plan support.'
        : 'Semester details sent. Your program manager will review them.', r.status === 'at_risk' ? 'warn' : 'success');
      setRn({ semester: '', marks: '', attendance: '' }); setRnFile(null);
      reload();
    } catch (err) { setRnErr(err.fields || {}); notify(err.message, 'error'); } finally { setRnBusy(false); }
  };

  const headline = {
    submitted: 'Next, a field executive will visit your home within 7 days.',
    field_verified: 'Your visit is done. The program manager is reviewing your application.',
    approved: `You're selected. ${inr(a.amount_sanctioned)} is sanctioned for you.`,
    disbursed: 'Your fees have been paid. Keep your marks and attendance up to renew.',
    rejected: 'Your application was not selected this time.',
  }[a.status];

  return (
    <>
      <section className="welcome">
        <div className="welcome-who">
          <Avatar name={a.full_name} size="xl" />
          <div>
            <h1>Namaste, {first}</h1>
            <p>{a.code}. Submitted {niceDate(a.created_at)}. <Badge status={a.status} /></p>
          </div>
        </div>
        <p className="welcome-line">{headline}</p>
        {a.status === 'rejected' ? (
          <div className="reason">
            {reviews.find((r) => r.action === 'rejected')?.comment}
            <p className="muted small">You can still apply for the government scholarships below. Applications open again next academic year.</p>
          </div>
        ) : (
          <ol className="path">
            {flow.map((st, i) => (
              <li key={st} className={cx(i < idx || (i === idx && st === 'disbursed') ? 'done' : i === idx ? 'now' : '')}>
                <b>{meta.statuses[st]}</b><span>{STEP_NOTE[st]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="cols">
        <div className="col-main">
          {missing.length > 0 && a.status === 'submitted' && (
            <Panel id="documents" tone="warn" title={`${missing.length} item${missing.length > 1 ? 's' : ''} still pending`} aside="Upload these so your application can move ahead">
              <div className="slots">
                {checklist.filter((c) => missing.includes(c.key)).map((c) => (
                  <FileSlot key={c.key} label={c.label} required accept={c.video ? 'video/*' : 'image/*,application/pdf'}
                    file={pending[c.key]} progress={progress[c.key]} onPick={(file) => setPending((p) => ({ ...p, [c.key]: file }))} />
                ))}
              </div>
              <button className="btn mt" disabled={uploading || !Object.values(pending).some(Boolean)} onClick={uploadMissing}>{uploading ? 'Uploading…' : 'Upload files'}</button>
            </Panel>
          )}
          {['approved', 'disbursed'].includes(a.status) && (
            <>
              <Panel title="Money released for you" aside={<span className="money-line"><b>{inr(received)}</b> of {inr(a.amount_sanctioned)}</span>}>
                <div className="progress-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (received / (a.amount_sanctioned || 1)) * 100)}%` }} /></div>
                {payments.length ? (
                  <div className="table-wrap flat"><table className="data">
                    <thead><tr><th>Date</th><th>Paid to</th><th>For</th><th className="num">Amount</th><th>Status</th></tr></thead>
                    <tbody>{payments.map((p) => (
                      <tr key={p.id}><td>{niceDate(p.paid_at || p.created_at)}</td><td>{p.payee}</td><td>{p.purpose || p.kind}</td><td className="num">{inr(p.amount)}</td>
                        <td><Badge status={p.status === 'paid' ? 'paid' : 'requested'}>{p.status === 'paid' ? 'Paid' : 'In process'}</Badge></td></tr>
                    ))}</tbody>
                  </table></div>
                ) : <p className="muted">Your first payment is being prepared. Ask your college for the fee demand letter and give it to your field executive.</p>}
              </Panel>
              <Panel id="renewal" title="Semester renewal" aside="To continue: 50% marks and 75% attendance">
                <form onSubmit={sendRenewal} className="grid-3" noValidate>
                  <Input label="Semester or term" required placeholder="Sem 3, 2026" value={rn.semester} onChange={(e) => setRn({ ...rn, semester: e.target.value })} error={rnErr.semester} />
                  <Input label="Marks (%)" required type="number" min="0" max="100" step="0.1" value={rn.marks} onChange={(e) => setRn({ ...rn, marks: e.target.value })} error={rnErr.marks} />
                  <Input label="Attendance (%)" required type="number" min="0" max="100" step="0.1" value={rn.attendance} onChange={(e) => setRn({ ...rn, attendance: e.target.value })} error={rnErr.attendance} />
                  <div className="span-all"><FileSlot label="Fee receipt or marksheet" accept="image/*,application/pdf" file={rnFile} onPick={setRnFile} /></div>
                  <div className="span-all"><button className="btn" disabled={rnBusy}>{rnBusy ? 'Sending…' : 'Send semester details'}</button></div>
                </form>
                {renewals.length > 0 && (
                  <ul className="list mt">
                    {renewals.map((r) => (
                      <li key={r.id}><span><b>{r.semester}</b> <span className="muted small">marks {r.marks}%, attendance {r.attendance}%</span></span>
                        <Badge status={r.status}>{{ pending: 'Under review', accepted: 'Renewed', at_risk: 'Needs attention' }[r.status]}</Badge></li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          )}
          <Panel id="opportunities" title="Internships and jobs for you" aside={`Matched to ${a.level}`}>
            {opportunities.length ? opportunities.map((o) => (
              <div className="opp" key={o.id}>
                <div><h4>{o.title}</h4><span className="muted small">{o.company}, {o.location}{o.stipend ? `. ${o.stipend}` : ''}</span></div>
                <div className="opp-side"><span className="muted small">Apply by {niceDate(o.deadline)}</span>
                  {o.link && <a className="btn btn-sm btn-ghost" href={o.link} target="_blank" rel="noopener noreferrer">View and apply</a>}</div>
              </div>
            )) : <Empty title="No openings for your course yet">New internships are posted every month. We'll message you on WhatsApp when one matches.</Empty>}
          </Panel>
          <Panel id="schemes" title="Government scholarships you may qualify for">
            {schemes.length ? schemes.map((s) => (
              <div className="opp" key={s.name}>
                <div><h4>{s.name}</h4><span className="muted small">{s.by}</span></div>
                <a className="btn btn-sm btn-ghost" href={s.url} target="_blank" rel="noopener noreferrer">Check on portal</a>
              </div>
            )) : <p className="muted">None matched your profile. See the full list on the <a href="https://scholarships.gov.in" target="_blank" rel="noopener noreferrer">National Scholarship Portal</a>.</p>}
            <p className="muted small mt">Based on your answers. Confirm eligibility and last dates on the official portal before applying.</p>
          </Panel>
        </div>
        <div className="col-side">
          <Panel className="gauge-panel">
            <ArchGauge value={a.need_score} size="md" />
            <div>
              <p className="big-num">{Math.round(a.final_score)} <span>overall</span></p>
              <p className="muted small">Need {Math.round(a.need_score)}, marks {Math.round(a.merit_score)}. Need counts for 70%.</p>
            </div>
          </Panel>
          <Panel title="What you asked for">
            <div className="tags">{a.support_types.map((k) => <span className="tag" key={k}>{meta.supportTypes.find((t) => t.key === k)?.en || k}</span>)}</div>
            <dl className="kv mt"><dt>Amount</dt><dd>{inr(a.amount_requested)}</dd><dt>Studying</dt><dd>{a.course}, {a.institution}</dd></dl>
          </Panel>
          <Panel title="Your documents">
            <ul className="list">
              {checklist.map((c) => (
                <li key={c.key}><span>{c.label}</span>{c.uploaded ? <span className="text-ok small">Uploaded</span> : c.required ? <span className="text-warn small">Pending</span> : <span className="muted small">Optional</span>}</li>
              ))}
            </ul>
          </Panel>
          {trainings.length > 0 && (
            <Panel title="Training sessions">
              <ul className="list">{trainings.map((t) => (
                <li key={t.id}><span><b>{t.title}</b><br /><span className="muted small">{niceDate(t.held_on)}, {t.venue}</span></span>
                  <span className={cx('small', t.present ? 'text-ok' : 'muted')}>{t.present ? 'Attended' : 'Invited'}</span></li>
              ))}</ul>
            </Panel>
          )}
          <Panel title="Updates">
            <ul className="timeline">
              {reviews.map((r, i) => (
                <li key={i}><b>{ACTION[r.action]}</b>
                  <div className="when">{niceDate(r.created_at, true)}{r.actor_role !== 'student' ? `, ${r.actor_name}` : ''}</div>
                  {r.comment && <div className="said">{r.comment}</div>}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
