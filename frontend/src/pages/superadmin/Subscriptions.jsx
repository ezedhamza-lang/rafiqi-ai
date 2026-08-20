import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { ACCOUNT_STATUS_LABEL_KEYS, statusBadgeClass } from '../../roles.js';

export default function Subscriptions() {
  const { lang, t } = useI18n();
  const [subscriptions, setSubscriptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: '', type: 'STUDENT' });

  const load = useCallback(() => {
    api
      .get('/superadmin/subscriptions')
      .then(setSubscriptions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    api
      .get('/superadmin/users')
      .then((u) => setUsers(u.filter((x) => ['STUDENT', 'TEACHER'].includes(x.role))))
      .catch(() => {});
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.userId) return;
    await api.post('/superadmin/subscriptions', { ...form, type: form.type });
    setForm({ userId: '', type: 'STUDENT' });
    load();
  };

  const renew = async (id) => {
    await api.post(`/superadmin/subscriptions/${id}/renew`);
    load();
  };

  const expire = async (id) => {
    await api.post(`/superadmin/subscriptions/${id}/expire`);
    load();
  };

  const suspend = async (id) => {
    await api.post(`/superadmin/subscriptions/${id}/suspend`);
    load();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('superadminSubscriptions.title')}</h3>
        <p className="muted">{t('superadminSubscriptions.subtitle')}</p>
      </div>

      <form className="card-form" onSubmit={create}>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('superadminSubscriptions.user')}</label>
            <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              <option value="">{t('superadminSubscriptions.chooseUser')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role === 'STUDENT' ? t('superadminSubscriptions.student') : t('superadminSubscriptions.teacher')}) — {u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('superadminSubscriptions.type')}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="STUDENT">{t('superadminSubscriptions.studentOption')}</option>
              <option value="TEACHER">{t('superadminSubscriptions.teacherOption')}</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit">{t('superadminSubscriptions.create')}</button>
        </div>
      </form>

      {subscriptions.length === 0 ? (
        <div className="empty">{t('superadminSubscriptions.noSubscriptions')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('superadminSubscriptions.userColumn')}</th>
                <th>{t('superadminSubscriptions.planColumn')}</th>
                <th>{t('superadminSubscriptions.schoolYearColumn')}</th>
                <th>{t('superadminSubscriptions.startColumn')}</th>
                <th>{t('superadminSubscriptions.endColumn')}</th>
                <th>{t('superadminSubscriptions.amountColumn')}</th>
                <th>{t('superadminSubscriptions.statusColumn')}</th>
                <th>{t('superadminSubscriptions.paymentsColumn')}</th>
                <th>{t('superadminSubscriptions.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>{s.user.firstName} {s.user.lastName}</td>
                  <td>{s.plan}</td>
                  <td>{s.schoolYear}</td>
                  <td>{new Date(s.startDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{new Date(s.endDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{s.amount != null ? t('paymentCenter.currency', { n: s.amount }) : '—'}</td>
                  <td>
                    <span className={`badge badge-${statusBadgeClass(s.status)}`}>
                      {ACCOUNT_STATUS_LABEL_KEYS[s.status] ? t(ACCOUNT_STATUS_LABEL_KEYS[s.status]) : s.status}
                    </span>
                  </td>
                  <td>{s.payments.length}</td>
                  <td className="actions">
                    <button className="btn btn-sm" onClick={() => renew(s.id)}>{t('superadminSubscriptions.renew')}</button>
                    {s.status === 'ACTIVE' && (
                      <button className="btn btn-danger btn-sm" onClick={() => suspend(s.id)}>{t('superadminSubscriptions.suspend')}</button>
                    )}
                    {s.status !== 'EXPIRED' && (
                      <button className="btn btn-sm" onClick={() => expire(s.id)}>{t('superadminSubscriptions.expire')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
