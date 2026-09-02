import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Button, Card } from '../components/ui/index.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message || 'تعذّر إرسال الطلب. حاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Card title="استعادة كلمة المرور" icon="lock_reset">
        {sent ? (
          <div className="reset-done">
            <p>إن كان البريد مسجلاً لدينا فستصلك رسالة تحتوي رابطاً لإعادة تعيين كلمة المرور (صالح لمدة ساعة).</p>
            <p className="muted">تحقق أيضاً من مجلد الرسائل غير المرغوبة.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>
              البريد الإلكتروني
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.tn"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'جارٍ الإرسال...' : 'أرسل رابط الاستعادة'}
            </Button>
          </form>
        )}
        <p style={{ marginTop: '1rem' }}>
          <Link to="/login">العودة لتسجيل الدخول</Link>
        </p>
      </Card>
    </div>
  );
}