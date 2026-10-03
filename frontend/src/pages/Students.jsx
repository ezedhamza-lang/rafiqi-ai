import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ACCOUNT_STATUS_LABEL_KEYS, statusBadgeClass } from '../roles.js';
import { levelLabel } from '../utils/labels.js';
import { useI18n } from '../i18n/index.jsx';

export default function Students() {
  const { t, lang } = useI18n();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/students')
      .then(setStudents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const subStatus = (s) => {
    const subs = s.account?.subscriptions || [];
    if (!subs.length) return 'PENDING_APPROVAL';
    const active = subs.find((x) => x.status === 'ACTIVE');
    if (active) return 'ACTIVE';
    const order = ['SUSPENDED', 'PENDING_PAYMENT', 'EXPIRED'];
    for (const st of order) {
      const found = subs.find((x) => x.status === st);
      if (found) return st;
    }
    return subs[0].status;
  };

  return (
    <>
      <h2>{t('students.title')}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.4rem', lineHeight: 1.8 }}>
        {t('students.subtitle')}
      </p>
      <Link to="/registration" className="btn btn-primary" style={{ marginBottom: '1.6rem' }}>
        <span className="material-icons">person_add</span> {t('students.requestStudentNew')}
      </Link>

      {loading ? (
        <div className="loading-wrap">
          <span className="spinner" />
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <span className="material-icons">groups</span>
          <p>{t('students.empty')}</p>
          <Link to="/registration" className="btn btn-primary btn-sm" style={{ marginTop: '0.8rem' }}>
            {t('students.requestStudent')}
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('students.firstName')}</th>
                <th>{t('students.lastName')}</th>
                <th>{t('students.level')}</th>
                <th>{t('students.class')}</th>
                <th>{t('students.schoolYear')}</th>
                <th>{t('students.accountStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.firstName}</td>
                  <td>{s.lastName}</td>
                  <td>{levelLabel(s.level, lang)}</td>
                  <td>{s.class?.name || '-'}</td>
                  <td>{s.schoolYear}</td>
                  <td>
                    <span className={`badge badge-${statusBadgeClass(subStatus(s))}`}>
                      {ACCOUNT_STATUS_LABEL_KEYS[subStatus(s)] ? t(ACCOUNT_STATUS_LABEL_KEYS[subStatus(s)]) : subStatus(s)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
