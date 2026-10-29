import { useEffect, useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { ErrorNote, Input, Select, Spinner, useTitle } from '../../components/ui.jsx';
import { api } from '../../lib.js';
import { Link, navigate } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

const FIELDS = ['name', 'udise_code', 'school_type', 'level', 'medium', 'headmaster', 'contact_role', 'email', 'address', 'village', 'district', 'state', 'pin', 'students', 'girls', 'teachers', 'classrooms'];

export default function SchoolProfile() {
  useTitle('School profile');
  const { meta, notify } = useApp();
  const { data, loading, error, reload } = useApi('/api/school/me');
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !f) setF(Object.fromEntries(FIELDS.map((k) => [k, data.school?.[k] ?? (k === 'state' ? 'Karnataka' : '')])));
  }, [data, f]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!f) return <Spinner />;
  const first = !data.school;
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr((x) => ({ ...x, [k]: undefined })); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr({});
    try {
      await api.put('/api/school/me', f);
      notify(first ? 'School profile saved. Now tell us what your school needs.' : 'School profile updated.');
      navigate(first ? '/school/requests/new' : '/school');
    } catch (x) {
      setErr(x.fields || {}); notify(x.message, 'error');
      setTimeout(() => document.querySelector('.has-error input, .has-error select')?.focus(), 30);
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title={first ? 'Register your school' : 'School profile'} crumb={first ? null : ['/school', 'Dashboard']}
        sub={first ? 'A one-time step. These details help us verify your school and prioritise requests fairly.' : 'Keep enrolment and teacher numbers current: they affect how requests are prioritised.'} />
      <form onSubmit={save} noValidate className="narrow">
        <Panel title="School">
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
        </Panel>
        <Panel title="Students and staff">
          <div className="grid-2">
            <Input label="Students enrolled" required type="number" min="1" value={f.students} onChange={set('students')} error={err.students} />
            <Input label="Girls enrolled" type="number" min="0" value={f.girls} onChange={set('girls')} error={err.girls} />
          </div>
          <div className="grid-2">
            <Input label="Teachers" required type="number" min="1" value={f.teachers} onChange={set('teachers')} error={err.teachers} />
            <Input label="Classrooms" type="number" min="0" value={f.classrooms} onChange={set('classrooms')} error={err.classrooms} />
          </div>
        </Panel>
        <Panel title="Contact and location">
          <div className="grid-2">
            <Input label="Headmaster / Principal" required value={f.headmaster} onChange={set('headmaster')} error={err.headmaster} />
            <Select label="Your role" options={meta.infra.contactRoles} value={f.contact_role} onChange={set('contact_role')} />
          </div>
          <Input label="School email" type="email" value={f.email} onChange={set('email')} error={err.email} />
          <Input label="Address" value={f.address} onChange={set('address')} />
          <div className="grid-3">
            <Input label="Village or town" value={f.village} onChange={set('village')} />
            <Input label="District" required list="school-districts" value={f.district} onChange={set('district')} error={err.district} />
            <Input label="PIN code" inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} error={err.pin} />
          </div>
          <datalist id="school-districts">{meta.districts.map((d) => <option key={d} value={d} />)}</datalist>
          <Select label="State" required options={meta.states} value={f.state} onChange={set('state')} error={err.state} />
        </Panel>
        <div className="form-actions">
          {!first && <Link className="btn btn-ghost" to="/school">Cancel</Link>}
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : first ? 'Save and continue' : 'Save changes'}</button>
        </div>
      </form>
    </>
  );
}
