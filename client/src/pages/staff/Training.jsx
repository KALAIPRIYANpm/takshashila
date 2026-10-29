import { useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { Empty, ErrorNote, Input, Select, Spinner, useTitle } from '../../components/ui.jsx';
import { api, inr, niceDate } from '../../lib.js';
import { Link, navigate } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

export default function Training() {
  useTitle('Training');
  const { auth, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/staff/trainings');
  const [f, setF] = useState({ title: '', kind: 'skill', held_on: '', venue: '', location: '', trainer: '', budget: '', students: [] });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      const r = await api.post('/api/staff/trainings', f);
      notify('Session created. Mark attendance on the day.');
      navigate(`/staff/training/${r.id}`);
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Training sessions" sub="Orientation and skill sessions for selected students, with attendance." />
      <div className="cols">
        <div className="col-main">
          {data.sessions.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Session</th><th>Date</th><th>Venue</th><th className="num">Attended</th><th className="num">Budget</th></tr></thead>
                <tbody>{data.sessions.map((t) => (
                  <tr key={t.id}>
                    <td><Link className="rowlink" to={`/staff/training/${t.id}`}>{t.title}</Link><br /><span className="muted small">{t.kind === 'orientation' ? 'Orientation' : 'Skill training'}{t.trainer ? `, ${t.trainer}` : ''}</span></td>
                    <td>{niceDate(t.held_on)}</td><td>{t.venue}{t.location ? `, ${t.location}` : ''}</td>
                    <td className="num">{t.present} of {t.invited}</td><td className="num">{inr(t.budget)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty title="No sessions yet">Create the first orientation for your selected students.</Empty>}
        </div>
        <div className="col-side">
          {auth.user.role === 'field' ? (
            <Panel><p className="muted flush">Program managers create sessions. Open a session to mark attendance on the day.</p></Panel>
          ) : (
            <Panel title="New session">
              <form onSubmit={create} noValidate>
                <Input label="Title" required placeholder="Spoken English, batch 3" value={f.title} onChange={set('title')} error={err.title} />
                <div className="grid-2">
                  <Select label="Type" options={[{ value: 'orientation', label: 'Orientation' }, { value: 'skill', label: 'Skill training' }]} placeholder="Choose" value={f.kind} onChange={set('kind')} />
                  <Input label="Date" required type="date" value={f.held_on} onChange={set('held_on')} error={err.held_on} />
                </div>
                <div className="grid-2">
                  <Input label="Venue" required placeholder="STG Office" value={f.venue} onChange={set('venue')} error={err.venue} />
                  <Input label="Location" placeholder="Belagavi" value={f.location} onChange={set('location')} />
                </div>
                <div className="grid-2">
                  <Input label="Trainer" value={f.trainer} onChange={set('trainer')} />
                  <Input label="Budget (₹)" type="number" min="0" step="50" value={f.budget} onChange={set('budget')} />
                </div>
                <div className={`field ${err.students ? 'has-error' : ''}`}>
                  <span className="label req">Students</span>
                  <div className="picklist">
                    {data.students.map((s) => (
                      <label key={s.id}><input type="checkbox" checked={f.students.includes(s.id)}
                        onChange={(e) => setF({ ...f, students: e.target.checked ? [...f.students, s.id] : f.students.filter((x) => x !== s.id) })} />
                        {s.full_name} <span className="muted small">{s.district}</span></label>
                    ))}
                  </div>
                  {err.students && <div className="field-error">{err.students}</div>}
                </div>
                <button className="btn btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create session'}</button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
