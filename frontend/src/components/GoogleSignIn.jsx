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
      const timer = setTimeout(() => {
        gisPromise = null;
        reject(new Error('gis-load-timeout'));
      }, 10000);
      const s = document.createElement('script');
      s.src = `https://accounts.google.com/gsi/client?hl=${hl}`;
      s.async = true;
      s.defer = true;
      s.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      s.onerror = () => {
        clearTimeout(timer);
        gisPromise = null;
        reject(new Error('gis-load-failed'));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/**
 * GoogleSignIn — bouton « Continuer avec Google » (GIS) en mode redirect :
 * pas de popup (le clic navigue vers Google puis revient sur /login#...).
 * Le client_id est lu à l'exécution depuis /api/auth/config (pas de build requis).
 * Masqué si Google n'est pas configuré côté backend.
 */
export default function GoogleSignIn() {
  const { loginWithGoogle, applySession } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const btnRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(false);

  // Retour de Google (redirect) : /login#google=1&token=...&refresh=...
  // ou /login#google=error&code=...
  useEffect(() => {
    const hash = window.location.hash || '';
    if (!hash.includes('google=')) return;
    const params = new URLSearchParams(hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (params.get('google') === 'error') {
      setError(t('auth.googleFailed', 'فشل الدخول عبر Google، حاول مجدداً'));
      return;
    }
    const token = params.get('token');
    if (!token) {
      setError(t('auth.googleFailed', 'فشل الدخول عبر Google، حاول مجدداً'));
      return;
    }
    setReturning(true);
    applySession(token, params.get('refresh') || '')
      .then((me) => navigate(getHomePath(me)))
      .catch(() => {
        setReturning(false);
        setError(t('auth.googleFailed', 'فشل الدخول عبر Google، حاول مجدداً'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          // redirect : plus de popup — Google navigue puis POST vers le backend
          ux_mode: 'redirect',
          login_uri: `${window.location.origin}/api/auth/google-redirect`,
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

  if (returning) {
    return (
      <div className="google-signin">
        <div className="auth-divider" aria-hidden="true"><span>{t('auth.or')}</span></div>
        <div className="loading-wrap"><span className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="google-signin">
      <div className="auth-divider" aria-hidden="true"><span>{t('auth.or')}</span></div>
      <div ref={btnRef} className="google-btn-wrap" />
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
