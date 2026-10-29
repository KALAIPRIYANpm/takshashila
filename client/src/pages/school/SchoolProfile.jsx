import { useEffect, useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { LocationMap, ProfileMeter, SchoolPhotos } from '../../components/school.jsx';
import { Choices, ErrorNote, Icon, Input, Select, Spinner, useTitle } from '../../components/ui.jsx';
import { api, cx, getPosition, uploadTo } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

const FIELDS = ['name', 'udise_code', 'school_type', 'level', 'medium', 'board', 'shifts', 'established', 'headmaster', 'headmaster_phone', 'contact_role', 'email',
  'address', 'village', 'gram_panchayat', 'taluk', 'district', 'state', 'pin', 'area_type', 'boys', 'girls', 'cwsn', 'male_teachers', 'female_teachers',
  'non_teaching', 'classrooms', 'latitude', 'longitude', 'location_accuracy'];
const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);

function toForm(s) {
  const f = Object.fromEntries(FIELDS.map((k) => [k, s?.[k] ?? (k === 'state' ? 'Karnataka' : '')]));
  f.area_tags = s?.area_tags ? s.area_tags.split(',') : [];
  f.facilities = { ...(s?.facilities || {}) };
  return f;
}

export default function SchoolProfile() {
  useTitle('School profile');
  const { meta, notify } = useApp();
  const { hash } = useLocation();
  const { data, loading, error, reload } = useApi('/api/school/me');
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (data && !f) setF(toForm(data.school)); }, [data, f]);
  useEffect(() => { if (data && hash === '#photos') setTimeout(() => document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth' }), 120); }, [data, hash]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!f) return <Spinner />;

  const first = !data.school;
  const { facilities: FAC, areaTypes, areaTags, boards, shifts } = meta.infra;
  const set = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: undefined })); };
  const setFac = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((x) => ({ ...x, facilities: { ...x.facilities, [k]: v } })); setErr((x) => ({ ...x, [`f_${k}`]: undefined })); };
  const students = num(f.boys) + num(f.girls);
  const teachers = num(f.male_teachers) + num(f.female_teachers);
  const ptr = teachers ? Math.round(students / teachers) : null;

  const capture = async () => {
    setLocating(true);
    const p = await getPosition({ maximumAge: 0, timeout: 20000 });
    setLocating(false);
    if (!p) return notify('Could not get the location. Allow location access for this site, turn on GPS, and try again outdoors.', 'error');
    setF((x) => ({ ...x, latitude: p.lat, longitude: p.lng, location_accuracy: p.accuracy }));
    setErr((x) => ({ ...x, latitude: undefined }));
    notify(p.accuracy > 100 ? `Location captured, but only accurate to ${p.accuracy} m. Try again outdoors for a better fix.` : `Location captured, accurate to ${p.accuracy} m. Save to keep it.`, p.accuracy > 100 ? 'warn' : 'success');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      await api.put('/api/school/me', f);
      if (first) {
        notify('School profile saved. Now add photos of your school.');
        await reload();
        navigate('/school/profile#photos', { replace: true });
      } else {
        notify('School profile saved.');
        reload();
      }
    } catch (x) {
      setErr(x.fields || {}); notify(x.message, 'error');
      setTimeout(() => document.querySelector('.has-error input, .has-error select, .has-error textarea, fieldset.has-error input')?.focus(), 30);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title={first ? 'Register your school' : 'School profile'} crumb={first ? null : ['/school', 'Dashboard']}
        sub={first ? 'A one-time step. These details help us verify your school and prioritise requests fairly. It takes about 10 minutes.' : 'Keep these details current. Enrolment, staff and facilities affect how requests are prioritised.'} />
      {!first && <ProfileMeter status={data.status} />}

      <form onSubmit={save} noValidate className="narrow profile-form">
        <Panel title="1. School">
          <Input label="School name" required placeholder="Govt Higher Primary School, Hukkeri" value={f.name} onChange={set('name')} error={err.name} />
          <div className="grid-2">
            <Input label="UDISE code" required inputMode="numeric" maxLength={11} placeholder="11 digits" value={f.udise_code} onChange={set('udise_code')} error={err.udise_code}
              help="Printed on school records and on udiseplus.gov.in." />
            <Select label="School type" required options={meta.infra.schoolTypes} value={f.school_type} onChange={set('school_type')} error={err.school_type} />
          </div>
          <div className="grid-2">
            <Select label="Classes taught" required options={meta.infra.levels} value={f.level} onChange={set('level')} error={err.level} />
            <Select label="Medium of instruction" options={meta.infra.mediums} value={f.medium} onChange={set('medium')} />
          </div>
          <div className="grid-3">
            <Select label="Board" options={boards} value={f.board} onChange={set('board')} error={err.board} />
            <Select label="Shifts" options={shifts} value={f.shifts} onChange={set('shifts')} error={err.shifts} />
            <Input label="Year established" type="number" min="1800" max={new Date().getFullYear()} placeholder="e.g. 1972" value={f.established} onChange={set('established')} error={err.established} />
          </div>
        </Panel>

        <Panel title="2. Students and staff" aside="As on the latest UDISE+ return">
          <div className="grid-3">
            <Input label="Boys enrolled" required type="number" min="0" value={f.boys} onChange={set('boys')} error={err.boys} />
            <Input label="Girls enrolled" required type="number" min="0" value={f.girls} onChange={set('girls')} error={err.girls} />
            <Input label="Children with special needs" type="number" min="0" value={f.cwsn} onChange={set('cwsn')} error={err.cwsn} help="CWSN, included in the totals." />
          </div>
          <div className="grid-3">
            <Input label="Male teachers" required type="number" min="0" value={f.male_teachers} onChange={set('male_teachers')} error={err.male_teachers} />
            <Input label="Female teachers" required type="number" min="0" value={f.female_teachers} onChange={set('female_teachers')} error={err.female_teachers} />
            <Input label="Non-teaching staff" type="number" min="0" value={f.non_teaching} onChange={set('non_teaching')} error={err.non_teaching} />
          </div>
          <div className="grid-3">
            <Input label="Classrooms" required type="number" min="0" value={f.classrooms} onChange={set('classrooms')} error={err.classrooms} />
          </div>
          <div className="summary-strip" aria-live="polite">
            <span><b>{students}</b> students{students ? ` · ${Math.round((num(f.girls) / students) * 100)}% girls` : ''}</span>
            <span><b>{teachers}</b> teachers</span>
            <span className={cx(ptr > 30 && 'text-warn')}><b>{ptr ?? '—'}</b> pupils per teacher{ptr > 30 ? ' (norm is 30)' : ''}</span>
            {num(f.classrooms) > 0 && <span><b>{Math.round(students / num(f.classrooms))}</b> per classroom</span>}
          </div>
        </Panel>

        <Panel title="3. Location">
          <Choices name="area_type" legend="Area" required options={areaTypes.map((v) => ({ value: v, label: v }))} value={f.area_type} onChange={set('area_type')} error={err.area_type} />
          <div className="grid-3">
            <Input label="Village or town" value={f.village} onChange={set('village')} />
            <Input label="Gram panchayat / ward" value={f.gram_panchayat} onChange={set('gram_panchayat')} />
            <Input label="Taluk / block" required value={f.taluk} onChange={set('taluk')} error={err.taluk} />
          </div>
          <div className="grid-3">
            <Input label="District" required list="school-districts" value={f.district} onChange={set('district')} error={err.district} />
            <Select label="State" required options={meta.states} value={f.state} onChange={set('state')} error={err.state} />
            <Input label="PIN code" inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} error={err.pin} />
          </div>
          <datalist id="school-districts">{meta.districts.map((d) => <option key={d} value={d} />)}</datalist>
          <Input label="Address" value={f.address} onChange={set('address')} />
          <Choices name="area_tags" legend="Does any of this apply to your area?" multiple options={areaTags.map((v) => ({ value: v, label: v }))}
            value={f.area_tags} onChange={set('area_tags')} />

          <div className={cx('geo-box', err.latitude && 'has-error')}>
            <div className="geo-head">
              <div>
                <span className="label">School location (geo-tag)</span>
                <p className="field-help flush">Stand at the school gate with your phone, GPS on, and capture. It helps the field executive find you and confirms photos were taken here.</p>
              </div>
              <button type="button" className="btn btn-ghost" disabled={locating} onClick={capture}>
                <Icon name="locate" />{locating ? 'Finding location…' : f.latitude !== '' && f.latitude != null ? 'Capture again' : 'Capture location'}
              </button>
            </div>
            {f.latitude !== '' && f.latitude != null && (
              <>
                <LocationMap lat={Number(f.latitude)} lng={Number(f.longitude)} accuracy={f.location_accuracy === '' ? null : f.location_accuracy} />
                {f.location_accuracy > 100 && <p className="field-error">Low accuracy (±{f.location_accuracy} m). Capture again outdoors for a better fix.</p>}
              </>
            )}
            <details className="disclose mt">
              <summary>Enter coordinates by hand</summary>
              <div className="grid-2">
                <Input label="Latitude" inputMode="decimal" placeholder="e.g. 16.23104" value={f.latitude ?? ''} onChange={(e) => setF({ ...f, latitude: e.target.value, location_accuracy: '' })} />
                <Input label="Longitude" inputMode="decimal" placeholder="e.g. 74.60052" value={f.longitude ?? ''} onChange={(e) => setF({ ...f, longitude: e.target.value, location_accuracy: '' })} />
              </div>
              {f.latitude !== '' && f.latitude != null && <button type="button" className="linkish small" onClick={() => setF({ ...f, latitude: '', longitude: '', location_accuracy: '' })}>Remove location</button>}
            </details>
            {err.latitude && <div className="field-error">{err.latitude}</div>}
          </div>
        </Panel>

        <Panel title="4. Facilities today" aside="Answer for what works now, not what exists on paper">
          {FAC.filter((q) => q.type !== 'count').map((q) => (
            <Choices key={q.key} name={`f_${q.key}`} legend={q.label} required={q.required}
              options={(q.type === 'yesno' ? ['Yes', 'No'] : q.options).map((v) => ({ value: v, label: v }))}
              value={f.facilities[q.key]} onChange={setFac(q.key)} error={err[`f_${q.key}`]} />
          ))}
          <div className="grid-2 mt">
            {FAC.filter((q) => q.type === 'count').map((q) => (
              <Input key={q.key} label={q.label} required={q.required} type="number" min="0" value={f.facilities[q.key] ?? ''} onChange={setFac(q.key)} error={err[`f_${q.key}`]} />
            ))}
          </div>
        </Panel>

        <Panel title="5. Contact">
          <div className="grid-2">
            <Input label="Headmaster / Principal" required value={f.headmaster} onChange={set('headmaster')} error={err.headmaster} />
            <Input label="Headmaster's mobile" type="tel" inputMode="numeric" maxLength={14} value={f.headmaster_phone} onChange={set('headmaster_phone')} error={err.headmaster_phone} />
          </div>
          <div className="grid-2">
            <Select label="Your role" options={meta.infra.contactRoles} value={f.contact_role} onChange={set('contact_role')} />
            <Input label="School email" type="email" value={f.email} onChange={set('email')} error={err.email} />
          </div>
        </Panel>

        <div className="form-actions sticky-actions">
          {Object.values(err).some(Boolean) && <span className="text-warn small">Some answers need fixing. They are marked in red.</span>}
          {!first && <Link className="btn btn-ghost" to="/school">Cancel</Link>}
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : first ? 'Save and add photos' : 'Save profile'}</button>
        </div>
      </form>

      {data.school && <PhotoManager photos={data.photos} status={data.status} onChange={reload} />}
    </>
  );
}

