const TOKEN_KEY = 'school_token';
const REFRESH_KEY = 'school_refresh_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token) {
  localStorage.setItem(REFRESH_KEY, token);
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('school_user') || 'null');
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem('school_user', JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem('school_user');
}

export function clearSession() {
  clearToken();
  clearRefreshToken();
  clearStoredUser();
}

// تجديد صامت: طلب واحد في نفس الوقت (single-flight) + إعادة محاولة
// الطلب الأصلي بعد الحصول على رمز جديد.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) return null;
        setToken(data.token);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        return data.token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function request(path, options = {}, retried = false) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !retried && path !== '/auth/login' && path !== '/auth/register' && path !== '/auth/refresh') {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request(path, options, true);
    }
    // فشل التجديد — إنهاء الجلسة نهائياً وإبطال رمز التجديد محلياً
    if (navigator.sendBeacon) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        navigator.sendBeacon('/api/auth/logout', new Blob([JSON.stringify({ refreshToken })], { type: 'application/json' }));
      }
    }
    clearSession();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error(data.error || 'انتهت الجلسة');
  }

  if (res.status === 401 && (path === '/auth/login' || path === '/auth/register')) {
    throw new Error(data.error || 'بيانات الدخول غير صحيحة');
  }

  if (!res.ok) {
    throw new Error(data.error || 'حدث خطأ ما');
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  download: async (path, filename) => {
    const token = getToken();
    const res = await fetch(`/api${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'فشل تحميل الملف');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};