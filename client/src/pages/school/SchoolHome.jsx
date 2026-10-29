import { useEffect } from 'react';
import { InfraBadge } from '../../components/infra.jsx';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ProfileMeter } from '../../components/school.jsx';
import { Empty, ErrorNote, Icon, Spinner, useTitle } from '../../components/ui.jsx';
import { inr, niceDate } from '../../lib.js';
import { Link, navigate } from '../../router.jsx';
import { useApi } from '../../state.jsx';

export default function SchoolHome() {
  useTitle('School dashboard');
  const { data, loading, error, reload } = useApi('/api/school/me');
  // First visit: the school profile comes before any request.
  useEffect(() => { if (data && !data.school) navigate('/school/profile', { replace: true }); }, [data]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data.school) return <Spinner />;
  const { school, requests } = data;
  const open = requests.filter((r) => ['submitted', 'verified'].includes(r.status)).length;
  const sanctioned = requests.reduce((s, r) => s + (r.amount_sanctioned || 0), 0);
  const delivered = requests.filter((r) => r.status === 'delivered').length;

  return (
    <>
      <PageHead title={school.name} sub={`UDISE ${school.udise_code} · ${school.village && school.village !== school.district ? `${school.village}, ` : ''}${school.district} · ${school.students} students`}>
        <Link className="btn btn-ghost" to="/school/profile"><Icon name="edit" />Edit profile</Link>
        <Link className="btn" to="/school/requests/new"><Icon name="plus" />New request</Link>
      </PageHead>

      {!data.status.ready && (
        <section className="profile-alert">
          <ProfileMeter status={data.status} compact />
          <p className="small flush">Still needed before you can make a request: <b>{data.status.missing.join(', ')}</b>.</p>
          <Link className="btn btn-sm" to={data.status.missing.some((m) => m.includes('Photo')) && data.status.missing.length === 1 ? '/school/profile#photos' : '/school/profile'}>Complete profile</Link>
        </section>
      )}
      <div className="figures">
        <div><b>{requests.length}</b><span>Requests made</span></div>
        <div><b>{open}</b><span>Waiting for review</span></div>
        <div><b>{inr(sanctioned)}</b><span>Sanctioned for your school</span></div>
        <div><b>{delivered}</b><span>Delivered</span></div>
      </div>

      <div className="cols">
        <div className="col-main">
          {requests.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Request</th><th className="num">Items</th><th className="num">Estimate</th><th className="num">Sanctioned</th><th>Status</th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="clickable" onClick={(e) => { if (e.target.tagName !== 'A') navigate(`/school/requests/${r.id}`); }}>
                      <td><Link className="rowlink" to={`/school/requests/${r.id}`}>{r.title}</Link><span className="muted small">{r.code} · {niceDate(r.created_at)}</span></td>
                      <td className="num">{r.items}</td>
                      <td className="num">{inr(r.estimate)}</td>
                      <td className="num">{inr(r.amount_sanctioned)}</td>
                      <td><InfraBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Panel>
              <Empty title="No requests yet" action={<Link className="btn" to="/school/requests/new">Make your first request</Link>}>
                Ask for desks, fans, drinking water, toilet repairs, books and more. Add photos so the field executive can plan the visit.
              </Empty>
            </Panel>
          )}
        </div>
        <div className="col-side">
          <Panel title="How it works">
            <ol className="steps-list">
              <li><b>Request</b> the items your school needs, with photos of the current condition.</li>
              <li><b>Site visit</b> by our field executive within 10 working days.</li>
              <li><b>Approval</b> by the programme committee, with a sanctioned budget.</li>
              <li><b>Order</b>: we pay the vendor directly. The school never handles money.</li>
              <li><b>Confirm delivery</b> here with photos of the items in use.</li>
            </ol>
          </Panel>
          <Panel title="What we prioritise">
            <p className="muted small">Requests are ranked by need: water and sanitation, and safety come first, then furniture and repairs. Government schools, larger enrolment and more pupils per teacher rank higher. Explain the problem clearly and add photos.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
