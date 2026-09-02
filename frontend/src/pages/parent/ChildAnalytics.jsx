import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import TrendChart from '../../components/TrendChart.jsx';

const SUBJECT_LABEL_KEYS = {
  MATH: 'subjects.MATH',
  READING: 'subjects.READING',
  SCIENCE: 'subjects.SCIENCE',
  STORIES: 'subjects.STORIES',
  GENERAL: 'subjects.GENERAL'
};

function subjectLabel(t, code) {
  return SUBJECT_LABEL_KEYS[code] ? t(SUBJECT_LABEL_KEYS[code]) : code || t('subjects.GENERAL');
}

function shortLabel(title) {
  if (!title) return '#';
  const words = title.split(' ').filter(Boolean);
  return words.slice(0, 2).join(' ');
}

const ALERT_META = {
  LOW_COMPLETION: { labelKey: 'childAnalytics.alertLowCompletion', icon: 'priority_high', cls: 'bad' },
  DECLINING_GRADES: { labelKey: 'childAnalytics.alertDecliningGrades', icon: 'trending_down', cls: 'bad' },
  OVERDUE: { labelKey: 'childAnalytics.alertOverdue', icon: 'schedule', cls: 'warn' },
  LOW_AVERAGE: { labelKey: 'childAnalytics.alertLowAverage', icon: 'warning', cls: 'warn' }
};

export default function ChildAnalytics({ childrenData }) {
  const { t } = useI18n();
  const [childId, setChildId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const children = childrenData
    .map(({ student }) => student)
    .filter((s) => s.accountUserId);

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(String(children[0].accountUserId));
  }, [children, childId]);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/parent/analytics/children/${childId}`);
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  if (children.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>{t('childAnalytics.noChildTitle')}</h3></div>
        <div className="empty">{t('childAnalytics.noChild')}</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('childAnalytics.title')}</h3>
          <p className="sub">{t('childAnalytics.subtitle')}</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('childAnalytics.child')}</label>
          <select value={childId} onChange={(e) => { setChildId(e.target.value); setReport(null); }}>
            {children.map((s) => (
              <option key={s.id} value={s.accountUserId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
        {childId && (
          <div className="form-group">
            <label>&nbsp;</label>
            <button
              className="btn btn-primary"
              onClick={() => api.download(`/parent/analytics/children/${childId}/pdf`, `report-${childId}.pdf`)}
            >
              <span className="material-icons">picture_as_pdf</span>
              {t('childAnalytics.downloadPdf')}
            </button>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="loading-wrap"><span className="spinner" /></div>}

      {report && !loading && (
        <>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{report.summary.submitted} / {report.summary.assignmentsTotal}</strong>
              <span>{t('childAnalytics.assignmentsDone')}</span>
            </div>
            <div className="mini-stat">
              <strong>{report.summary.completionRate}%</strong>
              <span>{t('childAnalytics.completionRate')}</span>
            </div>
            <div className="mini-stat">
              <strong>{report.summary.avgPercent}%</strong>
              <span>{t('childAnalytics.overallAverage')}</span>
            </div>
          </div>

          <div className="sub-grid">
            <div className="card-item">
              <h4>{t('childAnalytics.strengths')}</h4>
              {report.strengths.length === 0 ? (
                <p className="muted">{t('childAnalytics.noStrengths')}</p>
              ) : (
                <ul className="strength-list">
                  {report.strengths.map((s) => (
                    <li key={s.subject}>
                      <span className="material-icons good-text">check_circle</span>
                      {subjectLabel(t, s.subject)} — <strong>{s.avgPercent}%</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card-item">
              <h4>{t('childAnalytics.weaknesses')}</h4>
              {report.weaknesses.length === 0 ? (
                <p className="muted">{t('childAnalytics.noWeaknesses')}</p>
              ) : (
                <ul className="weakness-list">
                  {report.weaknesses.map((s) => (
                    <li key={s.subject}>
                      <span className="material-icons bad-text">cancel</span>
                      {subjectLabel(t, s.subject)} — <strong>{s.avgPercent}%</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card-item" style={{ marginTop: '1rem' }}>
            <h4>{t('childAnalytics.trend')}</h4>
            <TrendChart
              points={report.trend.map((tr) => ({
                percent: tr.percent,
                title: tr.title,
                subjectLabel: subjectLabel(t, tr.subject),
                shortLabel: shortLabel(tr.title)
              }))}
            />
          </div>

          <div className="card-item" style={{ marginTop: '1rem' }}>
            <h4>{t('childAnalytics.alerts')}</h4>
            {report.alerts.length === 0 ? (
              <p className="muted">{t('childAnalytics.noAlerts')}</p>
            ) : (
              <div className="alerts-list">
                {report.alerts.map((a, i) => {
                  const meta = ALERT_META[a.type] || { labelKey: null, icon: 'info', cls: 'warn' };
                  return (
                    <div key={i} className={`alert-item alert-${meta.cls}`}>
                      <span className="material-icons">{meta.icon}</span>
                      <div>
                        <strong>{meta.labelKey ? t(meta.labelKey) : a.title}</strong>
                        <p>{a.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
