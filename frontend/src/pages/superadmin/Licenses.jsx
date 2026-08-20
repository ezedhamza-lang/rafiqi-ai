import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Licenses() {
  const { lang, t } = useI18n();
  const [licenses, setLicenses] = useState([]);
  const [form, setForm] = useState({ entityName: '', expiresAt: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/superadmin/licenses')
      .then(setLicenses)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/superadmin/licenses', form);
      setForm({ entityName: '', expiresAt: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const revoke = async (id) => {
    await api.post(`/superadmin/licenses/${id}/revoke`);
    load();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('licenses.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}

      <form className="card-form" onSubmit={create}>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('licenses.entityName')}</label>
            <input required value={form.entityName} onChange={(e) => setForm({ ...form, entityName: e.target.value })} placeholder={t('licenses.entityPlaceholder')} />
          </div>
          <div className="form-group">
            <label>{t('licenses.expiresAt')}</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit">{t('licenses.create')}</button>
        </div>
      </form>

      {licenses.length === 0 ? (
        <div className="empty">{t('licenses.noLicenses')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('licenses.keyColumn')}</th>
                <th>{t('licenses.entityColumn')}</th>
                <th>{t('licenses.statusColumn')}</th>
                <th>{t('licenses.createdColumn')}</th>
                <th>{t('licenses.expiresColumn')}</th>
                <th>{t('licenses.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id}>
                  <td><code>{l.key}</code></td>
                  <td>{l.entityName}</td>
                  <td>
                    <span className={`badge ${l.status === 'ACTIVE' ? 'good' : 'bad'}`}>{l.status}</span>
                  </td>
                  <td>{new Date(l.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB') : '—'}</td>
                  <td>
                    {l.status === 'ACTIVE' && (
                      <button className="btn btn-danger btn-sm" onClick={() => revoke(l.id)}>{t('licenses.revoke')}</button>
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
