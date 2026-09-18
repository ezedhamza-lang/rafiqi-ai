import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getHomePath } from '../roles.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => {
        gisPromise = null;
        reject(new Error('gis-load-failed'));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/**
 * GoogleSignIn — bouton « Continuer avec Google » (GIS).
 * Masqué si VITE_GOOGLE_CLIENT_ID est absent (fonction désactivée).
 */
export default function GoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const btnRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !btnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (resp) => {
            try {
              const user = await loginWithGoogle(resp.credential);
              navigate(getHomePath(user));
            } catch (err) {
              setError(err.message);
            }
          }
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          locale: lang === 'ar' ? 'ar' : 'en',
          width: 300
        });
      })
      .catch(() => {
        if (!cancelled) setError(t('auth.googleUnavailable', 'خدمة Google غير متاحة حالياً'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="google-signin">
      <div className="auth-divider" aria-hidden="true"><span>{t('auth.or')}</span></div>
      <div ref={btnRef} className="google-btn-wrap" />
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
