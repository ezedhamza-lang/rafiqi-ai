import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getHomePath } from '../roles.js';
import { api } from '../api/client.js';
import { Button, Input } from '../components/ui/index.js';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    schoolId: ''
  });
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/public/schools').then((d) => setSchools(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError(t('register.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const user = await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        schoolId: form.schoolId ? Number(form.schoolId) : undefined
      });
      navigate(getHomePath(user));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card auth-card--wide">
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <img src="/logo-rafiqi-square.png" alt="رفيقي" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid var(--primary)', padding: 4, background: '#fff', boxShadow: '0 4px 20px rgba(255,106,0,0.15)' }} />
        </div>
        <h1 style={{ color: 'var(--primary)' }}>{t('register.title')}</h1>
        <p className="sub">{t('register.subtitle')}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row">
            <Input
              label={t('register.firstName')}
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              autoComplete="given-name"
            />
            <Input
              label={t('register.lastName')}
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              autoComplete="family-name"
            />
          </div>
          <Input
            label={t('register.emailLabel')}
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
            label={t('register.phoneLabel')}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="5X XXX XXX"
            icon="phone"
            autoComplete="tel"
            dir="ltr"
          />
          <div className="form-row">
            <Input
              label={t('register.passwordLabel')}
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={t('register.passwordPlaceholder')}
              icon="lock"
              autoComplete="new-password"
            />
            <Input
              label={t('register.confirmLabel')}
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              icon="lock"
              autoComplete="new-password"
            />
          </div>
          {schools.length > 1 && (
            <div className="form-group" style={{ marginBottom: '0.8rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>{t('register.schoolLabel', 'المدرسة')}</label>
              <select
                required
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                className="auth-select"
              >
                <option value="" disabled>{t('register.schoolPlaceholder', 'اختر مدرستك')}</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" disabled={loading} block size="lg">
            {loading ? t('register.creating') : t('register.submit')}
          </Button>
        </form>
        <GoogleSignIn />
        <div className="auth-switch">
          {t('register.haveAccount')} <Link to="/login">{t('register.login')}</Link>
        </div>
      </div>
    </div>
  );
}
