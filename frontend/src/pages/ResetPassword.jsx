import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card } from '../components/ui/index.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('كلمة السر يجب أن تحتوي على 6 أحرف على الأقل.'); return; }
    if (password !== confirm) { setError('كلمتا السر غير متطابقتين.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'تعذّر تغيير كلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <Card title="رابط غير صالح" icon="error">
          <p>رابط الاستعادة ناقص أو غير صالح. اطلب رابطاً جديداً.</p>
          <p><Link to="/forgot-password">طلب رابط استعادة</Link></p>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Card title="كلمة مرور جديدة" icon="lock">
        {done ? (
          <p>تم تغيير كلمة المرور بنجاح. جارٍ نقلك لتسجيل الدخول...</p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>
              كلمة السر الجديدة
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>
              تأكيد كلمة السر
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
            </Button>
          </form>
        )}
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">تسجيل الدخول</Link>
        </p>
      </Card>
    </div>
  );
}