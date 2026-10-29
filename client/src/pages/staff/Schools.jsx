import { useEffect, useState } from 'react';
import { PageHead } from '../../components/layout.jsx';
import { VerificationBadge } from '../../components/school.jsx';
import { Empty, ErrorNote, Icon, Spinner, useTitle } from '../../components/ui.jsx';
import { cx, inr } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi } from '../../state.jsx';

export default function Schools() {
  useTitle('Schools');
  const { query } = useLocation();
  const f = { district: query.get('district') || '', q: query.get('q') || '', gaps: query.get('gaps') || '', v: query.get('v') || '' };
  const [q, setQ] = useState(f.q);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => {
    if (q.trim() === f.q) return undefined;
    const t = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams(Object.entries({ district: f.district, q: f.q }).filter(([, v]) => v)).toString();
  const { data, loading, error, reload } = useApi(`/api/staff/schools${qs ? `?${qs}` : ''}`);

  function update(patch) {
    const next = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v));
    navigate(`/staff/schools${next.toString() ? `?${next}` : ''}`, { replace: true });
  }

  const rows = (data?.rows || []).filter((s) => (!f.gaps || s.gaps.length > 0) && (!f.v || s.verification === f.v));
  const all = data?.rows || [];
  const students = all.reduce((n, s) => n + s.students, 0);
  const girls = all.reduce((n, s) => n + (s.girls || 0), 0);

  return (
    <>
      <PageHead title="Schools" sub="Every registered school, with verification, enrolment, facility gaps and requests.">
        <Link className="btn" to="/staff/schools/new"><Icon name="plus" />Register a school</Link>
      </PageHead>
      {data && (
        <div className="figures">
          <div><b>{all.length}</b><span>Schools registered</span></div>
          <div><b>{students.toLocaleString('en-IN')}</b><span>Students enrolled{students ? ` · ${Math.round((girls / students) * 100)}% girls` : ''}</span></div>
          <div><b>{all.filter((s) => s.gaps.length).length}</b><span>With facility gaps</span></div>
          <div><b>{all.filter((s) => s.verification === 'pending').length}</b><span>Waiting for verification</span></div>
        </div>
      )}
      <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
        <div className="grow"><label htmlFor="sq">Search</label><input id="sq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="School name, UDISE code, taluk or village" /></div>
        <div><label htmlFor="sdi">District</label>
          <select id="sdi" value={f.district} onChange={(e) => update({ district: e.target.value })}>
            <option value="">All districts</option>{(data?.districts || []).map((d) => <option key={d}>{d}</option>)}
          </select></div>
        <div><label htmlFor="sv">Verification</label>
          <select id="sv" value={f.v} onChange={(e) => update({ v: e.target.value })}>
            <option value="">Any</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Not approved</option>
          </select></div>
        <div><label htmlFor="sga">Show</label>
          <select id="sga" value={f.gaps} onChange={(e) => update({ gaps: e.target.value })}>
            <option value="">All schools</option><option value="1">Only with facility gaps</option>
          </select></div>
      </form>
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data ? <Spinner /> : data && (rows.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>School</th><th>Status</th><th>Area</th><th className="num">Students</th><th className="num">Pupils / teacher</th><th>Facility gaps</th><th className="num">Requests</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => {
                const ptr = Math.round(s.students / Math.max(1, s.teachers));
                return (
                  <tr key={s.id} className="clickable" onClick={(e) => { if (e.target.tagName !== 'A') navigate(`/staff/schools/${s.id}`); }}>
                    <td><Link className="rowlink" to={`/staff/schools/${s.id}`}>{s.name}</Link><span className="muted small">UDISE {s.udise_code} · {s.school_type}</span></td>
                    <td><VerificationBadge status={s.verification} /></td>
                    <td>{[...new Set([s.taluk || s.village, s.district].filter(Boolean))].join(', ')}<br /><span className="muted small">{s.area_type || ''}{s.area_tags ? ` · ${s.area_tags.split(',').join(', ')}` : ''}</span></td>
                    <td className="num">{s.students}{s.girls != null && <div className="muted small">{s.girls} girls</div>}</td>
                    <td className={cx('num', ptr > 30 && 'text-warn')}>{ptr}</td>
                    <td>{s.gaps.length ? <span className="gap-count">{s.gaps.length}</span> : <span className="text-ok small">None</span>}
                      {s.gaps[0] && <span className="muted small"> {s.gaps[0]}{s.gaps.length > 1 ? '…' : ''}</span>}</td>
                    <td className="num">{s.requests}{s.sanctioned ? <div className="muted small">{inr(s.sanctioned)}</div> : null}</td>
                    <td>{s.latitude != null && <span title="Geo-tagged" className="geo-ok"><Icon name="pin" /></span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="No schools match" action={<button className="btn btn-ghost" onClick={() => navigate('/staff/schools')}>Clear filters</button>}>Schools register themselves from the school portal.</Empty>)}
    </>
  );
}
