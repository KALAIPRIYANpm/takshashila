import { useEffect } from 'react';
import { PageHead } from '../../components/layout.jsx';
import { PhotoManager, SchoolForm, toForm } from '../../components/SchoolForm.jsx';
import { ProfileMeter, VerificationNote } from '../../components/school.jsx';
import { ErrorNote, Spinner, useTitle } from '../../components/ui.jsx';
import { api } from '../../lib.js';
import { Link, navigate, useLocation } from '../../router.jsx';
import { useApi, useApp } from '../../state.jsx';

export default function SchoolProfile() {
  useTitle('School profile');
  const { notify } = useApp();
  const { hash } = useLocation();
  const { data, loading, error, reload } = useApi('/api/school/me');
  useEffect(() => { if (data && hash === '#photos') setTimeout(() => document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth' }), 120); }, [data, hash]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const first = !data.school;

  const save = async (f) => {
    await api.put('/api/school/me', f);
    if (first) {
      notify('School profile saved. Now add photos of your school.');
      reload();
      navigate('/school/profile#photos', { replace: true });
    } else {
      notify('School profile saved.');
      reload();
    }
  };

  return (
    <>
      <PageHead title={first ? 'Register your school' : 'School profile'} crumb={first ? null : ['/school', 'Dashboard']}
        sub={first ? 'A one-time step. These details help us verify your school and prioritise requests fairly. It takes about 10 minutes.' : 'Keep these details current. Enrolment, staff and facilities affect how requests are prioritised.'} />
      {!first && <VerificationNote school={data.school} />}
      {!first && <ProfileMeter status={data.status} />}
      <SchoolForm key={first ? 'new' : 'edit'} initial={toForm(data.school)} onSave={save} cancelTo={first ? null : '/school'}
        submitLabel={first ? 'Save and add photos' : 'Save profile'} />
      {data.school && (
        <section className="narrow mt">
          <PhotoManager title="6. School photos" photos={data.photos} onChange={reload}
            uploadUrl={(kind) => `/api/school/photos/${kind}`} deleteUrl={(id) => `/api/school/photos/${id}`} />
          {data.status.ready && data.school.verification !== 'rejected' && (
            <div className="form-actions">
              <span className="text-ok small">Your profile is complete.</span>
              <Link className="btn" to="/school/requests/new">Make a request</Link>
            </div>
          )}
        </section>
      )}
    </>
  );
}
