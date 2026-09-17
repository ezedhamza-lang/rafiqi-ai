import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../api/client.js';
import { Button, Input } from '../components/ui/index.js';

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
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        schoolId: form.schoolId ? Number(form.schoolId) : undefined
      });
      navigate('/dashboard');
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
          <img src="/logo-rafiqi-square.png" alt="رفيقي" style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid #ff6a00', padding: 4, background: '#fff', boxShadow: '0 4px 20px rgba(255,106,0,0.15)' }} />
        </div>
        <h1 style={{ color: '#ff6a00' }}>{t('register.title')}</h1>
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
          />
          <Input
            label={t('register.phoneLabel')}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="5X XXX XXX"
            icon="phone"
            autoComplete="tel"
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
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 10, border: '1px solid #d1d5db', fontSize: '1rem' }}
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
        <div className="auth-switch">
          {t('register.haveAccount')} <Link to="/login">{t('register.login')}</Link>
        </div>
      </div>
    </div>
  );
}
