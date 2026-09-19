import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import AdaptiveSessionCard from '../../components/AdaptiveSessionCard.jsx';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECT_META = {
  math: { icon: 'calculate', bg: 'linear-gradient(135deg, #233863, #2f4a7d)' },
  anisi: { icon: 'menu_book', bg: 'linear-gradient(135deg, #F5B942, #E8A317)' },
  science: { icon: 'science', bg: 'linear-gradient(135deg, #0e6b4f, #17a076)' }
};

function subjectMeta(code, t) {
  const m = SUBJECT_META[code] || { icon: 'school', bg: 'linear-gradient(135deg,#555,#777)' };
  return { ...m, label: t(`studentSpace.books.subjects.${code}`) || code };
}

export default function StudentLearningPlan() {
  const { t } = useI18n();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noStudent, setNoStudent] = useState(false);
  const [session, setSession] = useState(null);
  const [sessIdx, setSessIdx] = useState(0);
  const [sessLoading, setSessLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/student/adaptive/plan');
      setPlan(data);
    } catch (e) {
      if (e.status === 404) setNoStudent(true);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startSession = async () => {
    setSessLoading(true);
    setError('');
    setSession(null);
    setSessIdx(0);
    try {
      const data = await api.post('/student/adaptive/plan/session', { limit: 8 });
      setSession(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSessLoading(false);
    }
  };

  const handleReviewed = (res) => {
    setSession((s) => (s ? { ...s, items: s.items.map((it, i) => (i === sessIdx ? { ...it, state: res.state } : it)) } : s));
    load();
  };

  const next = () => {
    if (!session) return;
    if (sessIdx + 1 < session.items.length) setSessIdx(sessIdx + 1);
    else setSession((s) => (s ? { ...s, done: true } : s));
  };

  const current = session && !session.done ? session.items[sessIdx] : null;

  const renderDailyPlan = (p) => (
    <div className="plan-section">
      <div className="plan-section-head">
        <h4>{t('studentSpace.learningPlan.todayPlan')}</h4>
        <span className="badge">{t('studentSpace.learningPlan.itemsCount', { n: p.dailyPlan.length })}</span>
      </div>
      {p.dailyPlan.length === 0 ? (
        <div className="empty">{t('studentSpace.learningPlan.noItemsToday')}</div>
      ) : (
        <div className="plan-items">
          {p.dailyPlan.map((item, i) => {
            const typeLabel = t(`studentSpace.learningPlan.types.${item.type}`) || item.type;
            const typeIcon = { REVIEW: 'psychology', LESSON: 'menu_book', EXERCISE: 'edit_note' }[item.type] || 'task_alt';
            const sm = subjectMeta(item.subjectId, t);
            return (
              <div key={i} className="plan-item">
                <span className="plan-item-icon" style={{ background: sm.bg }}>
                  <span className="material-icons">{typeIcon}</span>
                </span>
                <div className="plan-item-body">
                  <strong>{item.title}</strong>
                  <span className="plan-item-meta">{sm.label} Â· {typeLabel}</span>
                  {item.detail && <span className="muted" style={{ fontSize: '0.82rem' }}>{item.detail}</span>}
                </div>
                {item.link && (
                  <a href={item.link} className="btn btn-sm btn-ghost">{t('studentSpace.learningPlan.goLink')}</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const subjectReasons = (s) => {
    const out = [];
    if (s.status === 'WEAK' && s.proficiency != null) {
      out.push(t('studentSpace.learningPlan.reasonProficiency', { n: s.proficiency }));
    }
    if (s.adaptive?.reviews >= 3 && s.adaptive?.accuracy != null && s.adaptive.accuracy < 60) {
      out.push(t('studentSpace.learningPlan.reasonAccuracy', { n: s.adaptive.accuracy }));
    }
    if (s.adaptive?.dueNow > 0) out.push(t('studentSpace.learningPlan.reasonDueCards', { n: s.adaptive.dueNow }));
    if (s.remainingLessons > 0) out.push(t('studentSpace.learningPlan.reasonRemainingLessons', { n: s.remainingLessons }));
    return out;
  };

  const renderSubject = (s) => {
    const meta = subjectMeta(s.subjectId, t);
    const statusLabel = t(`studentSpace.learningPlan.status.${s.status || 'NO_DATA'}`);
    const statusCls = { WEAK: 'bad', MEDIUM: 'warn', STRONG: 'good', NO_DATA: 'neutral' }[s.status] || 'neutral';
    const reasons = subjectReasons(s);
    return (
      <div key={s.subjectId} className="plan-subject">
        <div className="plan-subject-head">
          <span className="plan-item-icon" style={{ background: meta.bg }}>
            <span className="material-icons">{meta.icon}</span>
          </span>
          <div className="plan-subject-title">
            <strong>{s.label}</strong>
            <span className={`badge ${statusCls}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="plan-subject-bar">
          <div
            className="plan-subject-fill"
            style={{ width: `${Math.round((s.proficiency || 0) * 1)}%`, background: meta.bg }}
          />
        </div>
        <div className="plan-subject-stats">
          <div><strong>{s.proficiency ?? t('studentSpace.learningPlan.noValue')}</strong><span>{t('studentSpace.learningPlan.masteryPercent')}</span></div>
          <div><strong>{s.assessment?.avgPercent ?? t('studentSpace.learningPlan.noValue')}</strong><span>{t('studentSpace.learningPlan.avgScore')}</span></div>
          <div><strong>{s.lessonsCompleted ?? 0}</strong><span>{t('studentSpace.learningPlan.lessonsCompleted')}</span></div>
          <div><strong>{s.adaptive?.dueNow ?? 0}</strong><span>{t('studentSpace.learningPlan.reviewToday')}</span></div>
          <div><strong>{s.targetDifficulty ?? t('studentSpace.learningPlan.noValue')}</strong><span>{t('studentSpace.learningPlan.targetLevel')}</span></div>
        </div>
        {reasons.length > 0 && (
          <ul className="plan-reasons">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="loading-wrap"><span className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.learningPlan.title')}</h3>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('studentSpace.learningPlan.intro')}
      </p>

      {error && <div className="form-error">{error}</div>}

      {noStudent ? (
        <div className="empty">
          <img src="/owl-mascot.webp" alt="رفيقي" className="owl-img" style={{ width: 56, height: 56 }} />
          <strong>{t('studentSpace.learningPlan.noStudentTitle')}</strong>
          <p className="muted">{t('studentSpace.learningPlan.noStudentBody')}</p>
        </div>
      ) : !plan ? (
        <div className="empty">{t('studentSpace.learningPlan.loadFailed')}</div>
      ) : (
        <>
          <div className={`plan-banner ${{ WEAK: 'bad', MEDIUM: 'warn', STRONG: 'good', NO_DATA: 'neutral' }[plan.overall?.status] || 'neutral'}`}>
            <div className="plan-banner-main">
              <strong>
                {t('studentSpace.learningPlan.learningStatus', {
                  status: plan.overall?.statusLabel || t('studentSpace.learningPlan.noDataLabel')
                })}
              </strong>
              <span>
                {t('studentSpace.learningPlan.overallMastery', { n: plan.overall?.avgPercent ?? '—' })}
                {!plan.overall?.hasData && t('studentSpace.learningPlan.noDataHint')}
              </span>
            </div>
            {plan.overall?.focusAreas?.length > 0 && (
              <div className="plan-focus">
                <span className="muted">{t('studentSpace.learningPlan.focusPriorities')}</span>
                {plan.overall.focusAreas.map((f) => (
                  <span key={f.subjectId} className="badge accent">{f.label}</span>
                ))}
              </div>
            )}
          </div>

          {renderDailyPlan(plan)}

          <div className="plan-section">
            <div className="plan-section-head">
              <h4>{t('studentSpace.learningPlan.subjectsFile')}</h4>
              <span className="badge">{t('studentSpace.learningPlan.subjectsCount', { n: plan.subjects.length })}</span>
            </div>
            <div className="plan-subjects">
              {plan.subjects.map(renderSubject)}
            </div>
          </div>

          {plan.adjustments?.length > 0 && (
            <div className="plan-section">
              <div className="plan-section-head">
                <h4>{t('studentSpace.learningPlan.autoAdjustments')}</h4>
                <span className="badge">{plan.adjustments.length}</span>
              </div>
              <ul className="plan-adjustments">
                {plan.adjustments.map((a, i) => (
                  <li key={i}>
                    {t('studentSpace.learningPlan.adjustmentLine', { label: a.label, from: a.fromLabel || a.from, to: a.toLabel || a.to })}
                    <span className="muted"> — {a.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.reasons?.length > 0 && (
            <div className="plan-section">
              <div className="plan-section-head">
                <h4>{t('studentSpace.learningPlan.whyRecommendations')}</h4>
                <span className="badge">{plan.reasons.length}</span>
              </div>
              <ul className="plan-adjustments">
                {plan.reasons.map((r, i) => (
                  <li key={i} style={{ borderStyle: 'solid' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="plan-section plan-session">
            <div className="plan-section-head">
              <h4>{t('studentSpace.learningPlan.suggestedSession')}</h4>
            </div>
            {!session && (
              <p className="muted">
                {t('studentSpace.learningPlan.suggestedSessionHint')}
              </p>
            )}
            {!session && (
              <button type="button" className="btn btn-primary" onClick={startSession} disabled={sessLoading}>
                {sessLoading ? t('studentSpace.learningPlan.preparing') : t('studentSpace.learningPlan.startSuggestedSession')}
              </button>
            )}

            {session && !current && (
              <div className="empty">
                {session.done
                  ? t('studentSpace.learningPlan.sessionDoneMsg')
                  : t('studentSpace.learningPlan.noQuestionsMsg')}
                {session.done && (
                  <button type="button" className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setSession(null)}>
                    {t('studentSpace.learningPlan.closeSession')}
                  </button>
                )}
              </div>
            )}

            {session && current && (
              <div className="adaptive-session">
                <div className="adaptive-session-head">
                  <span className="badge">{t('studentSpace.learningPlan.questionProgress', { cur: sessIdx + 1, total: session.items.length })}</span>
                  <span className="badge accent">{subjectMeta(current.subjectId, t).label}</span>
                </div>
                <AdaptiveSessionCard
                  item={current}
                  onReviewed={handleReviewed}
                  gradeId={current.gradeId}
                  subjectId={current.subjectId}
                />
                <div className="adaptive-actions">
                  <button type="button" className="btn btn-primary" onClick={next}>
                    {t('studentSpace.learningPlan.next')}
                    <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
