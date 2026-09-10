import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getHomePath } from '../roles.js';

export default function AccountSettings() {
  const { user, changePassword } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (form.newPassword !== form.confirm) {
      setError(t('account.passwordsMismatch'));
      return;
    }
    if (form.newPassword.length < 6) {
      setError(t('account.passwordTooShort'));
      return;
    }
    setBusy(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: '2rem', paddingBottom: '2rem' }}>
      <div className="ui-card">
        <div className="ui-card-head">
          <h2 className="ui-card-title">
            <span className="material-icons" style={{ verticalAlign: 'middle' }}>lock_reset</span>
            {' '}{t('account.changePassword')}
          </h2>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>{t('account.changePasswordHint')}</p>

        {user?.mustChangePassword && (
          <div className="form-error" role="alert" style={{ marginBottom: '0.8rem' }}>
            {t('account.mustChangeNotice')}
          </div>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        {done && (
          <div className="form-success" role="status" style={{ marginBottom: '0.8rem' }}>
            {t('account.passwordChanged')}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: '0.7rem' }}>
          <label>
            {t('account.currentPassword')}
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            {t('account.newPassword')}
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>
          <label>
            {t('account.confirmPassword')}
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate(getHomePath(user))}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('common.loading') : t('account.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
