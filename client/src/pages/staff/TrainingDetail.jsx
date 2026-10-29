import { useEffect, useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { api, inr, niceDate } from '../../lib.js';
import { useApi, useApp } from '../../state.jsx';

export default function TrainingDetail({ id }) {
  const { notify } = useApp();
  const { data, loading, error, reload } = useApi(`/api/staff/trainings/${id}`);
  const [present, setPresent] = useState(new Set());
  const [busy, setBusy] = useState(false);
  useTitle(data?.training?.title || 'Training');
  useEffect(() => { if (data) setPresent(new Set(data.roster.filter((r) => r.present).map((r) => r.id))); }, [data]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const t = data.training;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put(`/api/staff/trainings/${id}/attendance`, { present: [...present] });
      notify(`Attendance saved: ${r.present} present.`);
      reload();
    } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead crumb={['/staff/training', 'All sessions']} title={t.title}
        sub={`${niceDate(t.held_on)}, ${t.venue}${t.location ? `, ${t.location}` : ''}${t.trainer ? `. Trainer: ${t.trainer}` : ''}. Budget ${inr(t.budget)}`} />
      <Panel title="Attendance" aside={<button className="linkish" onClick={() => setPresent(new Set(data.roster.map((r) => r.id)))}>Mark everyone present</button>} className="narrow">
        <ul className="attend">
          {data.roster.map((r) => (
            <li key={r.id}><label>
              <input type="checkbox" checked={present.has(r.id)} onChange={(e) => {
                const n = new Set(present); e.target.checked ? n.add(r.id) : n.delete(r.id); setPresent(n);
              }} />
              <span><b>{r.full_name}</b><br /><span className="muted small">{r.course}, {r.institution}</span></span>
            </label></li>
          ))}
        </ul>
        <div className="row mt"><button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save attendance'}</button><span className="muted small">{present.size} of {data.roster.length} present</span></div>
      </Panel>
    </>
  );
}
