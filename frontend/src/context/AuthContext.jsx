import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, setRefreshToken, getRefreshToken, getStoredUser, setStoredUser, clearSession } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken() && !getStoredUser()) {
      api
        .get('/auth/me')
        .then((u) => {
          setStoredUser(u);
          setUser(u);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken) => {
    const data = await api.post('/auth/google', { idToken });
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  // جلسة قادمة من عودة redirect (الرموز في الـ fragment) : تخزين + جلب المستخدم
  const applySession = useCallback(async (token, refreshToken) => {
    setToken(token);
    if (refreshToken) setRefreshToken(refreshToken);
    const me = await api.get('/auth/me');
    setStoredUser(me);
    setUser(me);
    return me;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const data = await api.put('/auth/change-password', { currentPassword, newPassword });
    setToken(data.token);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    setStoredUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {    try {
      await api.post('/auth/logout', { refreshToken: getRefreshToken() });
    } catch {
      // إبطال الرمز فشل (شبكة...) — الجلسة المحلية تُمسح دائماً
    }
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, applySession, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
