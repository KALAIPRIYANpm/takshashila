import { useState } from 'react';
import { DocGallery, InfraBadge, InfraPath, InfraTimeline, InfraUpload, ItemsTable, PriorityBreakdown } from '../../components/infra.jsx';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { api, inr, niceDate } from '../../lib.js';
import { useApi, useApp } from '../../state.jsx';

const HEADLINE = {
  submitted: 'Received. A field executive will contact you to plan a site visit within 10 working days.',
  verified: 'Site visit done. The programme committee is reviewing your request.',
  approved: 'Approved. We are getting quotations and will pay the vendor directly.',
  ordered: 'The vendor has been paid and your order is placed. Confirm here once the items arrive.',
  delivered: 'Delivered. Thank you for confirming. Keep the items in good use.',
  rejected: 'This request was not approved.',
};

export default function SchoolRequest({ id }) {
  const { notify } = useApp();
  const { data, loading, error, reload } = useApi(`/api/school/requests/${id}`);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(data?.request?.title || 'Request');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { request: r, items, documents, events, payments, released } = data;
  const hasDelivery = documents.some((d) => d.kind === 'delivery');

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/api/school/requests/${r.id}/delivered`, { comment: note });
      notify('Delivery confirmed. Thank you!');
      reload();
    } catch (x) { notify(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead crumb={['/school', 'Dashboard']} title={r.title} sub={`${r.code} · Submitted ${niceDate(r.created_at)} · ${r.beneficiaries} students benefit`}>
        <InfraBadge status={r.status} />
      </PageHead>

      <section className="welcome">
        <p className="welcome-line flush">{HEADLINE[r.status]}</p>
        {r.status === 'rejected'
          ? <div className="reason">{events.find((e) => e.action === 'rejected')?.comment}</div>
          : <InfraPath status={r.status} />}
      </section>

      <div className="cols">
        <div className="col-main">
          {r.status === 'ordered' && (
            <Panel title="Confirm delivery" tone="ok">
              <p className="small">When the items arrive, check the quantity and quality, then add photos of them installed or in use.</p>
              <div className="slots">
                <InfraUpload requestId={r.id} kind="delivery" label="Photos of delivered items" capture="environment" onDone={reload} />
                <InfraUpload requestId={r.id} kind="invoice" label="Vendor invoice or delivery challan" onDone={reload} />
              </div>
              <div className="field mt">
                <label htmlFor="dn">Remarks (optional)</label>
                <textarea id="dn" rows={2} placeholder="e.g. All 40 benches received; 2 had loose screws, fixed by the vendor." value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button className="btn" disabled={busy || !hasDelivery} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm delivery'}</button>
              {!hasDelivery && <span className="muted small"> Add at least one delivery photo first.</span>}
            </Panel>
          )}
          <Panel title="Items requested">
            <ItemsTable items={items} estimate={r.estimate} sanctioned={r.amount_sanctioned} />
          </Panel>
          <Panel title="Why the school needs this">
            <blockquote className="story">{r.justification}</blockquote>
          </Panel>
          <Panel title="Photos and files">
            <DocGallery documents={documents} />
            {['submitted', 'verified'].includes(r.status) && (
              <div className="slots mt"><InfraUpload requestId={r.id} kind="condition" label="Add more photos" onDone={reload} /></div>
            )}
          </Panel>
        </div>
        <div className="col-side">
          <Panel><PriorityBreakdown request={r} /></Panel>
          {payments.length > 0 && (
            <Panel title="Paid to vendors" aside={<span className="money-line"><b>{inr(released)}</b> of {inr(r.amount_sanctioned)}</span>}>
              <ul className="list">{payments.filter((p) => p.status !== 'rejected').map((p) => (
                <li key={p.id}><span>{p.payee}<br /><span className="muted small">{p.status === 'paid' ? `Paid ${niceDate(p.paid_at)}` : 'In process'}</span></span><b>{inr(p.amount)}</b></li>
              ))}</ul>
            </Panel>
          )}
          <Panel title="Updates"><InfraTimeline events={events} /></Panel>
        </div>
      </div>
    </>
  );
}
