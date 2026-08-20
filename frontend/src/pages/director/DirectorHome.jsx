import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function DirectorHome() {
  const { lang, t } = useI18n();
  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/director/dashboard'),
      api.get('/director/stats'),
      api.get('/director/alerts'),
      api.get('/director/activity')
    ]).then(([d, s, a, act]) => {
      setDashboard(d);
      setStats(s);
      setAlerts(a);
      setActivity(act);
    }).catch(() => {});
  }, []);

  if (!dashboard) return <div className="loading-wrap"><span className="spinner" /></div>;

  const cards = [
    { key: 'classes', value: dashboard.totals.classes, icon: 'school' },
    { key: 'students', value: dashboard.totals.students, icon: 'groups' },
    { key: 'teachers', value: dashboard.totals.teachers, icon: 'co_present' },
    { key: 'parents', value: dashboard.totals.parents, icon: 'family_restroom' },
    { key: 'quizzes', value: dashboard.totals.quizzes, icon: 'quiz' },
    { key: 'submissions', value: dashboard.totals.submissions, icon: 'task_alt' },
    { key: 'memos', value: dashboard.totals.memos, icon: 'description' },
    { key: 'unread', value: dashboard.totals.unreadMessages, icon: 'mark_email_unread' }
  ];

  const maxTrend = Math.max(1, ...(stats?.trend || []).map((tr) => tr.count));

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorHome.title')}</h3>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.key} className="card-item stat-card">
            <span className="material-icons">{c.icon}</span>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{t(`directorHome.cards.${c.key}`)}</div>
          </div>
        ))}
      </div>

      <div className="sub-grid">
        <div className="card-item">
          <h4>{t('directorHome.trendTitle')}</h4>
          <div className="trend-bars">
            {stats?.trend?.map((tr) => (
              <div key={tr.date} className="trend-col" title={`${tr.date}: ${tr.count}`}>
                <div className="trend-bar" style={{ height: `${(tr.count / maxTrend) * 100}%` }} />
                <span className="trend-label">{tr.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-item">
          <h4>{t('directorHome.alertsTitle')}</h4>
          <ul className="alert-list">
            <li>{t('directorHome.alertsNoClass')} <strong>{alerts?.studentsNoClass || 0}</strong></li>
            <li>{t('directorHome.alertsNoParent')} <strong>{alerts?.studentsNoParent || 0}</strong></li>
            <li>{t('directorHome.alertsNoActivity')} <strong>{(alerts?.noActivity || []).length}</strong> {alerts?.noActivity?.join(lang === 'ar' ? '، ' : ', ')}</li>
          </ul>
        </div>
      </div>

      <div className="card-item">
        <h4>{t('directorHome.activityTitle')}</h4>
        {activity && (activity.submissions.length || activity.memos.length) ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('directorHome.activityColumn')}</th>
                  <th>{t('directorHome.detailsColumn')}</th>
                  <th>{t('directorHome.dateColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {activity.submissions.map((s) => (
                  <tr key={`s${s.id}`}>
                    <td>{t('directorHome.activitySubmission')}</td>
                    <td>{s.student.firstName} {s.student.lastName} — {s.quiz.title}</td>
                    <td>{new Date(s.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  </tr>
                ))}
                {activity.memos.map((m) => (
                  <tr key={`m${m.id}`}>
                    <td>{t('directorHome.activityMemo')}</td>
                    <td>{m.teacher.firstName} {m.teacher.lastName} — {m.lessonTitle}</td>
                    <td>{new Date(m.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('directorHome.noActivity')}</p>
        )}
      </div>
    </div>
  );
}
