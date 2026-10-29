import { useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ArchGauge, Avatar, Badge, ErrorNote, FileSlot, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, inr, niceDate, uploadFile } from '../../lib.js';
import { Link } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

const ACTION = { submitted: 'Application submitted', forwarded: 'Verified and sent to manager', approved: 'Approved', rejected: 'Rejected', sent_back: 'Sent back to field' };

function Decision({ a, missing, onDone }) {
  const { notify } = useApp();
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState(a.amount_requested);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState({});
  const isField = a.status === 'submitted';

  const act = async (action) => {
    if ((action === 'reject' || action === 'send_back') && !comment.trim()) {
      setErr({ comment: action === 'reject' ? 'Write the reason first. The student will see it.' : 'Say what the field executive should fix.' });
      return;
    }
    setBusy(action); setErr({});
    try {
      await api.post(`/api/staff/applications/${a.id}/decision`, { action, comment, amount });
      notify({ forward: 'Sent to the program manager.', approve: 'Approved. Raise a scholarship payment when the fee demand is ready.', send_back: 'Sent back to the field executive.', reject: 'Application closed. The student will see your reason.' }[action]);
      onDone();
    } catch (e) { setErr(e.fields || {}); notify(e.message, 'error'); } finally { setBusy(null); }
  };

  return (
    <Panel className="decision" title={isField ? 'Field verification' : 'Committee decision'}
      aside={isField ? null : `Asked for ${inr(a.amount_requested)}, fee ${inr(a.annual_fee)} a year`}>
      {isField && (missing.length
        ? <p><span className="text-warn">Pending:</span> {missing.join(', ')}. Upload these below before sending to the manager.</p>
        : <p className="text-ok">All required documents and the video are in.</p>)}
      {!isField && (
        <div className={cx('field', 'amount-field', err.amount && 'has-error')}>
          <label htmlFor="amt">Amount to sanction (₹)</label>
          <input id="amt" type="number" min="500" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {err.amount && <div className="field-error">{err.amount}</div>}
        </div>
      )}
      <div className={cx('field', err.comment && 'has-error')}>
        <label htmlFor="cm">Comments</label>
        <textarea id="cm" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={isField ? 'What you saw during the home visit' : 'Reason for your decision. Shown to the student if rejected.'} />
        {err.comment && <div className="field-error">{err.comment}</div>}
      </div>
      <div className="row">
        {isField
          ? <button className="btn" disabled={!!busy || missing.length > 0} onClick={() => act('forward')}>{busy === 'forward' ? 'Sending…' : 'Submit to manager'}</button>
          : <>
            <button className="btn btn-gold" disabled={!!busy} onClick={() => act('approve')}>{busy === 'approve' ? 'Approving…' : 'Approve and sanction'}</button>
            <button className="btn btn-ghost" disabled={!!busy} onClick={() => act('send_back')}>Send back to field</button>
          </>}
        <button className="btn btn-danger push" disabled={!!busy} onClick={() => act('reject')}>Reject</button>
      </div>
    </Panel>
  );
}

