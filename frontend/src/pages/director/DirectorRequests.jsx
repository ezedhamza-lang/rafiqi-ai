import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { REQUEST_STATUS_LABEL_KEYS, statusBadgeClass, canApproveRequests } from '../../roles.js';

const FILTERS = [
  { key: 'PENDING_APPROVAL', labelKey: 'directorRequests.filters.PENDING_APPROVAL' },
  { key: 'PENDING_PAYMENT', labelKey: 'directorRequests.filters.PENDING_PAYMENT' },
  { key: 'ALL', labelKey: 'directorRequests.filters.ALL' }
];

export default function DirectorRequests() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [requests, setRequests] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filter, setFilter] = useState('PENDING_APPROVAL');
  const [classSel, setClassSel] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const canApprove = canApproveRequests(user);

  const load = useCallback(() => {
    api
      .get('/director/requests')
      .then(setRequests)
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([api.get('/director/classes'), api.get('/director/requests')])
      .then(([c, r]) => {
        setClasses(c);
        setRequests(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const approve = async (r) => {
    const classId = classSel[r.id];
    if (!classId) {
      setMsg(t('directorRequests.chooseClassFirst', { name: `${r.firstName} ${r.lastName}` }));
      return;
    }
    setMsg('');
    try {
      const res = await api.put(`/director/requests/${r.id}/approve`, { classId: Number(classId) });
      setMsg(
        t('directorRequests.approvedMsg', {
          name: `${r.firstName} ${r.lastName}`,
          email: res.credentials?.email,
          password: res.credentials?.password
        })
      );
      setClassSel((prev) => ({ ...prev, [r.id]: '' }));
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const reject = async (r) => {
    const reason = window.prompt(t('directorRequests.rejectPrompt', { name: `${r.firstName} ${r.lastName}` }), '');
    if (reason === null) return;
    setMsg('');
    try {
      await api.put(`/director/requests/${r.id}/reject`, { reason });
      load();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const filtered = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorRequests.title')}</h3>
        <p className="muted">{t('directorRequests.subtitle')}</p>
      </div>

      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      <div className="teacher-tabs" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`badge ${filter === f.key ? 'badge-approved' : ''}`}
            style={{ cursor: 'pointer', border: 'none', marginInlineEnd: '0.5rem' }}
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">{t('directorRequests.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('directorRequests.parentColumn')}</th>
                <th>{t('directorRequests.studentColumn')}</th>
                <th>{t('directorRequests.birthDateColumn')}</th>
                <th>{t('directorRequests.levelColumn')}</th>
                <th>{t('directorRequests.schoolYearColumn')}</th>
                <th>{t('directorRequests.statusColumn')}</th>
                {canApprove && filter === 'PENDING_APPROVAL' && <th>{t('directorRequests.classColumn')}</th>}
                <th>{t('directorRequests.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.parent.firstName} {r.parent.lastName}</td>
                  <td>{r.firstName} {r.lastName}</td>
                  <td>{new Date(r.birthDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{r.level}</td>
                  <td>{r.schoolYear}</td>
                  <td>
                    <span className={`badge badge-${statusBadgeClass(r.status)}`}>
                      {REQUEST_STATUS_LABEL_KEYS[r.status] ? t(REQUEST_STATUS_LABEL_KEYS[r.status]) : r.status}
                    </span>
                  </td>
                  {canApprove && filter === 'PENDING_APPROVAL' && (
                    <td>
                      <select
                        value={classSel[r.id] || ''}
                        onChange={(e) => setClassSel((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)' }}
                      >
                        <option value="">{t('directorRequests.chooseClassPlaceholder')}</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.teacher?.firstName || t('directorRequests.noTeacher')})</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="actions">
                    {canApprove && r.status === 'PENDING_APPROVAL' ? (
                      <>
                        <button className="btn btn-sm" onClick={() => approve(r)}>
                          <span className="material-icons">check_circle</span> {t('directorRequests.approve')}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => reject(r)}>
                          <span className="material-icons">cancel</span> {t('directorRequests.reject')}
                        </button>
                      </>
                    ) : (
                      <span className="muted">—</span>
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
