// School infrastructure building blocks shared by the school portal and the staff screens.
import { useState } from 'react';
import { cx, inr, niceDate, uploadTo } from '../lib.js';
import { useApp } from '../state.jsx';
import { Badge, Icon } from './ui.jsx';

export const EVENT_LABEL = {
  submitted: 'Request submitted',
  verified: 'Site visit done',
  approved: 'Approved',
  sent_back: 'Sent back for a re-check',
  rejected: 'Not approved',
  ordered: 'Vendor paid, order placed',
  delivered: 'Delivery confirmed',
};
const STEP_NOTE = {
  submitted: 'Request received',
  verified: 'Field executive visits the school',
  approved: 'Committee sanctions a budget',
  ordered: 'Vendor paid and order placed',
  delivered: 'School confirms with photos',
};
const DOC_KIND = { condition: 'Current condition', quotation: 'Quotation', delivery: 'Delivery proof', invoice: 'Invoice' };

export function InfraBadge({ status }) {
  const { meta } = useApp();
  return <Badge status={`i-${status}`}>{meta.infra.statuses[status]}</Badge>;
}

export function InfraPath({ status }) {
  const { meta } = useApp();
  const flow = meta.infra.flow;
  const idx = flow.indexOf(status);
  return (
    <ol className="path path-5">
      {flow.map((st, i) => (
        <li key={st} className={cx(i < idx || (i === idx && st === 'delivered') ? 'done' : i === idx ? 'now' : '')}>
          <b>{meta.infra.statuses[st]}</b><span>{STEP_NOTE[st]}</span>
        </li>
      ))}
    </ol>
  );
}

export function ItemsTable({ items, estimate, sanctioned }) {
  const { meta } = useApp();
  return (
    <div className="table-wrap flat">
      <table className="data compact">
        <thead><tr><th>Item</th><th>Category</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Total</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id ?? i.name}>
              <td><b>{i.name}</b>{i.item_key === 'custom' && <span className="tag tag-sm">Custom</span>}{i.note && <div className="muted small">{i.note}</div>}</td>
              <td className="muted">{meta.infra.categories[i.category]?.label}</td>
              <td className="num">{i.quantity}</td>
              <td className="num">{inr(i.unit_cost)}</td>
              <td className="num">{inr(i.quantity * i.unit_cost)}</td>
            </tr>
          ))}
          <tr className="total"><td colSpan={4}>Estimated total</td><td className="num">{inr(estimate)}</td></tr>
          {sanctioned != null && <tr className="total sanctioned"><td colSpan={4}>Sanctioned</td><td className="num">{inr(sanctioned)}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function PriorityBreakdown({ request }) {
  const detail = typeof request.priority_detail === 'string' ? JSON.parse(request.priority_detail) : request.priority_detail;
  return (
    <div className="priority">
      <div className="priority-head">
        <span className="priority-num">{Math.round(request.priority)}</span>
        <span><b>Priority score</b><span className="muted small">out of 100. Higher is seen first.</span></span>
      </div>
      <ul className="priority-rows">
        {detail.map((d) => (
          <li key={d.label}>
            <span className="pr-label">{d.label}<small>{d.note}</small></span>
            <span className="pr-bar"><i style={{ width: `${(d.points / d.max) * 100}%` }} /></span>
            <span className="pr-pts">{d.points}<small>/{d.max}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocGallery({ documents, kinds = Object.keys(DOC_KIND) }) {
  const shown = documents.filter((d) => kinds.includes(d.kind));
  if (!shown.length) return <p className="muted small flush">No photos or files yet.</p>;
  return (
    <div className="thumbs">
      {shown.map((d) => (
        <a key={d.id} className="thumb" href={`/api/infra/files/${d.id}`} target="_blank" rel="noopener noreferrer">
          <span className="thumb-img">{d.mime?.startsWith('image') ? <img src={`/api/infra/files/${d.id}`} alt="" loading="lazy" /> : <span>PDF</span>}</span>
          <span className="thumb-cap">{DOC_KIND[d.kind]}<span className="muted"> · {niceDate(d.created_at)}</span></span>
        </a>
      ))}
    </div>
  );
}

/** Pick one or more photos/PDFs and upload them straight away as `kind`. */
export function InfraUpload({ requestId, kind, label, onDone, capture }) {
  const { notify } = useApp();
  const [progress, setProgress] = useState(null);
  const pick = async (files) => {
    const list = [...files];
    if (!list.length) return;
    let ok = 0;
    for (const [n, file] of list.entries()) {
      try {
        await uploadTo(`/api/infra/${requestId}/documents/${kind}`, file, (p) => setProgress((n + p) / list.length));
        ok += 1;
      } catch (e) { notify(e.message, 'error'); }
    }
    setProgress(null);
    if (ok) { notify(`${ok} file${ok > 1 ? 's' : ''} uploaded.`); onDone?.(); }
  };
  const busy = progress !== null;
  return (
    <label className={cx('slot', busy && 'busy')}>
      <input type="file" accept="image/*,application/pdf" multiple capture={capture} disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      <Icon name="camera" />
      <span className="slot-name">{label}</span>
      <span className="slot-state">{busy ? `${Math.round(progress * 100)}%` : 'Add files'}</span>
      {busy && <span className="slot-bar" style={{ width: `${progress * 100}%` }} />}
    </label>
  );
}

export function InfraTimeline({ events, showActor = true }) {
  return (
    <ul className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <b>{EVENT_LABEL[e.action] || e.action}{e.amount ? `, ${inr(e.amount)}` : ''}</b>
          <div className="when">{niceDate(e.created_at, true)}{showActor && e.actor_name ? `, ${e.actor_name}` : ''}</div>
          {e.comment && <div className="said">{e.comment}</div>}
        </li>
      ))}
    </ul>
  );
}
