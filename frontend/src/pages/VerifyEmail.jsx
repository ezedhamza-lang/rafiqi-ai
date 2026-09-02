import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Card } from '../components/ui/index.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState('loading'); // loading | ok | error
  const [message, setMessage] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (!token) { setState('error'); setMessage('رابط التأكيد ناقص.'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((err) => { setState('error'); setMessage(err.message || 'تعذّر التأكيد.'); });
  }, [token]);

  return (
    <div className="auth-page">
      <Card title="تأكيد البريد الإلكتروني" icon="mark_email_read">
        {state === 'loading' && <p>جارٍ التحقق...</p>}
        {state === 'ok' && (
          <>
            <p>✅ تم تأكيد بريدك الإلكتروني بنجاح.</p>
            <p><Link to="/login">تسجيل الدخول</Link></p>
          </>
        )}
        {state === 'error' && (
          <>
            <p className="form-error">{message}</p>
            <p><Link to="/login">العودة لتسجيل الدخول</Link></p>
          </>
        )}
      </Card>
    </div>
  );
}