import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import TrendChart from '../../components/TrendChart.jsx';
import { useI18n } from '../../i18n/index.jsx';

function shortLabel(title) {
  if (!title) return '#';
  const words = title.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
}

export default function Analytics({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [classReport, setClassReport] = useState(null);
  const [studentReport, setStudentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadClass = useCallback(async (id) => {
    setLoading(true);
    setError('');
    setStudentReport(null);
    try {
      const data = await api.get(`/teacher/analytics/class/${id}`);
      setClassReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (classId) loadClass(classId);
  }, [classId, loadClass]);

  const openStudent = async (studentId) => {
    setError('');
    setStudentReport(null);
    try {
      const data = await api.get(`/teacher/analytics/students/${studentId}`);
      setStudentReport(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportFile = async (format) => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/analytics/export?classId=${classId}&format=${format}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token') || ''}` }
      });
      if (!res.ok) {
        setError(t('teacherSpace.analytics.exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename\*=UTF-8''([^;]+)/);
      const file = match ? decodeURIComponent(match[1]) : `${t('teacherSpace.analytics.resultsFileName')}.${format === 'pdf' ? 'pdf' : 'csv'}`;
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const backToList = () => {
    setStudentReport(null);
  };

  if (studentReport) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>{t('teacherSpace.analytics.reportTitle', { name: `${studentReport.student?.firstName || ''} ${studentReport.student?.lastName || ''}` })}</h3>
            <p className="sub">{studentReport.class?.name} — {studentReport.class?.level || ''}</p>
          </div>
          <button className="btn" onClick={backToList}>{t('teacherSpace.analytics.backToClass')}</button>
        </div>

        <div className="mini-stats">
          <div className="mini-stat">
            <strong>{t('teacherSpace.analytics.submittedOf', { submitted: studentReport.summary.submitted, total: studentReport.summary.assignmentsTotal })}</strong>
            <span>{t('teacherSpace.analytics.assignmentDone')}</span>
          </div>
          <div className="mini-stat">
            <strong>{studentReport.summary.completionRate}%</strong>
            <span>{t('teacherSpace.analytics.completionRate')}</span>
          </div>
          <div className="mini-stat">
            <strong>{studentReport.summary.avgPercent}%</strong>
            <span>{t('teacherSpace.analytics.overallAverage')}</span>
          </div>
        </div>

        <div className="sub-grid">
          <div className="card-item">
            <h4>{t('teacherSpace.analytics.strengthsBySubject')}</h4>
            {studentReport.strengths.length === 0 ? (
              <p className="muted">{t('teacherSpace.analytics.noStrengthsYet')}</p>
            ) : (
              <ul className="strength-list">
                {studentReport.strengths.map((s) => (
                  <li key={s.subject}>
                    <span className="material-icons good-text">check_circle</span>
                    {s.label} — <strong>{s.avgPercent}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card-item">
            <h4>{t('teacherSpace.analytics.weaknesses')}</h4>
            {studentReport.weaknesses.length === 0 ? (
              <p className="muted">{t('teacherSpace.analytics.noWeaknesses')}</p>
            ) : (
              <ul className="weakness-list">
                {studentReport.weaknesses.map((s) => (
                  <li key={s.subject}>
                    <span className="material-icons bad-text">cancel</span>
                    {s.label} — <strong>{s.avgPercent}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card-item" style={{ marginTop: '1rem' }}>
          <h4>{t('teacherSpace.analytics.performanceTrend')}</h4>
          <TrendChart
            points={studentReport.trend.map((tr) => ({
              percent: tr.percent,
              title: tr.title,
              subjectLabel: tr.subjectLabel,
              shortLabel: shortLabel(tr.title)
            }))}
          />
        </div>

        <div className="card-item" style={{ marginTop: '1rem' }}>
          <h4>{t('teacherSpace.analytics.earlyAlerts')}</h4>
          {studentReport.alerts.length === 0 ? (
            <p className="muted">{t('teacherSpace.analytics.noAlerts')}</p>
          ) : (
            <div className="alerts-list">
              {studentReport.alerts.map((a, i) => {
                const label = t(`teacherSpace.analytics.alerts.${a.type}`) || a.title;
                const meta = { LOW_COMPLETION: 'bad', DECLINING_GRADES: 'bad', OVERDUE: 'warn', LOW_AVERAGE: 'warn' };
                const icon = { LOW_COMPLETION: 'priority_high', DECLINING_GRADES: 'trending_down', OVERDUE: 'schedule', LOW_AVERAGE: 'warning' };
                return (
                  <div key={i} className={`alert-item alert-${meta[a.type] || 'warn'}`}>
                    <span className="material-icons">{icon[a.type] || 'info'}</span>
                    <div>
                      <strong>{label}</strong>
                      <p>{a.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {studentReport.subjects.length > 0 && (
          <div className="card-item" style={{ marginTop: '1rem' }}>
            <h4>{t('teacherSpace.analytics.detailsBySubject')}</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.analytics.subjectCol')}</th>
                    <th>{t('teacherSpace.analytics.assignmentsCol')}</th>
                    <th>{t('teacherSpace.analytics.doneCol')}</th>
                    <th>{t('teacherSpace.analytics.avgCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentReport.subjects.map((s) => (
                    <tr key={s.subject}>
                      <td>{s.label}</td>
                      <td>{s.total}</td>
                      <td>{s.submitted}</td>
                      <td>
                        <span className={`badge ${s.avgPercent >= 70 ? 'good' : s.avgPercent >= 45 ? 'warn' : 'bad'}`}>
                          {s.avgPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('teacherSpace.analytics.title')}</h3>
          <p className="sub">{t('teacherSpace.analytics.subtitle')}</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('teacherSpace.analytics.classLabel')}</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('teacherSpace.analytics.selectClass')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ alignSelf: 'flex-end' }}>
          <button className="btn" onClick={() => exportFile('csv')} disabled={!classId}>
            {t('teacherSpace.analytics.exportExcel')}
          </button>
          <button className="btn btn-primary" onClick={() => exportFile('pdf')} disabled={!classId}>
            {t('teacherSpace.analytics.exportPdf')}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="loading-wrap"><span className="spinner" /></div>}

      {classReport && !loading && (
        <>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{classReport.summary.studentsCount}</strong>
              <span>{t('teacherSpace.analytics.studentsCount')}</span>
            </div>
            <div className="mini-stat">
              <strong>{classReport.summary.assignmentsTotal}</strong>
              <span>{t('teacherSpace.analytics.assignmentsCount')}</span>
            </div>
            <div className="mini-stat">
              <strong>{classReport.summary.overallAvg}%</strong>
              <span>{t('teacherSpace.analytics.classAverage')}</span>
            </div>
            <div className="mini-stat">
              <strong>{classReport.summary.overallCompletion}%</strong>
              <span>{t('teacherSpace.analytics.completionRate')}</span>
            </div>
            <div className="mini-stat">
              <strong className={classReport.summary.atRiskCount > 0 ? 'bad-text' : ''}>{classReport.summary.atRiskCount}</strong>
              <span>{t('teacherSpace.analytics.needsFollowUp')}</span>
            </div>
          </div>

          {classReport.atRiskStudents.length > 0 && (
            <div className="card-item" style={{ marginBottom: '1rem' }}>
              <h4>{t('teacherSpace.analytics.earlyAlertsShort')}</h4>
              <div className="alerts-list">
                {classReport.atRiskStudents.map((s) => (
                  <div key={s.studentId} className="alert-item alert-bad">
                    <span className="material-icons">priority_high</span>
                    <div>
                      <strong>{s.firstName} {s.lastName}</strong>
                      <p>{t('teacherSpace.analytics.completionAndAvg', { completion: s.completionRate, avg: s.avgPercent })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {classReport.students.length === 0 ? (
            <div className="empty">{t('teacherSpace.analytics.noStudentsYet')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.analytics.studentCol')}</th>
                    <th>{t('teacherSpace.analytics.completionCol')}</th>
                    <th>{t('teacherSpace.analytics.avgShortCol')}</th>
                    <th>{t('teacherSpace.analytics.statusCol')}</th>
                    <th>{t('teacherSpace.analytics.reportCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {classReport.students.map((s) => (
                    <tr key={s.studentId}>
                      <td>{s.firstName} {s.lastName}</td>
                      <td>{s.completionRate}%</td>
                      <td>{s.avgPercent}%</td>
                      <td>
                        <span className={`badge ${s.atRisk ? 'bad' : 'good'}`}>
                          {s.atRisk ? t('teacherSpace.analytics.needsAttention') : t('teacherSpace.analytics.stable')}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => openStudent(s.studentId)}>{t('teacherSpace.analytics.reportBtn')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {classReport.perAssignment.length > 0 && (
            <div className="card-item" style={{ marginTop: '1rem' }}>
              <h4>{t('teacherSpace.analytics.assignmentAveragesTitle')}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('teacherSpace.analytics.assignmentCol')}</th>
                      <th>{t('teacherSpace.analytics.subjectCol')}</th>
                      <th>{t('teacherSpace.analytics.submissionsCol')}</th>
                      <th>{t('teacherSpace.analytics.classAverageCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classReport.perAssignment.map((a) => (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>{a.subjectLabel}</td>
                        <td>{a.submitted} / {a.totalStudents}</td>
                        <td>{a.avgPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
