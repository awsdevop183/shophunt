import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try { const { user } = await api.get('/api/users/me'); setUser(user); }
    catch { setUser(null); setToken(''); }
    finally { setReady(true); }
  }
  useEffect(() => { refresh(); }, []);

  async function login(email, password) {
    const { token, user } = await api.post('/api/auth/login', { email, password });
    setToken(token); setUser(user); return user;
  }
  async function signup(email, password, name) {
    const { token, user } = await api.post('/api/auth/signup', { email, password, name });
    setToken(token); setUser(user); return user;
  }
  function logout() { setToken(''); setUser(null); }

  return (
    <AuthCtx.Provider value={{ user, ready, login, signup, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
