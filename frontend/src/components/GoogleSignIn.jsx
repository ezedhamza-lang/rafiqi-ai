import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../api/client.js';
import { getHomePath } from '../roles.js';

let gisPromise = null;
let gisHl = '';
function loadGis(hl) {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise || gisHl !== hl) {
    gisHl = hl;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://accounts.google.com/gsi/client?hl=${hl}`;
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
 * Le client_id est lu à l'exécution depuis /api/auth/config (pas de build requis).
 * Masqué si Google n'est pas configuré côté backend.
 */
export default function GoogleSignIn() {
  const { loginWithGoogle } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const btnRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/auth/config')
      .then((cfg) => {
        if (!cancelled && cfg?.googleClientId) setClientId(cfg.googleClientId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    const hl = lang === 'ar' ? 'ar' : 'en';
    loadGis(hl)
      .then(() => {
        if (cancelled || !btnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
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
          locale: hl,
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
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div className="google-signin">
      <div className="auth-divider" aria-hidden="true"><span>{t('auth.or')}</span></div>
      <div ref={btnRef} className="google-btn-wrap" />
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
