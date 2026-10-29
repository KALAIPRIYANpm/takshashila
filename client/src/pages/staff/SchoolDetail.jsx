import { useEffect, useState } from 'react';
import { InfraBadge } from '../../components/infra.jsx';
import { PageHead, Panel } from '../../components/layout.jsx';
import { PhotoManager } from '../../components/SchoolForm.jsx';
import { FacilitiesView, GapList, LocationMap, ProfileMeter, SchoolFacts, VerificationBadge } from '../../components/school.jsx';
import { ErrorNote, Icon, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, getPosition, inr, niceDate } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

/** Verify or reject a school after visiting it. Managers can also reopen a decision. */
function Verification({ s, verifiedBy, onDone }) {
  const { auth, meta, notify } = useApp();
  const [checks, setChecks] = useState({});
  const [note, setNote] = useState('');
  const [loc, setLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState({});
  const isManager = ['manager', 'admin'].includes(auth.user.role);
  const list = meta.infra.verificationChecks;
  const allChecked = list.every((c) => checks[c.key]);

  const capture = async () => {
    setLocating(true);
    const p = await getPosition({ maximumAge: 0, timeout: 20000 });
    setLocating(false);
    if (!p) return notify('Could not get the location. Allow location access and try again outdoors.', 'error');
    setLoc(p);
  };

  const act = async (status) => {
    setBusy(status); setErr({});
    try {
      await api.post(`/api/staff/schools/${s.id}/verification`, { status, note, checks, ...(loc ? { latitude: loc.lat, longitude: loc.lng, accuracy: loc.accuracy } : {}) });
      notify({ verified: 'School verified. Its requests can now move ahead.', rejected: 'Registration rejected. The school will see your reason.', pending: 'Verification reopened.' }[status]);
      onDone();
    } catch (x) { setErr(x.fields || {}); notify(x.message, 'error'); } finally { setBusy(null); }
  };

  if (s.verification !== 'pending') {
    return (
      <Panel tone={s.verification === 'verified' ? 'ok' : 'warn'} title={s.verification === 'verified' ? 'Verified school' : 'Registration not approved'}
        aside={isManager && <button className="linkish" disabled={!!busy} onClick={() => act('pending')}>Reopen</button>}>
        <p className="small flush">
          {s.verification === 'verified' ? 'Verified' : 'Rejected'}{verifiedBy ? ` by ${verifiedBy.name}` : ''}{s.verified_at ? ` on ${niceDate(s.verified_at)}` : ''}.
          {s.verification_note && <> “{s.verification_note}”</>}
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="decision" title="Verify this school" aside="Pending">
      <p className="small muted">Visit the school before verifying. Its requests can't move past “Submitted” until it is verified.</p>
      <fieldset className={cx('checks', err.checks && 'has-error')}>
        <legend className="sr-only">What you confirmed</legend>
        {list.map((c) => (
          <label key={c.key} className="check">
            <input type="checkbox" checked={!!checks[c.key]} onChange={(e) => { setChecks({ ...checks, [c.key]: e.target.checked }); setErr({}); }} />
            <span>{c.label}</span>
          </label>
        ))}
        <p className="field-help">Look up {s.udise_code} on <a href="https://udiseplus.gov.in" target="_blank" rel="noopener noreferrer">udiseplus.gov.in</a> (Know your school).</p>
        {err.checks && <div className="field-error">{err.checks}</div>}
      </fieldset>
      <div className="geo-inline">
        <button type="button" className="btn btn-sm btn-ghost" disabled={locating} onClick={capture}><Icon name="locate" />{locating ? 'Finding…' : loc ? 'Capture again' : 'Record location from my phone'}</button>
        <span className="small muted">{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} · ±${loc.accuracy} m, saved with the verification` : s.latitude == null ? 'The school has no geo-tag yet. Record it while you are there.' : 'Optional: replaces the school’s geo-tag.'}</span>
      </div>
      <div className={cx('field', err.note && 'has-error')}>
        <label htmlFor="vnote">Notes</label>
        <textarea id="vnote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who you met, anything that didn't match. Required if you reject; the school sees it." />
        {err.note && <div className="field-error">Add the reason for rejecting.</div>}
      </div>
      <div className="row">
        <button className="btn" disabled={!!busy || !allChecked} onClick={() => act('verified')}>{busy === 'verified' ? 'Verifying…' : 'Verify school'}</button>
        {!allChecked && <span className="small muted">Tick every check to verify.</span>}
        <button className="btn btn-danger push" disabled={!!busy} onClick={() => act('rejected')}>Reject registration</button>
      </div>
    </Panel>
  );
}

export default function SchoolDetail({ id }) {
  const { hash } = useLocation();
  const { data, loading, error, reload } = useApi(`/api/staff/schools/${id}`);
  useTitle(data?.school?.name || 'School');
  useEffect(() => { if (data && hash === '#photos') setTimeout(() => document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth' }), 120); }, [data, hash]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const { school: s, photos, gaps, status, contact, requests, registeredBy, verifiedBy } = data;

  return (
    <>
      <PageHead crumb={['/staff/schools', 'All schools']} title={<span className="title-who">{s.name} <VerificationBadge status={s.verification} /></span>}
        sub={`UDISE ${s.udise_code} · ${[s.taluk && `${s.taluk} taluk`, s.district].filter(Boolean).join(', ')} · ${registeredBy ? `registered by ${registeredBy.name}` : 'self-registered'} ${niceDate(s.created_at)}`}>
        {contact && <a className="btn btn-ghost" href={`tel:${contact.phone}`}>Call {contact.phone}</a>}
        <Link className="btn btn-ghost" to={`/staff/schools/${s.id}/edit`}><Icon name="edit" />Edit</Link>
      </PageHead>
      <ProfileMeter status={status} compact />
      <div className="cols mt">
        <div className="col-main">
          <Verification s={s} verifiedBy={verifiedBy} onDone={reload} />
          <Panel title="Facility gaps" tone={gaps.length ? 'warn' : undefined}><GapList gaps={gaps} /></Panel>
          <Panel title="Facilities checklist" aside={`Updated ${niceDate(s.updated_at)}`}><FacilitiesView school={s} /></Panel>
          <PhotoManager title="Photos" photos={photos} onChange={reload}
            uploadUrl={(kind) => `/api/staff/schools/${s.id}/photos/${kind}`} deleteUrl={(pid) => `/api/staff/schools/${s.id}/photos/${pid}`} />
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
              : <p className="muted small flush">Not recorded yet. Record it from your phone when you verify the school.</p>}
          </Panel>
          <Panel title="School"><SchoolFacts school={s} /></Panel>
          {contact && (
            <Panel title="Portal account">
              <dl className="kv">
                <dt>Mobile</dt><dd>{contact.phone}</dd>
                <dt>Role</dt><dd>{s.contact_role || '—'}</dd>
                {s.email && <><dt>Email</dt><dd>{s.email}</dd></>}
                <dt>Registered</dt><dd>{registeredBy ? `By ${registeredBy.name} on the school's behalf` : 'By the school itself'}</dd>
              </dl>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
