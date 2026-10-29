// School profile building blocks shared by the school portal and the staff screens.
import { cx, mapsLink, niceDate } from '../lib.js';
import { useApp } from '../state.jsx';
import { Badge, Icon } from './ui.jsx';

/** Small OpenStreetMap preview of a point, with a link to open it in Google Maps. */
export function LocationMap({ lat, lng, accuracy, at, height = 220 }) {
  if (lat == null || lng == null) return null;
  const d = 0.006;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="map">
      <iframe title="School location" src={src} style={{ height }} loading="lazy" referrerPolicy="no-referrer" />
      <div className="map-foot">
        <span><Icon name="pin" />{lat.toFixed(5)}, {lng.toFixed(5)}{accuracy != null ? ` · ±${accuracy} m` : ''}{at ? ` · ${niceDate(at)}` : ''}</span>
        <a href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
      </div>
    </div>
  );
}

/** School photos grouped by kind. A pin marks photos the phone geo-tagged when they were taken. */
export function SchoolPhotos({ photos, onDelete, busyId }) {
  const { meta } = useApp();
  if (!photos.length) return <p className="muted small flush">No school photos yet.</p>;
  return (
    <div className="thumbs">
      {photos.map((p) => (
        <figure key={p.id} className="thumb photo">
          <a href={`/api/school-photos/${p.id}`} target="_blank" rel="noopener noreferrer" className="thumb-img">
            <img src={`/api/school-photos/${p.id}`} alt={meta.infra.photoKinds[p.kind]} loading="lazy" />
          </a>
          <figcaption className="thumb-cap">
            <span>{meta.infra.photoKinds[p.kind]}</span>
            {p.latitude != null
              ? <a className="geo-ok" href={mapsLink(p.latitude, p.longitude)} target="_blank" rel="noopener noreferrer" title={`Taken at ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}><Icon name="pin" />Geo-tagged</a>
              : <span className="geo-no">No location</span>}
          </figcaption>
          {onDelete && <button type="button" className="photo-del" disabled={busyId === p.id} onClick={() => onDelete(p)} aria-label="Delete photo"><Icon name="trash" /></button>}
        </figure>
      ))}
    </div>
  );
}

export function GapList({ gaps, empty = 'No major gaps in basic facilities.' }) {
  if (!gaps?.length) return <p className="text-ok small flush">{empty}</p>;
  return <ul className="gaps">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>;
}

/** The facilities checklist as answered by the school: green for what is there, red for what is missing. */
export function FacilitiesView({ school }) {
  const { meta } = useApp();
  const f = school.facilities || {};
  const good = (q, v) => {
    if (v === undefined || v === null || v === '') return null;
    if (q.type === 'yesno') return v === 'Yes';
    if (q.key === 'classrooms_repair') return v === 0;
    if (q.type === 'count') return v > 0;
    return ['Pucca', 'Yes, working', 'Tap water', 'Borewell / hand pump'].includes(v);
  };
  return (
    <ul className="facilities">
      {meta.infra.facilities.map((q) => {
        const v = f[q.key];
        const ok = good(q, v);
        return (
          <li key={q.key} className={cx(ok === true && 'ok', ok === false && 'bad')}>
            <span>{q.label}</span><b>{v === undefined || v === null || v === '' ? '—' : String(v)}</b>
          </li>
        );
      })}
    </ul>
  );
}

export function ProfileMeter({ status, compact }) {
  return (
    <div className={cx('meter', compact && 'meter-compact', status.ready && 'meter-ready')}>
      <div className="meter-head">
        <b>Profile {status.percent}% complete</b>
        <span>{status.ready ? 'Ready to make requests' : 'Complete the required items to make requests'}</span>
      </div>
      <span className="meter-bar"><i style={{ width: `${status.percent}%` }} /></span>
      {!compact && (status.missing.length > 0 || status.suggested?.length > 0) && (
        <ul className="meter-todo">
          {status.missing.map((m) => <li key={m} className="req-item">{m}</li>)}
          {status.suggested?.map((m) => <li key={m}>{m} <span className="muted">(recommended)</span></li>)}
        </ul>
      )}
    </div>
  );
}

/** Key facts about a school for staff: enrolment by gender, staff, location and context. */
export function SchoolFacts({ school }) {
  const s = school;
  const ptr = Math.round(s.students / Math.max(1, s.teachers));
  const pct = (n) => (s.students ? Math.round((n / s.students) * 100) : 0);
  return (
    <dl className="kv">
      <dt>UDISE code</dt><dd>{s.udise_code}</dd>
      <dt>Type</dt><dd>{s.school_type}, {s.level}</dd>
      {(s.medium || s.board) && <><dt>Medium, board</dt><dd>{[s.medium, s.board, s.shifts].filter(Boolean).join(' · ')}</dd></>}
      {s.established && <><dt>Established</dt><dd>{s.established}</dd></>}
      <dt>Students</dt>
      <dd>{s.students}{s.boys != null ? <span className="muted"> · {s.boys} boys, {s.girls} girls ({pct(s.girls)}%)</span> : s.girls != null ? <span className="muted"> · {s.girls} girls</span> : null}</dd>
      {s.cwsn != null && <><dt>With special needs</dt><dd>{s.cwsn}</dd></>}
      <dt>Teachers</dt>
      <dd>{s.teachers}{s.male_teachers != null && <span className="muted"> · {s.male_teachers} male, {s.female_teachers} female</span>}
        <span className={cx('small', ptr > 30 ? 'text-warn' : 'muted')}> · {ptr} pupils per teacher</span></dd>
      {s.non_teaching != null && <><dt>Non-teaching staff</dt><dd>{s.non_teaching}</dd></>}
      {s.classrooms != null && <><dt>Classrooms</dt><dd>{s.classrooms}</dd></>}
      <dt>Headmaster</dt><dd>{s.headmaster}{s.headmaster_phone && <> · <a href={`tel:${s.headmaster_phone}`}>{s.headmaster_phone}</a></>}</dd>
      <dt>Area</dt><dd>{[s.area_type, s.taluk && `${s.taluk} taluk`, s.district].filter(Boolean).join(', ')}</dd>
      {s.area_tags && <><dt>Context</dt><dd><span className="tags">{s.area_tags.split(',').map((t) => <span className="tag tag-warn" key={t}>{t}</span>)}</span></dd></>}
      <dt>Address</dt><dd>{[...new Set([s.address, s.village, s.gram_panchayat, s.district, s.state, s.pin].filter(Boolean))].join(', ')}</dd>
    </dl>
  );
}

const VERIFY_LABEL = { pending: 'Pending verification', verified: 'Verified', rejected: 'Not approved' };

export function VerificationBadge({ status }) {
  return <Badge status={`v-${status}`}>{VERIFY_LABEL[status]}</Badge>;
}

/** What the school sees about its own verification. */
export function VerificationNote({ school }) {
  if (school.verification === 'verified') {
    return <p className="verify-note ok"><Icon name="check" />Your school is verified{school.verified_at ? ` since ${niceDate(school.verified_at)}` : ''}.</p>;
  }
  if (school.verification === 'rejected') {
    return (
      <div className="verify-note bad">
        <b>Your school's registration was not approved.</b>
        {school.verification_note && <span> Reason: {school.verification_note}</span>}
        <span> Call the helpline on 1800-000-0000 if you think this is a mistake.</span>
      </div>
    );
  }
  return (
    <div className="verify-note pending">
      <b>Verification pending.</b> A field executive will visit to confirm your school's details. You can make requests meanwhile; they move ahead once the school is verified.
      {school.verification_note && <span className="muted"> ({school.verification_note})</span>}
    </div>
  );
}
