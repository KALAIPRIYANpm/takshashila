import { useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { Choices, Empty, ErrorNote, Input, Select, Spinner, useTitle } from '../../components/ui.jsx';
import { api, niceDate } from '../../lib.js';
import { useApi, useApp } from '../../state.jsx';

const blank = { company: '', title: '', kind: 'internship', deadline: '', location: '', stipend: '', link: '', for_levels: [] };

export default function Opportunities() {
  useTitle('Opportunities');
  const { meta, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/staff/opportunities');
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const post = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      await api.post('/api/staff/opportunities', f);
      notify('Posted. Matching students see it on their page now.');
      setF(blank); reload();
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Internships and jobs" sub="Students see an opening only if it matches their level of study." />
      <div className="cols">
        <Panel className="col-main">
          {data.rows.length ? data.rows.map((o) => (
            <div className="opp" key={o.id}>
              <div><h4>{o.title}</h4><span className="muted small">{o.company}, {o.location}. {o.kind}{o.stipend ? `, ${o.stipend}` : ''}</span><br />
                <span className="small">For: {o.for_levels ? o.for_levels.split(',').join(', ') : 'all students'}</span></div>
              <span className="muted small nowrap">Apply by {niceDate(o.deadline)}</span>
            </div>
          )) : <Empty title="No openings posted">Post one with the form.</Empty>}
        </Panel>
        <div className="col-side">
          <Panel title="Post an opening">
            <form onSubmit={post} noValidate>
              <Input label="Company" required value={f.company} onChange={set('company')} error={err.company} />
              <Input label="Role" required placeholder="Data entry intern" value={f.title} onChange={set('title')} error={err.title} />
              <div className="grid-2">
                <Select label="Type" options={[{ value: 'internship', label: 'Internship' }, { value: 'job', label: 'Job' }, { value: 'course', label: 'Free course' }]} value={f.kind} onChange={set('kind')} />
                <Input label="Apply by" type="date" value={f.deadline} onChange={set('deadline')} />
              </div>
              <div className="grid-2">
                <Input label="Location" placeholder="Remote, Belagavi" value={f.location} onChange={set('location')} />
                <Input label="Stipend or salary" placeholder="₹8,000 a month" value={f.stipend} onChange={set('stipend')} />
              </div>
              <Input label="Link to apply" type="url" placeholder="https://" value={f.link} onChange={set('link')} error={err.link} />
              <Choices name="for_levels" legend="Who can apply" multiple options={meta.levels.map((l) => ({ value: l, label: l }))} value={f.for_levels} onChange={(v) => setF({ ...f, for_levels: v })} />
              <p className="muted small">Leave all unticked to show it to everyone.</p>
              <button className="btn btn-block" disabled={busy}>{busy ? 'Posting…' : 'Post opening'}</button>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
