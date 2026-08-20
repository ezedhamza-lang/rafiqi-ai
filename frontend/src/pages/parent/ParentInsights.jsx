import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const RISK_META = {
  LOW: { labelKey: 'parentInsights.riskLow', cls: 'good', icon: 'sentiment_very_satisfied' },
  MEDIUM: { labelKey: 'parentInsights.riskMedium', cls: 'warn', icon: 'sentiment_neutral' },
  HIGH: { labelKey: 'parentInsights.riskHigh', cls: 'bad', icon: 'sentiment_dissatisfied' },
  CRITICAL: { labelKey: 'parentInsights.riskCritical', cls: 'critical', icon: 'warning' }
};

export default function ParentInsights({ childrenData }) {
  const { t } = useI18n();
  const [childId, setChildId] = useState('');
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  const children = childrenData.map(({ student }) => student).filter((s) => s.accountUserId);

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(String(children[0].accountUserId));
  }, [children, childId]);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    setError('');
    setAiResult(null);
    try {
      const data = await api.get(`/parent/insights/children/${childId}`);
      setInsight(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const generateAI = async () => {
    if (!childId) return;
    setGenerating(true);
    setAiResult(null);
    try {
      const data = await api.post(`/parent/insights/children/${childId}/generate`);
      setAiResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (children.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>{t('parentInsights.title')}</h3></div>
        <div className="empty">{t('parentInsights.noChild')}</div>
      </div>
    );
  }

  const meta = insight ? RISK_META[insight.prediction.riskLevel] || RISK_META.LOW : null;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('parentInsights.title')}</h3>
          <p className="sub">{t('parentInsights.subtitle')}</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t('parentInsights.child')}</label>
          <select
            value={childId}
            onChange={(e) => {
              setChildId(e.target.value);
              setInsight(null);
            }}
          >
            {children.map((s) => (
              <option key={s.id} value={s.accountUserId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {loading && <div className="loading-wrap"><span className="spinner" /></div>}

      {insight && !loading && (
        <>
          {!insight.prediction.hasData ? (
            <div className="empty">{t('parentInsights.noData')}</div>
          ) : (
            <>
              <div className="insight-risk">
                <div className="risk-ring" data-tone={meta.cls}>
                  <strong>{insight.prediction.riskScore}</strong>
                  <span>/ 100</span>
                </div>
                <div className="risk-side">
                  <span className={`risk-badge risk-${meta.cls}`}>
                    <span className="material-icons">{meta.icon}</span> {t(meta.labelKey)}
                  </span>
                  <p className="sub">{t('parentInsights.riskSubtitle')}</p>
                </div>
              </div>

              <div className="insight-reasons">
                <h4>{t('parentInsights.reasonsTitle')}</h4>
                {insight.prediction.reasons.length === 0 ? (
                  <p className="muted">{t('parentInsights.noReasons')}</p>
                ) : (
                  <div className="alerts-list">
                    {insight.prediction.reasons.map((r, i) => (
                      <div key={i} className={`alert-item alert-${r.severity === 'high' ? 'bad' : 'warn'}`}>
                        <span className="material-icons">{r.severity === 'high' ? 'error' : 'info'}</span>
                        <div>
                          <strong>{r.title}</strong>
                          <p>{r.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="insight-summary">
                <h4>{t('parentInsights.summaryTitle')}</h4>
                <p>{insight.summary}</p>
                <button className="btn btn-primary" onClick={generateAI} disabled={generating}>
                  {generating ? t('parentInsights.generating') : insight.aiConfigured ? t('parentInsights.generateAi') : t('parentInsights.generateFallback')}
                </button>
                {!insight.aiConfigured && (
                  <p className="muted small-note">{t('parentInsights.aiNotConfigured')}</p>
                )}
              </div>

              {aiResult && (
                <div className="insight-ai-result">
                  <div className="panel-head">
                    <h4>{aiResult.ai ? t('parentInsights.aiSummaryTitle') : t('parentInsights.deterministicTitle')}</h4>
                    {aiResult.ai && <span className="badge good-text">AI</span>}
                  </div>
                  <p className="ai-summary-text">{aiResult.summary}</p>
                  <h5>{t('parentInsights.suggestedActivities')}</h5>
                  <ul className="activity-list">
                    {(Array.isArray(aiResult.activities) ? aiResult.activities : []).map((a, i) => (
                      <li key={i}>
                        <span className="material-icons">check_circle</span>
                        <div>
                          <strong>{a.title}</strong>
                          <p>{a.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="insight-activities">
                <h4>{t('parentInsights.activitiesTitle')}</h4>
                <ul className="activity-list">
                  {insight.activities.map((a) => (
                    <li key={a.key}>
                      <span className="material-icons">{a.icon}</span>
                      <div>
                        <strong>{a.title}</strong>
                        <p>{a.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="insight-data">
                <h4>{t('parentInsights.dataOverview')}</h4>
                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>{insight.data.assignments.submitted} / {insight.data.assignments.total}</strong>
                    <span>{t('parentInsights.assignmentsDone')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{insight.data.attendance.absenceRate}%</strong>
                    <span>{t('parentInsights.absenceRate')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{insight.data.lessonsCompleted}</strong>
                    <span>{t('parentInsights.lessonsCompleted')}</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{insight.data.adaptive.accuracy}%</strong>
                    <span>{t('parentInsights.smartReviewAccuracy')}</span>
                  </div>
                </div>

                {insight.data.subjects.length > 0 && (
                  <div className="sub-grid">
                    {insight.data.subjects.map((s) => (
                      <div key={s.subject} className="card-item">
                        <h4>{s.label}</h4>
                        <p className="muted">
                          {s.gradedCount > 0 ? t('parentInsights.gradedCount', { percent: s.avgPercent, n: s.gradedCount }) : t('parentInsights.noResults')}
                        </p>
                        <span className={`risk-badge risk-${s.weakness ? 'bad' : 'good'}`}>
                          {s.weakness ? t('parentInsights.needsStrengthening') : s.strength ? t('parentInsights.good') : t('parentInsights.noAssessment')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
