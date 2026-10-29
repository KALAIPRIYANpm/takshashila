import { useEffect, useState } from 'react';
import { InfraBadge } from '../../components/infra.jsx';
import { PageHead } from '../../components/layout.jsx';
import { Empty, ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { inr } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';
import { ScoreBar } from './Overview.jsx';

const URGENCY_TAG = { critical: 'Critical', high: 'High', normal: 'Normal' };

export default function Infrastructure() {
  useTitle('School infrastructure');
  const { auth, meta } = useApp();
  const { query } = useLocation();
  const f = { status: query.get('status') || '', district: query.get('district') || '', q: query.get('q') || '', sort: query.get('sort') || 'priority' };
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => {
    if (q.trim() === f.q) return undefined;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, loading, error, reload } = useApi(`/api/staff/infra${qs ? `?${qs}` : ''}`);

  function update(patch) {
    const next = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([k, v]) => v && !(k === 'sort' && v === 'priority')));
    navigate(`/staff/infrastructure${next.toString() ? `?${next}` : ''}`, { replace: true });
  }

  const s = data?.byStatus || {};
  const mine = auth.user.role === 'field' ? 'submitted' : 'verified';

  return (
    <>
      <PageHead title="School infrastructure"
        sub="Requests from schools for furniture, electricals, water, sanitation and repairs. Highest priority first." />
      {data && (
        <div className="figures">
          <div><b>{s[mine] || 0}</b><span>{auth.user.role === 'field' ? 'Waiting for your site visit' : 'Waiting for approval'}</span></div>
          <div><b>{(s.approved || 0) + (s.ordered || 0)}</b><span>Approved, in progress</span></div>
          <div><b>{inr(data.totals.sanctioned)}</b><span>Sanctioned to {data.totals.schools} school{data.totals.schools === 1 ? '' : 's'}</span></div>
          <div><b>{Number(data.totals.reached).toLocaleString('en-IN')}</b><span>Students reached (delivered)</span></div>
        </div>
      )}
      <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
        <div className="grow"><label htmlFor="iq">Search</label><input id="iq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="School, UDISE code, request number or title" /></div>
        <div><label htmlFor="ist">Stage</label>
          <select id="ist" value={f.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All stages</option>
            {Object.entries(meta.infra.statuses).map(([k, v]) => <option key={k} value={k}>{v}{s[k] ? ` (${s[k]})` : ''}</option>)}
          </select></div>
        <div><label htmlFor="idi">District</label>
          <select id="idi" value={f.district} onChange={(e) => update({ district: e.target.value })}>
            <option value="">All districts</option>{(data?.districts || []).map((d) => <option key={d}>{d}</option>)}
          </select></div>
        <div><label htmlFor="iso">Sort by</label>
          <select id="iso" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="priority">Priority</option><option value="newest">Newest</option><option value="amount">Largest estimate</option>
          </select></div>
      </form>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (data.rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>School</th><th>Request</th><th>Priority</th><th>Urgency</th><th className="num">Estimate</th><th className="num">Students</th><th>Stage</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={(e) => { if (e.target.tagName !== 'A') navigate(`/staff/infrastructure/${r.id}`); }}>
                  <td><Link className="rowlink" to={`/staff/infrastructure/${r.id}`}>{r.school}</Link>{r.verification !== 'verified' && <span className={`badge b-v-${r.verification} badge-sm`}>{r.verification === 'pending' ? 'Unverified' : 'Not approved'}</span>}<span className="muted small">{r.village && r.village !== r.district ? `${r.village}, ` : ''}{r.district} · {r.school_type}</span></td>
                  <td>{r.title}<br /><span className="muted small">{r.code}</span></td>
                  <td><ScoreBar value={r.priority} /></td>
                  <td><span className={`urgency u-${r.urgency}`}>{URGENCY_TAG[r.urgency]}</span></td>
                  <td className="num">{inr(r.estimate)}{r.amount_sanctioned ? <div className="muted small">{inr(r.amount_sanctioned)} sanctioned</div> : null}</td>
                  <td className="num">{r.beneficiaries}</td>
                  <td><InfraBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No requests match these filters" action={<button className="btn btn-ghost" onClick={() => navigate('/staff/infrastructure')}>Clear filters</button>}>Schools submit requests from the school portal.</Empty>)}
    </>
  );
}
