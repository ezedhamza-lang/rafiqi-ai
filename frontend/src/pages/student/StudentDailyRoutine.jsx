import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function StudentDailyRoutine() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/student/daily-routine')
      .then(setRoutine)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">{t('common.loading')}</div>;
  if (!routine) return <div className="muted">{t('common.noData')}</div>;

  const { pendingAssignments, dueReviews, challenge, recommended } = routine;

  return (
    <div className="routine-page">
      <div className="routine-grid">
        <section className="card routine-card">
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #0e6b4f, #17a076)' }}>
            <span className="material-icons">flag</span>
            <h3>{t('studentSpace.routine.challengeTitle')}</h3>
          </div>
          <div className="card-body">
            {challenge?.goals.map((g) => (
              <div key={g.key} className="routine-goal">
                <span className={`material-icons ${g.done >= g.target ? 'done' : ''}`}>
                  {g.done >= g.target ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span>{g.label}</span>
                <span className="goal-count">{Math.min(g.done, g.target)}/{g.target}</span>
              </div>
            ))}
            <p className="routine-xp">
              {t('studentSpace.routine.challengeDone')}: {challenge?.completed ? '✅' : '⏳'} ({t('studentSpace.routine.xpReward', { n: challenge?.xpReward || 0 })})
            </p>
          </div>
        </section>

        <section className="card routine-card">
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #b06b00, #fd8b15)' }}>
            <span className="material-icons">assignment</span>
            <h3>{t('studentSpace.routine.assignmentsTitle')}</h3>
          </div>
          <div className="card-body">
            {pendingAssignments.length === 0 && <p className="muted">{t('studentSpace.routine.noAssignments')}</p>}
            {pendingAssignments.map((a) => (
              <div key={a.id} className="routine-goal">
                <span className="material-icons">event</span>
                <span>{a.title}</span>
                <span className="muted small">
                  {a.questionsCount} {t('studentSpace.routine.questions')} — {new Date(a.dueDate).toLocaleDateString('ar-TN')}
                </span>
              </div>
            ))}
            {dueReviews > 0 && (
              <p className="routine-xp">
                <span className="material-icons">psychology</span>
                {t('studentSpace.routine.dueReviews', { n: dueReviews })}
              </p>
            )}
          </div>
        </section>

        <section className="card routine-card">
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #233863, #2f4a7d)' }}>
            <span className="material-icons">route</span>
            <h3>{t('studentSpace.routine.recommendedTitle')}</h3>
          </div>
          <div className="card-body">
            {recommended ? (
              <>
                <p className="routine-xp">
                  <strong>{recommended.subjectTitle}</strong> — {recommended.lessonTitle}
                </p>
                <p className="muted small">
                  {t('studentSpace.routine.exerciseCount', { n: recommended.exerciseCount })}
                </p>
                <a className="btn btn-primary btn-sm" href="/student-space/plan">
                  {t('studentSpace.routine.goToPlan')}
                </a>
              </>
            ) : (
              <p className="muted">{t('studentSpace.routine.noRecommendation')}</p>
            )}
          </div>
        </section>

        <section className="card routine-card">
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #6b3fa0, #9d6bdc)' }}>
            <span className="material-icons">style</span>
            <h3>{t('studentSpace.routine.flashcardsTitle')}</h3>
          </div>
          <div className="card-body">
            <p className="muted">{t('studentSpace.routine.flashcardsHint')}</p>
            <a className="btn btn-secondary btn-sm" href="/student-space/flashcards">
              {t('studentSpace.routine.goToFlashcards')}
            </a>
          </div>
        </section>
      </div>
      <p className="muted small greeting">👋 {t('studentSpace.routine.greeting', { name: user?.firstName || '' })}</p>
    </div>
  );
}