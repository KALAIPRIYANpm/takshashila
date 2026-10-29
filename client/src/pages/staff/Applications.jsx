import { useEffect, useState } from 'react';
import { PageHead } from '../../components/layout.jsx';
import { Avatar, Badge, Empty, ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { inr } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';
import { ScoreBar } from './Overview.jsx';

export default function Applications() {
  useTitle('Applications');
  const { meta } = useApp();
  const { query } = useLocation();
  const f = { status: query.get('status') || '', district: query.get('district') || '', q: query.get('q') || '', sort: query.get('sort') || 'score' };
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  // Search as you type, once typing pauses.
  useEffect(() => {
    if (q.trim() === f.q) return undefined;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, loading, error, reload } = useApi(`/api/staff/applications${qs ? `?${qs}` : ''}`);

  const update = (patch) => {
    const next = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([k, v]) => v && !(k === 'sort' && v === 'score')));
    navigate(`/staff/applications${next.toString() ? `?${next}` : ''}`, { replace: true });
  };

  return (
    <>
      <PageHead title="Applications" sub={data ? `${data.rows.length} shown. Highest overall score first, so the students who need help most are seen first.` : ' '}>
        <Link className="btn" to="/staff/applications/new">Register a student</Link>
      </PageHead>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
        <div className="grow"><label htmlFor="q">Search</label><input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, application number or college" /></div>
        <div><label htmlFor="st">Stage</label>
          <select id="st" value={f.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All stages</option>{Object.entries(meta.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label htmlFor="di">District</label>
          <select id="di" value={f.district} onChange={(e) => update({ district: e.target.value })}>
            <option value="">All districts</option>{(data?.districts || []).map((d) => <option key={d}>{d}</option>)}
          </select></div>
        <div><label htmlFor="so">Sort by</label>
          <select id="so" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="score">Overall score</option><option value="need">Need score</option><option value="newest">Newest</option>
          </select></div>
      </form>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (data.rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Student</th><th>Studying</th><th>District</th><th className="num">Need</th><th className="num">Marks</th><th>Overall</th><th className="num">Asked for</th><th>Stage</th></tr></thead>
            <tbody>
              {data.rows.map((a) => (
                <tr key={a.id} className="clickable" onClick={(e) => { if (e.target.tagName !== 'A') navigate(`/staff/applications/${a.id}`); }}>
                  <td><div className="who"><Avatar name={a.full_name} size="sm" /><div><Link className="rowlink" to={`/staff/applications/${a.id}`}>{a.full_name}</Link><span className="muted small">{a.code}{a.mobilizer ? `, via ${a.mobilizer}` : ''}</span></div></div></td>
                  <td>{a.course}<br /><span className="muted small">{a.institution}</span></td>
                  <td>{a.district}</td>
                  <td className="num">{Math.round(a.need_score)}</td>
                  <td className="num">{Math.round(a.merit_score)}%</td>
                  <td><ScoreBar value={a.final_score} /></td>
                  <td className="num">{inr(a.amount_requested)}</td>
                  <td><Badge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No applications match these filters" action={<button className="btn btn-ghost" onClick={() => navigate('/staff/applications')}>Clear filters</button>}>Clear the search or choose "All stages".</Empty>)}
    </>
  );
}
