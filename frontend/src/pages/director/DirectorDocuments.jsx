import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { DOC_STATUS_LABEL_KEYS, docStatusBadgeClass } from '../../roles.js';

const FILTERS = [
  { key: 'PENDING', labelKey: 'directorDocuments.filters.PENDING' },
  { key: 'UNDER_REVIEW', labelKey: 'directorDocuments.filters.UNDER_REVIEW' },
  { key: 'APPROVED', labelKey: 'directorDocuments.filters.APPROVED' },
  { key: 'REJECTED', labelKey: 'directorDocuments.filters.REJECTED' },
  { key: 'ALL', labelKey: 'directorDocuments.filters.ALL' }
];

export default function DirectorDocuments() {
  const { lang, t } = useI18n();
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('PENDING');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/director/documents/all')
      .then(setDocs)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (d, status) => {
    const reply = window.prompt(
      status === 'APPROVED'
        ? t('directorDocuments.approvePrompt', { docType: d.docType })
        : t('directorDocuments.rejectPrompt', { docType: d.docType }),
      ''
    );
    if (reply === null) return;
    setMsg('');
    try {
      await api.put(`/director/documents/${d.id}/review`, { status, directorReply: reply || '' });
      setMsg(status === 'APPROVED' ? t('directorDocuments.approvedMsg', { docType: d.docType }) : t('directorDocuments.rejectedMsg', { docType: d.docType }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = filter === 'ALL' ? docs : docs.filter((d) => d.status === filter);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorDocuments.title')}</h3>
        <p className="muted">{t('directorDocuments.subtitle')}</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      <div className="teacher-tabs" style={{ marginBottom: '1rem' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`badge ${filter === f.key ? 'badge-approved' : ''}`}
            style={{ cursor: 'pointer', border: 'none', marginInlineEnd: '0.5rem' }}
            onClick={() => setFilter(f.key)}
          >
            {t(f.labelKey)} {f.key === 'ALL' ? '' : `(${docs.filter((d) => d.status === f.key).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{t('directorDocuments.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('directorDocuments.dateColumn')}</th>
                <th>{t('directorDocuments.parentColumn')}</th>
                <th>{t('directorDocuments.studentColumn')}</th>
                <th>{t('directorDocuments.typeColumn')}</th>
                <th>{t('directorDocuments.titleColumn')}</th>
                <th>{t('directorDocuments.noteColumn')}</th>
                <th>{t('directorDocuments.fileColumn')}</th>
                <th>{t('directorDocuments.statusColumn')}</th>
                <th>{t('directorDocuments.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{d.parent.firstName} {d.parent.lastName}</td>
                  <td>{d.student ? `${d.student.firstName} ${d.student.lastName}` : '—'}</td>
                  <td>{d.docType}</td>
                  <td>{d.title || '—'}</td>
                  <td className="muted">{d.note || '—'}</td>
                  <td>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <span className="material-icons">visibility</span> {t('directorDocuments.view')}
                    </a>
                  </td>
                  <td>
                    <span className={`badge badge-${docStatusBadgeClass(d.status)}`}>
                      {DOC_STATUS_LABEL_KEYS[d.status] ? t(DOC_STATUS_LABEL_KEYS[d.status]) : d.status}
                    </span>
                    {d.directorReply && <div className="muted" style={{ marginTop: '0.2rem' }}>{d.directorReply}</div>}
                  </td>
                  <td className="actions">
                    {['PENDING', 'UNDER_REVIEW'].includes(d.status) ? (
                      <>
                        <button className="btn btn-sm" onClick={() => review(d, 'APPROVED')}>
                          <span className="material-icons">check_circle</span> {t('directorDocuments.approve')}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => review(d, 'REJECTED')}>
                          <span className="material-icons">cancel</span> {t('directorDocuments.reject')}
                        </button>
                      </>
                    ) : (
                      <span className="muted">{t('directorDocuments.processed')}</span>
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