export default function ApplicationDetail({ id }) {
  const { auth, notify, meta } = useApp();
  const { data, loading, error, reload } = useApi(`/api/staff/applications/${id}`);
  const [pick, setPick] = useState({});
  const [progress, setProgress] = useState({});
  const [saving, setSaving] = useState(false);
  useTitle(data?.application?.full_name || 'Application');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const { application: a, student, mobilizer, checklist, missing, extraDocs, breakdown, reviews, payments, renewals, schemes } = data;
  const role = auth.user.role;
  const canDecide = a.status === 'submitted' || (a.status === 'field_verified' && ['manager', 'admin'].includes(role));
  const video = checklist.find((c) => c.key === 'video')?.doc;
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const saveFiles = async () => {
    setSaving(true);
    for (const [key, file] of Object.entries(pick)) {
      if (!file) continue;
      try { await uploadFile(a.id, key, file, (p) => setProgress((x) => ({ ...x, [key]: p }))); } catch (e) { notify(e.message, 'error'); }
    }
    setSaving(false); setPick({}); setProgress({});
    notify('Files saved.');
    reload();
  };
  const saveLocation = () => navigator.geolocation?.getCurrentPosition(async (p) => {
    await api.patch(`/api/staff/applications/${a.id}/visit`, { lat: p.coords.latitude, lng: p.coords.longitude });
    notify('Visit location saved.'); reload();
  }, () => notify('Location blocked. Allow location access and try again.', 'error'));
  const renew = async (rid) => { await api.post(`/api/staff/renewals/${rid}`, { status: 'accepted' }); notify('Renewed.'); reload(); };

  return (
    <>
      <PageHead crumb={['/staff/applications', 'All applications']} title={
        <span className="title-who"><Avatar name={a.full_name} size="lg" />{a.full_name}</span>}
        sub={`${a.code}, ${a.project}. ${a.course}, ${a.institution}, ${a.district}`}>
        <Badge status={a.status} />
      </PageHead>

      <div className="cols">
        <div className="col-main">
          {canDecide && <Decision a={a} missing={missing} onDone={reload} />}
          {['approved', 'disbursed'].includes(a.status) && (
            <Panel tone="ok">
              <div className="spread">
                <div><h3 className="flush">{inr(a.amount_sanctioned)} sanctioned</h3><span className="muted small">{inr(paid)} paid so far</span></div>
                <Link className="btn" to={`/staff/payments?app=${a.id}#new`}>Raise a payment</Link>
              </div>
            </Panel>
          )}

          <Panel title="Student's story">
            <blockquote className="story">{a.story}</blockquote>
            <div className="tags mt">{a.support_types.map((k) => <span className="tag" key={k}>{meta.supportTypes.find((t) => t.key === k)?.en || k}</span>)}</div>
          </Panel>

          <Panel id="documents" title="Documents and video" aside={<span className={missing.length ? 'text-warn' : 'text-ok'}>{missing.length ? `${missing.length} pending` : 'Complete'}</span>}>
            <div className="thumbs">
              {checklist.filter((c) => c.key !== 'video').map((c) => c.doc ? (
                <a key={c.key} className="thumb" href={`/api/files/${c.doc.id}`} target="_blank" rel="noopener noreferrer">
                  <span className="thumb-img">{c.doc.mime?.startsWith('image') ? <img src={`/api/files/${c.doc.id}`} alt="" loading="lazy" /> : <span>PDF</span>}</span>
                  <span className="thumb-cap">{c.label}</span>
                </a>
              ) : (
                <div key={c.key} className={cx('thumb', c.required ? 'missing' : 'optional')}><span className="thumb-img">{c.required ? 'Pending' : 'Optional'}</span><span className="thumb-cap">{c.label}</span></div>
              ))}
              {extraDocs.map((d) => <a key={d.id} className="thumb" href={`/api/files/${d.id}`} target="_blank" rel="noopener noreferrer"><span className="thumb-img"><span>File</span></span><span className="thumb-cap">{d.doc_type.replace(/_/g, ' ')}</span></a>)}
            </div>
            <div className="mt">
              <span className="label">Video interview</span>
              {!video ? <p className="text-warn">Not uploaded yet</p>
                : video.mime?.startsWith('video') ? <video className="video" controls preload="metadata" src={`/api/files/${video.id}`} />
                : <p className="muted">This file can't be previewed. <a href={`/api/files/${video.id}`} target="_blank" rel="noopener noreferrer">Open it</a> or upload a new video below.</p>}
            </div>
            {['submitted', 'field_verified'].includes(a.status) && (
              <details className="disclose mt" open={missing.length > 0}>
                <summary>Upload or replace files</summary>
                <div className="slots">
                  {checklist.map((c) => (
                    <FileSlot key={c.key} label={c.label} required={c.required} accept={c.video ? 'video/*' : 'image/*,application/pdf'}
                      uploaded={!!c.doc} file={pick[c.key]} progress={progress[c.key]} onPick={(file) => setPick((x) => ({ ...x, [c.key]: file }))} />
                  ))}
                </div>
                <div className="row mt">
                  <button className="btn" disabled={saving || !Object.values(pick).some(Boolean)} onClick={saveFiles}>{saving ? 'Saving…' : 'Save files'}</button>
                  <button className="btn btn-ghost" onClick={saveLocation}>Record visit location</button>
                  {a.visit_lat && <span className="muted small">Saved: {a.visit_lat.toFixed(4)}, {a.visit_lng.toFixed(4)}</span>}
                </div>
              </details>
            )}
          </Panel>

          <Panel title="How the need score was built" aside={<Link to="/staff/scoring">Scoring rules</Link>}>
            <div className="table-wrap flat">
              <table className="data compact">
                <thead><tr><th>Question</th><th>Answer</th><th className="num">Points</th></tr></thead>
                <tbody>
                  {breakdown.map((r) => <tr key={r.question}><td>{r.question}</td><td>{r.answer}</td><td className="num">{r.points} <span className="muted">/ {r.weight}</span></td></tr>)}
                  <tr className="total"><td colSpan={2}>Need score</td><td className="num">{a.need_score} <span className="muted">/ 100</span></td></tr>
                </tbody>
              </table>
            </div>
          </Panel>

          {renewals.length > 0 && (
            <Panel id="renewals" title="Semester renewals">
              <ul className="list">
                {renewals.map((r) => (
                  <li key={r.id}>
                    <span><b>{r.semester}</b> <span className="muted small">marks {r.marks}%, attendance {r.attendance}%{r.receipt_doc_id ? <>, <a href={`/api/files/${r.receipt_doc_id}`} target="_blank" rel="noopener noreferrer">receipt</a></> : null}</span></span>
                    <span className="row tight"><Badge status={r.status}>{{ pending: 'To review', accepted: 'Renewed', at_risk: 'At risk' }[r.status]}</Badge>
                      {['manager', 'admin'].includes(role) && r.status !== 'accepted' && <button className="btn btn-sm" onClick={() => renew(r.id)}>Renew</button>}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="col-side">
          <Panel className="gauge-panel">
            <ArchGauge value={a.need_score} />
            <div><p className="big-num">{Math.round(a.final_score)} <span>overall</span></p>
              <p className="muted small">Need {Math.round(a.need_score)} × 70% + marks {Math.round(a.merit_score)} × 30%</p></div>
          </Panel>

          <Panel title="Profile">
            <dl className="kv">
              <dt>Phone</dt><dd><a href={`tel:${student.phone}`}>{student.phone}</a></dd>
              {a.alt_phone && <><dt>Alternate</dt><dd>{a.alt_phone} ({a.alt_phone_owner || 'unknown'})</dd></>}
              <dt>Aadhaar</dt><dd>XXXX XXXX {a.aadhaar_last4}</dd>
              <dt>Gender, DOB</dt><dd>{a.gender}, {niceDate(a.dob)}</dd>
              <dt>Address</dt><dd>{[a.address, a.village, a.district, a.state, a.pin].filter(Boolean).join(', ')}</dd>
              {a.visit_lat && <><dt>Visit</dt><dd><a href={`https://maps.google.com/?q=${a.visit_lat},${a.visit_lng}`} target="_blank" rel="noopener noreferrer">Open on map</a></dd></>}
              <dt>Mobilizer</dt><dd>{mobilizer?.name || 'Self-applied'}</dd>
              <dt>Level</dt><dd>{a.level}{a.study_year ? `, ${a.study_year}` : ''}</dd>
              <dt>Last exam</dt><dd>{a.last_percentage}%</dd>
              <dt>Annual fee</dt><dd>{inr(a.annual_fee)} ({inr(a.fee_paid)} paid)</dd>
              {a.distance_km ? <><dt>Distance</dt><dd>{a.distance_km} km to college</dd></> : null}
              <dt>Goal</dt><dd>{a.career_goal || '—'}</dd>
              <dt>Other aid</dt><dd>{a.other_benefits || 'None'}</dd>
            </dl>
          </Panel>

          <Panel title="History">
            <ul className="timeline">
              {reviews.map((r) => (
                <li key={r.id}><b>{ACTION[r.action]}{r.amount ? `, ${inr(r.amount)}` : ''}</b>
                  <div className="when">{r.actor_name || 'Student'}, {niceDate(r.created_at, true)}</div>
                  {r.comment && <div className="said">{r.comment}</div>}</li>
              ))}
            </ul>
          </Panel>

          {payments.length > 0 && (
            <Panel title="Payments">
              <ul className="list">{payments.map((p) => <li key={p.id}><span>{p.payee}<br /><span className="muted small">{p.purpose || p.kind}</span></span><span className="right">{inr(p.amount)}<br /><Badge status={p.status}>{p.status}</Badge></span></li>)}</ul>
            </Panel>
          )}
          {schemes.length > 0 && (
            <Panel title="Govt schemes to suggest">
              <ul className="list">{schemes.map((s) => <li key={s.name}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
