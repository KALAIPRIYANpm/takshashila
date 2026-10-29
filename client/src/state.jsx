// App-wide state: the signed-in user, form reference data, and flash messages.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './lib.js';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [auth, setAuth] = useState({ loading: true, user: null, hasApplication: false });
  const [flash, setFlash] = useState(null);

  const refreshAuth = useCallback(async () => {
    const r = await api.get('/api/auth/me').catch(() => ({ user: null }));
    setAuth({ loading: false, user: r.user, hasApplication: !!r.hasApplication });
    return r;
  }, []);

  useEffect(() => {
    api.get('/api/meta').then(setMeta).catch(() => setMeta(false));
    refreshAuth();
    const signedOut = () => {
      setAuth({ loading: false, user: null, hasApplication: false });
      setFlash({ message: 'Your session has ended. Sign in again to continue.', kind: 'warn', at: Date.now() });
    };
    window.addEventListener('tk:signed-out', signedOut);
    return () => window.removeEventListener('tk:signed-out', signedOut);
  }, [refreshAuth]);

  const notify = useCallback((message, kind = 'success') => {
    setFlash({ message, kind, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <AppCtx.Provider value={{ meta, auth, setAuth, refreshAuth, flash, notify, clearFlash: () => setFlash(null) }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);

/** Load data from the API with loading / error states and a reload function. */
export function useApi(url, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = useCallback(() => {
    if (!url) return;
    setState((s) => ({ ...s, loading: true }));
    api.get(url).then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error }));
  }, [url]);
  useEffect(load, [load, ...deps]);
  return { ...state, reload: load };
}
