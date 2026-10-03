import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { REQUEST_STATUS_LABEL_KEYS, helpStatusLabel, statusBadgeClass } from '../roles.js';
import { levelLabel } from '../utils/labels.js';

export default function MyRequests() {
  const { lang, t } = useI18n();
  const [subscriptionRequests, setSubscriptionRequests] = useState([]);
  const [helpRequests, setHelpRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/subscription-requests/mine'), api.get('/help-requests/mine')])
      .then(([sr, h]) => {
        setSubscriptionRequests(sr);
        setHelpRequests(h);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-wrap">
        <span className="spinner" />
      </div>
    );
  }

  const isEmpty = subscriptionRequests.length === 0 && helpRequests.length === 0;

  return (
    <>
      <h2>{t('myRequests.title')}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.4rem' }}>
        {t('myRequests.subtitle')}
      </p>

      {isEmpty ? (
        <div className="empty-state">
          <span className="material-icons">folder_open</span>
          <p>{t('myRequests.empty')}</p>
        </div>
      ) : (
        <>
          {subscriptionRequests.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem' }}>{t('myRequests.subscriptionRequestsTitle')}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('myRequests.student')}</th>
                      <th>{t('myRequests.level')}</th>
                      <th>{t('myRequests.year')}</th>
                      <th>{t('myRequests.status')}</th>
                      <th>{t('myRequests.reasonOrClass')}</th>
                      <th>{t('myRequests.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionRequests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.firstName} {r.lastName}</td>
                        <td>{levelLabel(r.level, lang)}</td>
                        <td>{r.schoolYear}</td>
                        <td>
                          <span className={`badge badge-${statusBadgeClass(r.status)}`}>
                            {REQUEST_STATUS_LABEL_KEYS[r.status] ? t(REQUEST_STATUS_LABEL_KEYS[r.status]) : r.status}
                          </span>
                        </td>
                        <td>{r.rejectionReason || (r.class ? t('myRequests.classLabel', { class: r.class.name }) : '-')}</td>
                        <td className="date-value">{new Date(r.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {helpRequests.length > 0 && (
            <div>
              <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem' }}>{t('myRequests.helpRequestsTitle')}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('myRequests.requestType')}</th>
                      <th>{t('myRequests.delegation')}</th>
                      <th>{t('myRequests.status')}</th>
                      <th>{t('myRequests.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {helpRequests.map((h) => (
                      <tr key={h.id}>
                        <td>{h.requestType}</td>
                        <td>{h.delegation || '-'}</td>
                        <td>
                          <span className={`badge badge-${h.status.toLowerCase()}`}>
                            {helpStatusLabel(t, h.status)}
                          </span>
                        </td>
                        <td className="date-value">{new Date(h.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
