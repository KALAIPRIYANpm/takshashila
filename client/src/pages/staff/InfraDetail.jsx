import { useState } from 'react';
import { DocGallery, InfraBadge, InfraPath, InfraTimeline, InfraUpload, ItemsTable, PriorityBreakdown } from '../../components/infra.jsx';
import { GapList, LocationMap, SchoolFacts, SchoolPhotos } from '../../components/school.jsx';
import { PageHead, Panel } from '../../components/layout.jsx';
import { Badge, ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, inr, niceDate } from '../../lib.js';
import { Link } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

function Decision({ r, documents, onDone }) {
  const { auth, notify } = useApp();
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState(r.estimate);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState({});
  const isManager = ['manager', 'admin'].includes(auth.user.role);
  const stage = r.status;

  const act = async (action) => {
    setBusy(action); setErr({});
    try {
      await api.post(`/api/staff/infra/${r.id}/decision`, { action, comment, amount });
      notify({
        verify: 'Site visit recorded. Sent to the committee.', approve: 'Approved. Raise the vendor payment when the quotation is ready.',
        send_back: 'Sent back to the field executive.', reject: 'Request closed. The school will see your reason.', delivered: 'Delivery confirmed.',
      }[action]);
      onDone();
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(null); }
  };

  if (stage === 'verified' && !isManager) {
    return <Panel tone="ok"><p className="flush">Site visit recorded. Waiting for the programme manager's decision.</p></Panel>;
  }
  const hasDelivery = documents.some((d) => d.kind === 'delivery');
  return (
    <Panel className="decision" title={{ submitted: 'Site verification', verified: 'Committee decision', ordered: 'Delivery' }[stage]}
      aside={stage === 'verified' ? `Estimate ${inr(r.estimate)}` : null}>
      {stage === 'submitted' && <p className="small muted">Visit the school, check the condition and the quantities against enrolment, and add your own photos below.</p>}
      {stage === 'ordered' && <p className="small muted">If the school can't confirm online, confirm on their behalf after checking the items. Add a delivery photo first.</p>}
      {stage === 'verified' && (
        <div className={cx('field', 'amount-field', err.amount && 'has-error')}>
          <label htmlFor="iamt">Amount to sanction (₹)</label>
          <input id="iamt" type="number" min="500" max={r.estimate} step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className={err.amount ? 'field-error' : 'field-help'}>{err.amount ? `Between ₹500 and ${inr(r.estimate)}.` : `Up to the estimate of ${inr(r.estimate)}. Sanction less for a partial approval.`}</div>
        </div>
      )}
      <div className={cx('field', err.comment && 'has-error')}>
        <label htmlFor="icm">{stage === 'submitted' ? 'Site-visit notes' : 'Comments'}</label>
        <textarea id="icm" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder={{ submitted: 'What you saw at the school: condition, numbers checked, who you met.', verified: 'Reason for your decision. Shown to the school if not approved.', ordered: 'Items checked: quantity and condition.' }[stage]} />
        {err.comment && <div className="field-error">This is required.</div>}
      </div>
      <div className="row">
        {stage === 'submitted' && <button className="btn" disabled={!!busy} onClick={() => act('verify')}>{busy === 'verify' ? 'Saving…' : 'Verified, send to committee'}</button>}
        {stage === 'verified' && <>
          <button className="btn" disabled={!!busy} onClick={() => act('approve')}>{busy === 'approve' ? 'Approving…' : 'Approve and sanction'}</button>
          <button className="btn btn-ghost" disabled={!!busy} onClick={() => act('send_back')}>Send back for re-check</button>
        </>}
        {stage === 'ordered' && <button className="btn" disabled={!!busy || !hasDelivery} onClick={() => act('delivered')}>{busy === 'delivered' ? 'Confirming…' : 'Confirm delivery'}</button>}
        {['submitted', 'verified'].includes(stage) && <button className="btn btn-danger push" disabled={!!busy} onClick={() => act('reject')}>Not approve</button>}
      </div>
    </Panel>
  );
}

export default function InfraDetail({ id }) {
  const { auth } = useApp();
  const { data, loading, error, reload } = useApi(`/api/staff/infra/${id}`);
  useTitle(data?.request?.title || 'Infrastructure request');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { request: r, school, items, documents, events, payments, released, others, schoolPhotos, gaps } = data;
  const canDecide = ['submitted', 'verified', 'ordered'].includes(r.status);

  return (
    <>
      <PageHead crumb={['/staff/infrastructure', 'All requests']} title={r.title}
        sub={`${r.code} · ${school.name}, ${school.district} · ${r.beneficiaries} students benefit · submitted ${niceDate(r.created_at)}`}>
        <InfraBadge status={r.status} />
      </PageHead>

      {r.status !== 'rejected' && <section className="welcome compact"><InfraPath status={r.status} /></section>}

      <div className="cols">
        <div className="col-main">
          {school.verification !== 'verified' && r.status !== 'rejected' && (
            <Panel tone="warn" title={school.verification === 'rejected' ? "This school's registration was not approved" : 'School not verified yet'}>
              <p className="small">{school.verification === 'rejected'
                ? 'You can only close (not approve) this request.'
                : 'This request can\u2019t move past \u201cSubmitted\u201d until someone visits and verifies the school.'}</p>
              <Link className="btn btn-sm" to={`/staff/schools/${school.id}`}>{school.verification === 'rejected' ? 'Open school' : 'Verify the school'}</Link>
            </Panel>
          )}
          {canDecide && <Decision r={r} documents={documents} onDone={reload} />}
          {['approved', 'ordered'].includes(r.status) && (
            <Panel tone="ok">
              <div className="spread">
                <div><h3 className="flush">{inr(r.amount_sanctioned)} sanctioned</h3><span className="muted small">{inr(released)} paid to vendors so far</span></div>
                <Link className="btn" to={`/staff/payments?infra=${r.id}#new`}>Raise vendor payment</Link>
              </div>
            </Panel>
          )}
          <Panel title="Items requested" aside={<span className={`urgency u-${r.urgency}`}>{r.urgency === 'normal' ? 'Normal' : r.urgency === 'high' ? 'High urgency' : 'Critical'}</span>}>
            <ItemsTable items={items} estimate={r.estimate} sanctioned={r.amount_sanctioned} />
          </Panel>
          <Panel title="The school's explanation"><blockquote className="story">{r.justification}</blockquote></Panel>
          <Panel title="Facility gaps at this school" tone={gaps.length ? 'warn' : undefined} aside={<Link to={`/staff/schools/${school.id}`}>Full school profile</Link>}>
            <GapList gaps={gaps} />
          </Panel>
          <Panel title="Photos and files" aside={`${documents.length} file${documents.length === 1 ? '' : 's'}`}>
            <DocGallery documents={documents} />
            {r.status !== 'rejected' && (
              <details className="disclose mt" open={r.status === 'submitted' || r.status === 'ordered'}>
                <summary>Add files</summary>
                <div className="slots">
                  {['submitted', 'verified'].includes(r.status) && <InfraUpload requestId={r.id} kind="condition" label="Site-visit photos" capture="environment" onDone={reload} />}
                  {['verified', 'approved', 'ordered'].includes(r.status) && <InfraUpload requestId={r.id} kind="quotation" label="Vendor quotation" onDone={reload} />}
                  {['ordered', 'delivered'].includes(r.status) && <InfraUpload requestId={r.id} kind="delivery" label="Delivery photos" capture="environment" onDone={reload} />}
                  {['ordered', 'delivered'].includes(r.status) && <InfraUpload requestId={r.id} kind="invoice" label="Invoice" onDone={reload} />}
                </div>
              </details>
            )}
          </Panel>
        </div>
        <div className="col-side">
          <Panel><PriorityBreakdown request={r} /></Panel>
          <Panel title="School" aside={<Link to={`/staff/schools/${school.id}`}>Profile</Link>}><SchoolFacts school={school} /></Panel>
          <Panel title="Location" aside={school.latitude == null ? <span className="text-warn">Not geo-tagged</span> : null}>
            {school.latitude != null ? <LocationMap lat={school.latitude} lng={school.longitude} accuracy={school.location_accuracy} at={school.located_at} height={180} />
              : <p className="muted small flush">The school hasn't captured its location yet. Record it at the site visit.</p>}
          </Panel>
          <Panel title="School photos" aside={`${schoolPhotos.filter((p) => p.latitude != null).length} of ${schoolPhotos.length} geo-tagged`}>
            <SchoolPhotos photos={schoolPhotos} />
          </Panel>
          {payments.length > 0 && (
            <Panel title="Vendor payments" aside={<Link to={`/staff/payments?infra=${r.id}`}>Open</Link>}>
              <ul className="list">{payments.map((p) => (
                <li key={p.id}><span>{p.payee}<br /><span className="muted small">{p.purpose}{p.utr ? ` · UTR ${p.utr}` : ''}</span></span>
                  <span className="right">{inr(p.amount)}<br /><Badge status={p.status}>{p.status}</Badge></span></li>
              ))}</ul>
            </Panel>
          )}
          <Panel title="History"><InfraTimeline events={events} /></Panel>
          {others.length > 0 && (
            <Panel title="Other requests from this school">
              <ul className="list">{others.map((o) => (
                <li key={o.id}><Link to={`/staff/infrastructure/${o.id}`}>{o.title}</Link><InfraBadge status={o.status} /></li>
              ))}</ul>
            </Panel>
          )}
          {auth.user.role !== 'field' && school.udise_code && (
            <p className="muted small">Check this school on the <a href="https://udiseplus.gov.in" target="_blank" rel="noopener noreferrer">UDISE+ portal</a> with code {school.udise_code}.</p>
          )}
        </div>
      </div>
    </>
  );
}
