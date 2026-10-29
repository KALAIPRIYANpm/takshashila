import { useEffect } from 'react';
import { AppShell, PublicLayout } from './components/layout.jsx';
import { Empty, Spinner } from './components/ui.jsx';
import Apply from './pages/Apply.jsx';
import Home from './pages/Home.jsx';
import SignIn from './pages/SignIn.jsx';
import StudentHome from './pages/StudentHome.jsx';
import ApplicationDetail from './pages/staff/ApplicationDetail.jsx';
import Applications from './pages/staff/Applications.jsx';
import Opportunities from './pages/staff/Opportunities.jsx';
import Overview from './pages/staff/Overview.jsx';
import Payments from './pages/staff/Payments.jsx';
import Scoring from './pages/staff/Scoring.jsx';
import Team from './pages/staff/Team.jsx';
import InfraDetail from './pages/staff/InfraDetail.jsx';
import Infrastructure from './pages/staff/Infrastructure.jsx';
import NewRequest from './pages/school/NewRequest.jsx';
import SchoolHome from './pages/school/SchoolHome.jsx';
import SchoolProfile from './pages/school/SchoolProfile.jsx';
import SchoolRequest from './pages/school/SchoolRequest.jsx';
import Training from './pages/staff/Training.jsx';
import TrainingDetail from './pages/staff/TrainingDetail.jsx';
import { homeFor } from './lib.js';
import { Link, matchPath, navigate, useLocation } from './router.jsx';
import { useApp } from './state.jsx';

const STAFF = ['field', 'manager', 'admin'];

const routes = [
  { path: '/', public: true, el: () => <Home /> },
  { path: '/sign-in', public: true, bare: true, el: () => <SignIn key="student" /> },
  { path: '/staff/sign-in', public: true, bare: true, el: () => <SignIn key="staff" portal="staff" /> },
  { path: '/school/sign-in', public: true, bare: true, el: () => <SignIn key="school" portal="school" /> },
  { path: '/school', roles: ['school'], el: () => <SchoolHome /> },
  { path: '/school/profile', roles: ['school'], el: () => <SchoolProfile /> },
  { path: '/school/requests/new', roles: ['school'], el: () => <NewRequest /> },
  { path: '/school/requests/:id', roles: ['school'], el: (p) => <SchoolRequest id={p.id} /> },
  { path: '/apply', roles: ['student'], publicLayout: true, el: () => <Apply /> },
  { path: '/me', roles: ['student'], el: () => <StudentHome /> },
  { path: '/staff', roles: STAFF, el: () => <Overview /> },
  { path: '/staff/applications', roles: STAFF, el: () => <Applications /> },
  { path: '/staff/applications/new', roles: STAFF, el: () => <Apply onBehalf /> },
  { path: '/staff/applications/:id', roles: STAFF, el: (p) => <ApplicationDetail id={p.id} /> },
  { path: '/staff/payments', roles: STAFF, el: () => <Payments /> },
  { path: '/staff/training', roles: STAFF, el: () => <Training /> },
  { path: '/staff/training/:id', roles: STAFF, el: (p) => <TrainingDetail id={p.id} /> },
  { path: '/staff/opportunities', roles: STAFF, el: () => <Opportunities /> },
  { path: '/staff/scoring', roles: STAFF, el: () => <Scoring /> },
  { path: '/staff/team', roles: ['admin'], el: () => <Team /> },
  { path: '/staff/infrastructure', roles: STAFF, el: () => <Infrastructure /> },
  { path: '/staff/infrastructure/:id', roles: STAFF, el: (p) => <InfraDetail id={p.id} /> },
];

function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export default function App() {
  const { path } = useLocation();
  const { auth, meta } = useApp();
  let params = null;
  const route = routes.find((r) => (params = matchPath(r.path, path)));

  if (!route) {
    return (
      <PublicLayout>
        <div className="wrap page-pad"><Empty title="This page isn't here." action={<Link className="btn" to="/">Go to the home page</Link>}>The link may be old. Start again from the home page.</Empty></div>
      </PublicLayout>
    );
  }
  if (route.public) return <PublicLayout bare={route.bare}>{route.el(params)}</PublicLayout>;
  if (auth.loading || meta === null) return <div className="center-screen"><Spinner /></div>;
  if (meta === false) return <div className="center-screen"><p>Can't reach the server. Check your connection and reload.</p></div>;
  if (!auth.user) {
    const portal = path.startsWith('/staff') ? '/staff/sign-in' : path.startsWith('/school') ? '/school/sign-in' : '/sign-in';
    return <Redirect to={`${portal}?next=${encodeURIComponent(path)}`} />;
  }
  if (!route.roles.includes(auth.user.role)) return <Redirect to={homeFor(auth)} />;
  // A student has exactly one application: the form before it exists, the tracking page after.
  if (auth.user.role === 'student' && (path === '/apply') === auth.hasApplication) return <Redirect to={homeFor(auth)} />;
  if (route.publicLayout) return <PublicLayout bare>{route.el(params)}</PublicLayout>;
  return <AppShell>{route.el(params)}</AppShell>;
}
