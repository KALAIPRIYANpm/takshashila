import { useEffect, useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { Badge, Choices, Empty, ErrorNote, Icon, Input, Spinner, useTitle } from '../../components/ui.jsx';
import { api, inr, niceDate } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

const LABEL = { requested: 'Waiting for approval', approved: 'Ready to release', paid: 'Paid', rejected: 'Rejected' };
const KIND = { scholarship: 'Scholarship', vendor: 'Vendor', training: 'Training', infrastructure: 'School infra' };

function PayRow({ p, me, onDone }) {
  const { notify } = useApp();
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    setBusy(true);
    try {
      await api.post(`/api/staff/payments/${p.id}/${action}`, action === 'paid' ? { utr } : {});
      notify({ approve: 'Approved. Finance can now release it.', reject: 'Payment request rejected.', paid: 'Marked as paid.' }[action]);
      onDone();
    } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };
  const isManager = ['manager', 'admin'].includes(me.role);
  return (
    <tr>
      <td><b>{p.payee}</b><br /><span className="muted small">{p.payee_account || 'No account added'}</span></td>
      <td className="pay-for">
        <span className="kind-tag">{KIND[p.kind]}</span>
        {p.full_name && <Link to={`/staff/applications/${p.application_id}`}>{p.full_name}</Link>}
        {p.school_name && <Link to={`/staff/infrastructure/${p.infra_request_id}`}>{p.school_name}</Link>}
        <span className="muted small">{[p.infra_code, p.purpose].filter(Boolean).join(' · ')}{p.infra_code || p.purpose ? '. ' : ''}Raised by {p.requester}, {niceDate(p.created_at)}</span></td>
      <td className="num"><b>{inr(p.amount)}</b></td>
      <td><Badge status={p.status}>{{ requested: 'Waiting', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' }[p.status]}</Badge>{p.utr && <><br /><span className="muted small">UTR {p.utr}</span></>}</td>
      <td className="actions">
        {p.status === 'requested' && isManager && (p.requested_by === me.id
          ? <span className="muted small">Needs another approver</span>
          : <button className="btn btn-sm" disabled={busy} onClick={() => act('approve')}>Approve</button>)}
        {['requested', 'approved'].includes(p.status) && isManager && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act('reject')}>Reject</button>}
        {p.status === 'approved' && me.role === 'admin' && (
          <form className="row tight nowrap" onSubmit={(e) => { e.preventDefault(); act('paid'); }}>
            <input className="input-sm" placeholder="Bank UTR" value={utr} onChange={(e) => setUtr(e.target.value)} required aria-label="Bank UTR number" />
            <button className="btn btn-sm btn-gold" disabled={busy || !utr.trim()}>Mark paid</button>
          </form>
        )}
        {p.status === 'approved' && me.role !== 'admin' && <span className="muted small">Finance to release</span>}
        {p.status === 'paid' && <span className="muted small">{niceDate(p.paid_at)}</span>}
      </td>
    </tr>
  );
}

export default function Payments() {
  useTitle('Payments');
  const { auth, notify } = useApp();
  const { query, hash } = useLocation();
  const status = query.get('status') || '';
  const pre = query.get('app') || '';
  const preInfra = query.get('infra') || '';
  const { data, loading, error, reload } = useApi(`/api/staff/payments${status ? `?status=${status}` : ''}`);
  const blank = { kind: 'scholarship', application_id: '', infra_request_id: '', payee: '', payee_account: '', amount: '', purpose: '' };
  const [form, setForm] = useState(preInfra ? { ...blank, kind: 'infrastructure', infra_request_id: preInfra } : { ...blank, application_id: pre });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!!(pre || preInfra || hash === '#new'));
  // Opened from an application's "Raise a payment": fill in the college as the payee.
  useEffect(() => {
    const s = pre && data?.students.find((x) => String(x.id) === pre);
    if (s) setForm((x) => (x.payee ? x : { ...x, application_id: pre, payee: s.institution }));
    // Opened from a school request's "Raise vendor payment": suggest the remaining sanctioned amount.
    const ir = preInfra && data?.infra.find((x) => String(x.id) === preInfra);
    if (ir) setForm((x) => (x.amount ? x : { ...x, kind: 'infrastructure', infra_request_id: preInfra, amount: String(ir.amount_sanctioned - ir.used), purpose: ir.title }));
  }, [data, pre, preInfra]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const chosen = data.students.find((s) => String(s.id) === String(form.application_id));
  const chosenInfra = data.infra.find((r) => String(r.id) === String(form.infra_request_id));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      await api.post('/api/staff/payments', form);
      notify('Payment request raised. A manager will approve it.');
      setForm(blank);
      setOpen(false);
      reload();
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Payments" sub="Raise, approve and release. The person who raises a payment can't approve it.">
        {!open && <button className="btn" onClick={() => setOpen(true)}><Icon name="plus" />Raise payment</button>}
      </PageHead>
      <div className="figures">
        {Object.entries(LABEL).map(([k, l]) => <div key={k}><b>{inr(data.totals[k]?.amt || 0)}</b><span>{l} ({data.totals[k]?.n || 0})</span></div>)}
      </div>
      {open && (
        <Panel id="new" title="Raise a payment request" className="pay-form"
          aside={<button className="linkish" onClick={() => setOpen(false)}>Close</button>}>
          <form onSubmit={submit} noValidate>
            <Choices name="kind" legend="Payment type" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })}
              options={[{ value: 'scholarship', label: 'Scholarship' }, { value: 'vendor', label: 'Vendor' }, { value: 'training', label: 'Training' }, { value: 'infrastructure', label: 'School infra' }]} />
            {form.kind === 'infrastructure' && (
              <div className={`field ${err.infra_request_id ? 'has-error' : ''}`}>
                <label htmlFor="pir">School request</label>
                <select id="pir" value={form.infra_request_id} onChange={(e) => {
                  const r = data.infra.find((x) => String(x.id) === e.target.value);
                  setForm({ ...form, infra_request_id: e.target.value, purpose: form.purpose || r?.title || '' });
                }}>
                  <option value="">Choose an approved request</option>
                  {data.infra.map((r) => <option key={r.id} value={r.id}>{r.school}: {r.title} ({r.code})</option>)}
                </select>
                {chosenInfra && <div className="field-help">{inr(chosenInfra.amount_sanctioned - chosenInfra.used)} of {inr(chosenInfra.amount_sanctioned)} sanctioned is still available.</div>}
                {err.infra_request_id && <div className="field-error">{err.infra_request_id}</div>}
              </div>
            )}
            {['scholarship', 'vendor'].includes(form.kind) && (
              <div className={`field ${err.application_id ? 'has-error' : ''}`}>
                <label htmlFor="pa">Student{form.kind === 'vendor' ? ' (optional)' : ''}</label>
                <select id="pa" value={form.application_id} onChange={(e) => {
                  const s = data.students.find((x) => String(x.id) === e.target.value);
                  setForm({ ...form, application_id: e.target.value, payee: form.kind === 'scholarship' && s ? s.institution : form.payee });
                }}>
                  <option value="">Choose an approved student</option>
                  {data.students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.code})</option>)}
                </select>
                {chosen && <div className="field-help">{inr(chosen.amount_sanctioned - chosen.used)} of {inr(chosen.amount_sanctioned)} sanctioned is still available.</div>}
                {err.application_id && <div className="field-error">{err.application_id}</div>}
              </div>
            )}
            <Input label="Pay to" required placeholder="College or vendor name" value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} error={err.payee} />
            <Input label="Bank account and IFSC" placeholder="A/c 1234…, IFSC SBIN0000123" value={form.payee_account} onChange={(e) => setForm({ ...form, payee_account: e.target.value })} />
            <div className="grid-2">
              <Input label="Amount (₹)" required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={err.amount} />
              <Input label="Purpose" placeholder="Sem 3 tuition fee" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </div>
            <p className="muted small">{form.kind === 'infrastructure' ? "Add the vendor's quotation to the school request before raising." : "Add the fee demand or quotation PDF to the student's documents before raising."}</p>
            <div className="row"><button className="btn" disabled={busy}>{busy ? 'Raising…' : 'Raise request'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
          </form>
        </Panel>
      )}
      <div className="pay-list">
        <div>
          <div className="filters">
            <div><label htmlFor="ps">Show</label>
              <select id="ps" value={status} onChange={(e) => navigate(`/staff/payments${e.target.value ? `?status=${e.target.value}` : ''}`, { replace: true })}>
                <option value="">All payments</option>{Object.entries(LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          </div>
          {data.rows.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Payee</th><th>For</th><th className="num">Amount</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{data.rows.map((p) => <PayRow key={p.id} p={p} me={auth.user} onDone={reload} />)}</tbody>
              </table>
            </div>
          ) : <Empty title="No payments here yet">Use "Raise payment" to add the first one.</Empty>}
        </div>
      </div>
    </>
  );
}
