import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDate as fmtDate } from '../../utils/formatUtils.js';


export default function ChildAssignments() {
  const { lang, t } = useI18n();
  const [children, setChildren] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/parent/assignments')
      .then(setChildren)
      .catch((err) => setError(err.message));
  }, []);

  if (children.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>{t('childAssignments.title')}</h3></div>
        {error && <div className="form-error">{error}</div>}
        <div className="empty">{t('childAssignments.noChildren')}</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head"><h3>{t('childAssignments.trackingTitle')}</h3></div>

      {children.map(({ student, assignments }) => (
        <div key={student.id} className="child-card" style={{ marginBottom: 20 }}>
          <h4>{student.firstName} {student.lastName}</h4>
          <p className="sub">{student.level} — {student.class?.name || ''}</p>

          {assignments.length === 0 ? (
            <p className="muted">{t('childAssignments.noAssignments')}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('childAssignments.assignment')}</th>
                    <th>{t('childAssignments.subject')}</th>
                    <th>{t('childAssignments.dueDate')}</th>
                    <th>{t('childAssignments.status')}</th>
                    <th>{t('childAssignments.grade')}</th>
                    <th>{t('childAssignments.note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.subject}</td>
                      <td>{fmtDate(a.dueDate, lang)}</td>
                      <td>
                        {a.done ? (
                          <span className={`badge ${a.submission?.status === 'GRADED' ? 'good' : 'warn'}`}>
                            {a.submission?.status === 'GRADED' ? t('childAssignments.graded') : t('childAssignments.submitted')}
                          </span>
                        ) : (
                          <span className={`badge ${a.overdue ? 'bad' : ''}`}>
                            {a.overdue ? t('childAssignments.overdue') : t('childAssignments.notDone')}
                          </span>
                        )}
                      </td>
                      <td>
                        {a.submission?.status === 'GRADED' ? (
                          <span className={`badge ${a.submission.percent >= 70 ? 'good' : a.submission.percent >= 45 ? 'warn' : 'bad'}`}>
                            {a.submission.score} / {a.submission.totalPoints} ({a.submission.percent}%)
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="muted">{a.submission?.feedback || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
