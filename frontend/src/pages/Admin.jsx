import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { canManage, helpStatusLabel } from '../roles.js';
import AdminAiKey from './AdminAiKey.jsx';

const STATUS = ['PENDING', 'PROCESSING', 'VALIDATED', 'REJECTED'];

export default function Admin() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState('help');
  const [helpRequests, setHelpRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (tab !== 'help') return;
    api
      .get('/admin/help-requests')
      .then(setHelpRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  if (user && !canManage(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const updateHelp = async (id, status) => {
    try {
      await api.put(`/admin/help-requests/${id}`, { status });
      setHelpRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      setMsg(t('admin.updatedMsg'));
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <h2>{t('admin.title')}</h2>
      {msg && <div className="form-success">{msg}</div>}

      <div className="subject-tabs" style={{ marginBottom: '1.2rem' }}>
        <button
          type="button"
          className={tab === 'help' ? 'subject-tab active' : 'subject-tab'}
          onClick={() => setTab('help')}
        >
          {t('admin.tabHelp')}
        </button>
        <button
          type="button"
          className={tab === 'ai' ? 'subject-tab active' : 'subject-tab'}
          onClick={() => setTab('ai')}
        >
          {t('admin.tabAi')}
        </button>
      </div>

      {tab === 'ai' ? (
        <AdminAiKey />
      ) : loading ? (
        <div className="loading-wrap">
          <span className="spinner" />
        </div>
      ) : (
        <div>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
            {t('admin.redirectNote')}
          </p>
          <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem' }}>{t('admin.helpRequestsTitle')}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.name')}</th>
                  <th>{t('admin.requestType')}</th>
                  <th>{t('admin.delegation')}</th>
                  <th>{t('admin.phone')}</th>
                  <th>{t('admin.status')}</th>
                  <th>{t('admin.action')}</th>
                </tr>
              </thead>
              <tbody>
                {helpRequests.map((h) => (
                  <tr key={h.id}>
                    <td>{h.firstName} {h.lastName}</td>
                    <td>{h.requestType}</td>
                    <td>{h.delegation || '-'}</td>
                    <td>{h.phone || '-'}</td>
                    <td>
                      <span className={`badge badge-${h.status.toLowerCase()}`}>
                        {helpStatusLabel(t, h.status)}
                      </span>
                    </td>
                    <td>
                      <select
                        value={h.status}
                        onChange={(e) => updateHelp(h.id, e.target.value)}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1.5px solid var(--border)' }}
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>{helpStatusLabel(t, s)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
