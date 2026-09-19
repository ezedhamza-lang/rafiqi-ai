import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getHomePath } from '../roles.js';
import { Button, Input } from '../components/ui/index.js';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.mustChangePassword) {
        navigate('/account', { replace: true });
        return;
      }
      navigate(getHomePath(user));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <img src="/logo-rafiqi-square.png" alt="Ø±ÙÙŠÙ‚ÙŠ" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid var(--primary)', padding: 4, background: '#fff', boxShadow: '0 4px 20px rgba(21, 94, 239, 0.15)' }} />
        </div>
        <h1 style={{ color: 'var(--primary)' }}>{t('login.title')}</h1>
        <p className="sub">{t('login.subtitle')}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <Input
            label={t('login.emailLabel')}
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="exemple@mail.tn"
            icon="mail"
            autoComplete="email"
            dir="ltr"
          />
          <Input
            label={t('login.passwordLabel')}
            type={showPw ? 'text' : 'password'}
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            icon="lock"
            autoComplete="current-password"
          />
          <button type="button" className="pw-toggle" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
            <span className="material-icons">{showPw ? 'visibility_off' : 'visibility'}</span>
            {showPw ? t('login.hidePw') : t('login.showPw')}
          </button>
          <Button type="submit" disabled={loading} block size="lg">
            {loading ? t('login.signingIn') : t('login.submit')}
          </Button>
        </form>
        <GoogleSignIn />
        <div className="auth-switch">
          {t('login.noAccount')} <Link to="/register">{t('login.createAccount')}</Link>
        </div>
      </div>
    </div>
  );
}
