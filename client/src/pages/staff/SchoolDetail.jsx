import { InfraBadge } from '../../components/infra.jsx';
import { PageHead, Panel } from '../../components/layout.jsx';
import { FacilitiesView, GapList, LocationMap, ProfileMeter, SchoolFacts, SchoolPhotos } from '../../components/school.jsx';
import { ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { inr, niceDate } from '../../lib.js';
import { Link, navigate } from '../../router.jsx';
import { useApi } from '../../state.jsx';

export default function SchoolDetail({ id }) {
  const { data, loading, error, reload } = useApi(`/api/staff/schools/${id}`);
  useTitle(data?.school?.name || 'School');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { school: s, photos, gaps, status, contact, requests } = data;

  return (
    <>
      <PageHead crumb={['/staff/schools', 'All schools']} title={s.name}
        sub={`UDISE ${s.udise_code} · ${[s.taluk && `${s.taluk} taluk`, s.district].filter(Boolean).join(', ')} · registered ${niceDate(s.created_at)}`}>
        {contact && <a className="btn btn-ghost" href={`tel:${contact.phone}`}>Call {contact.phone}</a>}
      </PageHead>
      <ProfileMeter status={status} compact />
      <div className="cols mt">
        <div className="col-main">
          <Panel title="Facility gaps" tone={gaps.length ? 'warn' : undefined}><GapList gaps={gaps} /></Panel>
          <Panel title="Facilities checklist" aside={`Updated ${niceDate(s.updated_at)}`}><FacilitiesView school={s} /></Panel>
          <Panel title="Photos" aside={`${photos.filter((p) => p.latitude != null).length} of ${photos.length} geo-tagged`}><SchoolPhotos photos={photos} /></Panel>
          <Panel title="Infrastructure requests">
            {requests.length ? (
              <div className="table-wrap flat">
                <table className="data">
                  <thead><tr><th>Request</th><th className="num">Priority</th><th className="num">Estimate</th><th className="num">Sanctioned</th><th>Stage</th></tr></thead>
                  <tbody>{requests.map((r) => (
                    <tr key={r.id} className="clickable" onClick={(e) => { if (e.target.tagName !== 'A') navigate(`/staff/infrastructure/${r.id}`); }}>
                      <td><Link className="rowlink" to={`/staff/infrastructure/${r.id}`}>{r.title}</Link><span className="muted small">{r.code} · {niceDate(r.created_at)}</span></td>
                      <td className="num">{Math.round(r.priority)}</td><td className="num">{inr(r.estimate)}</td><td className="num">{inr(r.amount_sanctioned)}</td>
                      <td><InfraBadge status={r.status} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="muted flush">No requests yet.</p>}
          </Panel>
        </div>
        <div className="col-side">
          <Panel title="Location" aside={s.latitude == null ? <span className="text-warn">Not geo-tagged</span> : null}>
            {s.latitude != null ? <LocationMap lat={s.latitude} lng={s.longitude} accuracy={s.location_accuracy} at={s.located_at} />
              : <p className="muted small flush">Ask the school to capture its location from the profile page, or record it at the site visit.</p>}
          </Panel>
          <Panel title="School"><SchoolFacts school={s} /></Panel>
          {contact && <Panel title="Portal account"><dl className="kv"><dt>Name</dt><dd>{contact.name}</dd><dt>Mobile</dt><dd>{contact.phone}</dd><dt>Role</dt><dd>{s.contact_role || '—'}</dd>{s.email && <><dt>Email</dt><dd>{s.email}</dd></>}</dl></Panel>}
        </div>
      </div>
    </>
  );
}