/** Upload school photos by kind. Each upload asks the phone for its position, so photos taken at the school carry a geo-tag. */
function PhotoManager({ photos, status, onChange }) {
  const { meta, notify } = useApp();
  const [kind, setKind] = useState(photos.some((p) => p.kind === 'front') ? 'classroom' : 'front');
  const [progress, setProgress] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const kinds = meta.infra.photoKinds;

  const upload = async (files) => {
    const list = [...files];
    if (!list.length) return;
    setProgress(0);
    const geo = await getPosition({ timeout: 10000 });
    const headers = geo ? { 'X-Geo-Lat': String(geo.lat), 'X-Geo-Lng': String(geo.lng), 'X-Geo-Accuracy': String(geo.accuracy) } : {};
    let ok = 0;
    for (const [n, file] of list.entries()) {
      try {
        await uploadTo(`/api/school/photos/${kind}`, file, (p) => setProgress((n + p) / list.length), headers);
        ok += 1;
      } catch (e) { notify(e.message, 'error'); }
    }
    setProgress(null);
    if (ok) notify(geo ? `${ok} photo${ok > 1 ? 's' : ''} added, geo-tagged.` : `${ok} photo${ok > 1 ? 's' : ''} added without location. Allow location access to geo-tag photos.`, geo ? 'success' : 'warn');
    onChange();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete this ${kinds[p.kind].toLowerCase()} photo?`)) return;
    setDeleting(p.id);
    try { await api.del(`/api/school/photos/${p.id}`); notify('Photo deleted.'); onChange(); } catch (e) { notify(e.message, 'error'); } finally { setDeleting(null); }
  };

  const busy = progress !== null;
  const have = new Set(photos.map((p) => p.kind));
  return (
    <section className="narrow mt" id="photos">
      <Panel title="6. School photos" aside={`${photos.length} of 30`}>
        <p className="small muted">Take photos at the school with location turned on: they are geo-tagged automatically. A photo of the front of the school is required; classrooms and toilets help the committee understand your needs.</p>
        <div className="kind-picker" role="radiogroup" aria-label="What is this photo of?">
          {Object.entries(kinds).map(([k, label]) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} className={cx(kind === k && 'on')} onClick={() => setKind(k)}>
              {label}{have.has(k) && <Icon name="check" />}{k === 'front' && !have.has('front') && <span className="req-dot" aria-label="required">*</span>}
            </button>
          ))}
        </div>
        <label className={cx('slot', busy && 'busy')}>
          <input type="file" accept="image/*" multiple capture="environment" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          <Icon name="camera" />
          <span className="slot-name">Add {kinds[kind].toLowerCase()} photos</span>
          <span className="slot-state">{busy ? `${Math.round(progress * 100)}%` : 'Take or choose'}</span>
          {busy && <span className="slot-bar" style={{ width: `${progress * 100}%` }} />}
        </label>
        <div className="mt"><SchoolPhotos photos={photos} onDelete={remove} busyId={deleting} /></div>
      </Panel>
      {status.ready && (
        <div className="form-actions">
          <span className="text-ok small">Your profile is complete.</span>
          <Link className="btn" to="/school/requests/new">Make a request</Link>
        </div>
      )}
    </section>
  );
}
