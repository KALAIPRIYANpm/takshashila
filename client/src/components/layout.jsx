import { api, cx, homeFor } from '../lib.js';
import { Link, navigate, useLocation } from '../router.jsx';
import { useApp } from '../state.jsx';
import { Avatar, Brand, Flash, Icon } from './ui.jsx';

/** Sign out and return to the right sign-in page. Used by every layout, so each signed-in screen has a way out. */
export function useSignOut() {
  const { auth, setAuth, notify } = useApp();
  return async () => {
    const role = auth.user?.role;
    await api.post('/api/auth/logout').catch(() => {});
    setAuth({ loading: false, user: null, hasApplication: false });
    navigate({ student: '/', school: '/school/sign-in' }[role] || '/staff/sign-in');
    notify('You have been signed out.');
  };
}

export function PublicLayout({ children, bare = false }) {
  const { auth } = useApp();
  const { path } = useLocation();
  const signOut = useSignOut();
  const home = auth.user ? homeFor(auth) : null;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-head">
        <div className="wrap head-row">
          <Brand />
          <nav className="site-nav" aria-label="Main">
            {!bare && <Link className="hide-sm" to="/#offer">Support</Link>}
            {!bare && <Link className="hide-sm" to="/#journey">How it works</Link>}
            {!bare && <Link className="hide-sm" to="/#schools">For schools</Link>}
            {!bare && <Link className="hide-sm" to="/#faq">FAQ</Link>}
            {home ? (
              <>
                {path !== home && <Link className="btn btn-sm" to={home}>Go to dashboard</Link>}
                <span className="head-user hide-sm"><Avatar name={auth.user.name || 'Applicant'} size="sm" />{auth.user.name || `+91 ${auth.user.phone}`}</span>
                <button className="btn btn-sm btn-ghost" onClick={signOut}><Icon name="logout" />Sign out</button>
              </>
            ) : (
              <>
                <Link className="hide-sm" to="/staff/sign-in">Staff login</Link>
                <Link className="nav-signin" to="/sign-in">Sign in</Link>
                <Link className="btn btn-sm" to="/sign-in?next=/apply">Apply now</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <Flash />
      <main id="main">{children}</main>
      {!bare && (
        <footer className="site-foot">
          <div className="wrap foot-grid">
            <div className="foot-brand">
              <Brand light />
              <p>Scholarships, devices, training and mentoring for students from low-income families, from admission to first job.</p>
            </div>
            <div>
              <h4>Programme</h4>
              <ul>
                <li><Link to="/#offer">Support we offer</Link></li>
                <li><Link to="/#journey">How selection works</Link></li>
                <li><Link to="/#documents">Documents needed</Link></li>
                <li><Link to="/#faq">Questions</Link></li>
              </ul>
            </div>
            <div>
              <h4>Students</h4>
              <ul>
                <li><Link to="/sign-in?next=/apply">Start an application</Link></li>
                <li><Link to="/sign-in">Track your application</Link></li>
              </ul>
            </div>
            <div>
              <h4>Schools and staff</h4>
              <ul>
                <li><Link to="/#schools">School infrastructure</Link></li>
                <li><Link to="/school/sign-in">School portal</Link></li>
                <li><Link to="/staff/sign-in">Staff portal</Link></li>
              </ul>
            </div>
            <div>
              <h4>Helpline</h4>
              <ul>
                <li><a href="tel:18000000000">1800-000-0000</a></li>
                <li>Mon–Sat, 9am–6pm</li>
                <li><a href="mailto:help@takshashila.org">help@takshashila.org</a></li>
              </ul>
            </div>
          </div>
          <div className="wrap foot-base">
            <span>© {new Date().getFullYear()} Takshashila Education Trust. All rights reserved.</span>
            <span>Applying is free. We never ask for money; report anyone who does. · <Link to="/staff/sign-in">Staff login</Link></span>
          </div>
        </footer>
      )}
    </>
  );
}

export function AppShell({ children }) {
  const { auth, meta } = useApp();
  const { path, hash } = useLocation();
  const signOut = useSignOut();
  const u = auth.user;
  const staffNav = [
    ['Workspace', [
      ['/staff', 'Overview', 'home', (p) => p === '/staff'],
      ['/staff/applications', 'Applications', 'list', (p) => p.startsWith('/staff/applications') && p !== '/staff/applications/new'],
      ['/staff/applications/new', 'Register a student', 'plus', (p) => p === '/staff/applications/new'],
      ['/staff/infrastructure', 'School infrastructure', 'school', (p) => p.startsWith('/staff/infrastructure')],
      ['/staff/schools', 'Schools', 'pin', (p) => p.startsWith('/staff/schools')],
    ]],
    ['Programme', [
      ['/staff/payments', 'Payments', 'rupee', (p) => p.startsWith('/staff/payments')],
      ['/staff/training', 'Training', 'class', (p) => p.startsWith('/staff/training')],
      ['/staff/opportunities', 'Opportunities', 'brief', (p) => p.startsWith('/staff/opportunities')],
    ]],
    ['Settings', [
      ['/staff/scoring', 'Scoring rules', 'scale', (p) => p.startsWith('/staff/scoring')],
      ...(u?.role === 'admin' ? [['/staff/team', 'Team', 'user', (p) => p.startsWith('/staff/team')]] : []),
    ]],
  ];
  const studentNav = [
    ['My account', [
      ['/me', 'My application', 'home', () => path === '/me' && !hash],
      ['/me#renewal', 'Semester renewal', 'doc', () => hash === '#renewal'],
      ['/me#opportunities', 'Internships and jobs', 'brief', () => hash === '#opportunities'],
      ['/me#schemes', 'Govt scholarships', 'scale', () => hash === '#schemes'],
    ]],
  ];
  const schoolNav = [
    ['My school', [
      ['/school', 'Dashboard', 'home', (p) => p === '/school' || (p.startsWith('/school/requests/') && p !== '/school/requests/new')],
      ['/school/requests/new', 'New request', 'plus', (p) => p === '/school/requests/new'],
      ['/school/profile', 'School profile', 'school', (p) => p === '/school/profile'],
    ]],
  ];
  const nav = { student: studentNav, school: schoolNav }[u?.role] || staffNav;
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="rail">
        <div className="rail-brand"><Brand to={u ? homeFor(auth) : '/'} /></div>
        <nav aria-label="App">
          {nav.map(([group, items]) => (
            <div className="rail-group" key={group}>
              <span className="rail-label">{group}</span>
              {items.map(([to, label, icon, active]) => (
                <Link key={to} to={to} aria-current={active(path) ? 'page' : undefined}><Icon name={icon} />{label}</Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="rail-me">
          <Avatar name={u?.name || 'Student'} size="sm" />
          <div className="rail-me-text">
            <b>{u?.name || 'Student'}</b>
            <span>{meta?.roles?.[u?.role]}{u?.district && ['field', 'manager', 'admin'].includes(u.role) ? ` · ${u.district}` : ''}</span>
          </div>
          <button className="btn btn-sm btn-ghost signout" onClick={signOut} title="Sign out"><Icon name="logout" /><span>Sign out</span></button>
        </div>
      </aside>
      <main className="main" id="main">
        <Flash />
        {children}
      </main>
    </div>
  );
}

export function PageHead({ title, sub, children, crumb }) {
  return (
    <div className="page-head">
      <div>
        {crumb && <Link className="crumb" to={crumb[0]}>← {crumb[1]}</Link>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </div>
  );
}

export function Panel({ title, aside, children, className, id, tone }) {
  return (
    <section className={cx('panel', tone && `panel-${tone}`, className)} id={id}>
      {(title || aside) && <div className="panel-head">{title && <h3>{title}</h3>}{aside && <div className="panel-aside">{aside}</div>}</div>}
      {children}
    </section>
  );
}
