import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UserContext = createContext();

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include', // always send/receive HttpOnly cookie
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'An unexpected error occurred. Please try again.');
  return data;
}

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null);   // null = unauthenticated
  const [loading, setLoading] = useState(true);   // true during initial session restore
  const [error, setError]     = useState(null);

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((u) => setUser(u))
      .catch(() => setUser(null))   // 401 = not logged in, silently ignore
      .finally(() => setLoading(false));
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────
  const register = useCallback(async ({ name, phone, password }) => {
    setError(null);
    try {
      const u = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: { name, phone, password },
      });
      setUser(u);
      return u;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const login = useCallback(async ({ phone, password }) => {
    setError(null);
    try {
      const u = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { phone, password },
      });
      setUser(u);
      return u;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    window.dispatchEvent(new Event('agrio:logout'));
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const u = await apiFetch('/api/auth/me');
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const isAuthenticated = useCallback(() => Boolean(user), [user]);

  const value = {
    user,
    setUser,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}