// A tiny client-side router (history API): no extra dependency needed.
import { createContext, useContext, useEffect, useState } from 'react';

const RouteCtx = createContext({ path: '/', query: new URLSearchParams() });

export function navigate(to, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new Event('tk:navigate'));
}

export function RouterProvider({ children }) {
  const read = () => ({ path: location.pathname, query: new URLSearchParams(location.search), hash: location.hash });
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const update = () => {
      setLoc(read());
      if (!location.hash) window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', update);
    window.addEventListener('tk:navigate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('tk:navigate', update);
    };
  }, []);
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [loc]);
  return <RouteCtx.Provider value={loc}>{children}</RouteCtx.Provider>;
}

export const useLocation = () => useContext(RouteCtx);

/** Match `path` against patterns like '/staff/applications/:id'. Returns params or null. */
export function matchPath(pattern, path) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => (keys.push(k), '/([^/]+)')) + '/?$');
  const m = re.exec(path);
  if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}

export function Link({ to, children, onClick, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
