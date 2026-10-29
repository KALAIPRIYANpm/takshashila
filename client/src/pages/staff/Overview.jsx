import { PageHead, Panel } from '../../components/layout.jsx';
import { Avatar, Empty, ErrorNote, Icon, Spinner, useTitle } from '../../components/ui.jsx';
import { inr, niceDate } from '../../lib.js';
import { Link } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

const ORDER = ['submitted', 'field_verified', 'approved', 'disbursed', 'rejected'];
const VERB = { submitted: 'submitted', forwarded: 'verified', approved: 'approved', rejected: 'rejected', sent_back: 'sent back' };

export function ScoreBar({ value }) {
  return <span className="score"><span className="score-track"><i style={{ width: `${value}%` }} /></span>{Math.round(value)}</span>;
}

export default function Overview() {
  useTitle('Overview');
  const { auth, meta } = useApp();
  const { data, loading, error, reload } = useApi('/api/staff/overview');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const u = auth.user;
  const hour = new Date().getHours();
  const maxN = Math.max(1, ...data.byDistrict.map((d) => d.n));
  const selected = (data.byStatus.approved || 0) + (data.byStatus.disbursed || 0);

  return (
    <>
      <PageHead title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${u.name.split(' ')[0]}`}
        sub={u.role === 'field' ? `Students in ${u.district} and those you registered` : 'All projects and districts'}>
        <Link className="btn" to="/staff/applications/new">Register a student</Link>
      </PageHead>

      <div className="figures">
        <div><b>{data.total}</b><span>Applications</span></div>
        <div><b>{selected}</b><span>Students selected</span></div>
        <div><b>{inr(data.sanctioned)}</b><span>Sanctioned</span></div>
        <div><b>{inr(data.paid)}</b><span>Paid to colleges and vendors</span></div>
      </div>

      <div className="cols">
        <div className="col-main">
          <Panel title={data.todoCount ? `${data.todoCount} waiting for ${u.role === 'field' ? 'your home visit' : 'your decision'}` : 'Your queue'}
            aside={<Link to={`/staff/applications?status=${data.todoStatus}`}>See all</Link>} className="queue">
            {data.todo.length ? (
              <ul className="queue-list">
                {data.todo.map((a) => (
                  <li key={a.id}>
                    <Link to={`/staff/applications/${a.id}`}>
                      <Avatar name={a.full_name} />
                      <span className="q-name"><b>{a.full_name}</b><span>{a.course}, {a.district}</span></span>
                      <ScoreBar value={a.final_score} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty title="You're up to date">Nothing is waiting for you right now.</Empty>}
          </Panel>

          <Panel title={data.infraCount ? `${data.infraCount} school request${data.infraCount > 1 ? 's' : ''} waiting for ${u.role === 'field' ? 'a site visit' : 'a decision'}` : 'School infrastructure'}
            aside={<Link to={`/staff/infrastructure?status=${data.infraStatus}`}>See all</Link>}>
            {data.infraTodo.length ? (
              <ul className="queue-list">
                {data.infraTodo.map((r) => (
                  <li key={r.id}>
                    <Link to={`/staff/infrastructure/${r.id}`}>
                      <span className="avatar school-mark" aria-hidden="true"><Icon name="school" /></span>
                      <span className="q-name"><b>{r.school}</b><span>{r.title} · {r.district} · {inr(r.estimate)}</span></span>
                      <ScoreBar value={r.priority} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty title="No school requests waiting">New requests from schools appear here, highest priority first.</Empty>}
          </Panel>

          <Panel title="Where applications are">
            <div className="pipeline" role="img" aria-label={ORDER.map((s) => `${meta.statuses[s]} ${data.byStatus[s] || 0}`).join(', ')}>
              {ORDER.map((s) => data.byStatus[s] ? <span key={s} className={`c-${s}`} style={{ flexGrow: data.byStatus[s] }} title={`${meta.statuses[s]}: ${data.byStatus[s]}`} /> : null)}
            </div>
            <ul className="legend">{ORDER.map((s) => <li key={s}><i className={`c-${s}`} />{meta.statuses[s]} <b>{data.byStatus[s] || 0}</b></li>)}</ul>
          </Panel>

          <Panel title="By district" aside={<ul className="legend"><li><i className="c-field_verified" />Selected</li><li><i className="c-submitted" />Applied</li></ul>}>
            <div className="bars">
              {data.byDistrict.map((d) => (
                <div className="bar-row" key={d.district}>
                  <span>{d.district}</span>
                  <span className="bar"><i style={{ width: `${(d.n / maxN) * 100}%` }} /><i className="funded" style={{ width: `${(d.funded / maxN) * 100}%` }} /></span>
                  <span className="n">{d.funded} of {d.n}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="col-side">
          {data.payWaiting.length > 0 && (
            <Panel title={u.role === 'admin' ? 'Payments to release' : 'Payments to approve'} aside={<Link to={`/staff/payments?status=${u.role === 'admin' ? 'approved' : 'requested'}`}>Open</Link>}>
              <ul className="list">{data.payWaiting.map((p) => <li key={p.id}><span>{p.payee}<br /><span className="muted small">{p.full_name || p.kind}</span></span><b>{inr(p.amount)}</b></li>)}</ul>
            </Panel>
          )}
          {data.atRisk.length > 0 && (
            <Panel title="Students who need a call" tone="warn">
              <ul className="list">{data.atRisk.map((r, i) => <li key={i}><Link to={`/staff/applications/${r.app_id}`}>{r.full_name}</Link><span className="text-warn small">{r.marks}% marks, {r.attendance}% attendance</span></li>)}</ul>
            </Panel>
          )}
          <Panel title="Recent activity">
            <ul className="timeline">
              {data.activity.map((r, i) => (
                <li key={i}><b>{r.actor}</b> {VERB[r.action]} <Link to={`/staff/applications/${r.app_id}`}>{r.full_name}</Link>
                  <div className="when">{niceDate(r.created_at, true)}</div></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
