import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function HealthRecords() {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/teacher/health/class')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.healthRecords.title')}</h3>
        <p className="muted">
          {t('teacherSpace.healthRecords.subtitle')}
        </p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}

      {data.length === 0 ? (
        <div className="empty">{t('teacherSpace.healthRecords.empty')}</div>
      ) : (
        data.map((c) => (
          <div key={c.classId} style={{ marginBottom: '1.4rem' }}>
            <h4 style={{ marginBottom: '0.6rem' }}>{c.className}</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.healthRecords.studentCol')}</th>
                    <th>{t('teacherSpace.healthRecords.allergiesCol')}</th>
                    <th>{t('teacherSpace.healthRecords.chronicCol')}</th>
                    <th>{t('teacherSpace.healthRecords.bloodTypeCol')}</th>
                    <th>{t('teacherSpace.healthRecords.emergencyPhoneCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.students.map((s) => (
                    <tr key={s.studentId}>
                      <td>{s.firstName} {s.lastName}</td>
                      <td>{s.record?.allergies || <span className="muted">—</span>}</td>
                      <td>{s.record?.chronicConditions || <span className="muted">—</span>}</td>
                      <td>{s.record?.bloodType || <span className="muted">—</span>}</td>
                      <td dir="ltr">{s.record?.emergencyPhone || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
