import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getHomePath } from '../roles.js';
import { Button, Input } from '../components/ui/index.js';

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
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
          <img src="/logo-rafiqi-square.png" alt="رفيقي" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #4f46e5', padding: 4, background: '#fff', boxShadow: '0 4px 20px rgba(79,70,229,0.15)' }} />
        </div>
        <h1 style={{ color: '#4f46e5' }}>{t('login.title')}</h1>
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
          />
          <Input
            label={t('login.passwordLabel')}
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            icon="lock"
            autoComplete="current-password"
          />
          <Button type="submit" disabled={loading} block size="lg">
            {loading ? t('login.signingIn') : t('login.submit')}
          </Button>
        </form>
        <div className="auth-switch">
          {t('login.noAccount')} <Link to="/register">{t('login.createAccount')}</Link>
        </div>
      </div>
    </div>
  );
}
