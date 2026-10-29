import { useState } from 'react';
import { PageHead, Panel } from '../../components/layout.jsx';
import { SchoolForm, toForm } from '../../components/SchoolForm.jsx';
import { ErrorNote, Input, Spinner, useTitle } from '../../components/ui.jsx';
import { api } from '../../lib.js';
import { navigate } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

/** A field executive (or manager) registers a school whose headmaster can't do it on a phone. */
export function RegisterSchool() {
  useTitle('Register a school');
  const { auth, notify } = useApp();
  const [phone, setPhone] = useState('');
  const field = auth.user.role === 'field';

  const save = async (f) => {
    const r = await api.post('/api/staff/schools', { ...f, phone });
    notify(`School registered. Add photos now, then verify it. The headmaster can sign in at the school portal with ${r.phone}.`);
    navigate(`/staff/schools/${r.id}#photos`);
  };

  return (
    <>
      <PageHead crumb={['/staff/schools', 'All schools']} title="Register a school"
        sub="Fill this in with the headmaster, ideally at the school so the location and photos are geo-tagged. The school starts as pending until it is verified." />
      <SchoolForm initial={toForm(null, field ? { district: auth.user.district } : {})} onSave={save} cancelTo="/staff/schools"
        submitLabel="Register school" lockDistrict={field}
        before={(err) => (
          <Panel title="Portal login">
            <Input label="Headmaster's or SDMC member's mobile" required type="tel" inputMode="numeric" maxLength={14} placeholder="98765 43210"
              value={phone} onChange={(e) => setPhone(e.target.value)} error={err.phone}
              help="They sign in to the school portal with this number to track requests and confirm deliveries." />
          </Panel>
        )} />
    </>
  );
}

/** Staff correct a school's profile, e.g. after a site visit. */
export function EditSchool({ id }) {
  const { notify } = useApp();
  const { data, loading, error, reload } = useApi(`/api/staff/schools/${id}`);
  useTitle(data ? `Edit ${data.school.name}` : 'Edit school');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const save = async (f) => {
    await api.put(`/api/staff/schools/${id}`, f);
    notify('School profile updated.');
    navigate(`/staff/schools/${id}`);
  };

  return (
    <>
      <PageHead crumb={[`/staff/schools/${id}`, data.school.name]} title="Edit school profile"
        sub="Correct details after a site visit or a call with the headmaster. Every change is recorded in the audit log." />
      <SchoolForm initial={toForm(data.school)} onSave={save} cancelTo={`/staff/schools/${id}`} submitLabel="Save changes" />
    </>
  );
}
