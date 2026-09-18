import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const BADGE_CONDITIONS_AR = {
  QUIZ_COUNT: (v) => `${v} اختبارات`,
  XP_TOTAL: (v) => `${v} نقطة خبرة`,
  STREAK_DAYS: (v) => `${v} أيام متتالية`,
  PERFECT_SCORE: (v) => `${v} علامة ممتازة`,
  LESSONS_COMPLETED: (v) => `${v} دروس مكتملة`
};

function LevelProgressBar({ progress, level }) {
  return (
    <div className="rw-level-bar">
      <div className="rw-level-bar__header">
        <span className="rw-level-bar__label">⭐ {level}</span>
        <span className="rw-level-bar__pct">{progress}%</span>
      </div>
      <div className="rw-level-bar__track">
        <div className="rw-level-bar__fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="rw-level-bar__sub">
        <span>{progress} / 100 XP</span>
      </div>
    </div>
  );
}

function BadgeCard({ badge, index }) {
  return (
    <div className={`rw-badge ${badge.earned ? 'rw-badge--earned' : 'rw-badge--locked'}`}
         style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="rw-badge__icon">{badge.icon}</div>
      <div className="rw-badge__info">
        <span className="rw-badge__name">{badge.name}</span>
        <span className="rw-badge__desc">{badge.description}</span>
        {badge.earned && badge.earnedAt && (
          <span className="rw-badge__date">
            {new Date(badge.earnedAt).toLocaleDateString('ar-TN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        {!badge.earned && (
          <span className="rw-badge__condition">
            {BADGE_CONDITIONS_AR[badge.condition?.type]?.(badge.condition?.value) || badge.condition?.type}
          </span>
        )}
      </div>
      {badge.earned && <span className="rw-badge__check">✓</span>}
    </div>
  );
}

export default function StudentRewards() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/rewards')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-loading"><div className="ds-spinner" /><p>{t('common.loading')}</p></div>;
  if (!data) return <div className="ds-empty">{t('common.noData')}</div>;

  const earned = data.badges.filter(b => b.earned);
  const locked = data.badges.filter(b => !b.earned);

  return (
    <div className="student-rewards">
      <div className="rw-header" style={{ background: 'linear-gradient(135deg, #f59e0b, #ff6a00)' }}>
        <div className="rw-header__stats">
          <div className="rw-header__stat">
            <span className="material-icons">bolt</span>
            <div>
              <span className="rw-header__stat-val">{data.xp}</span>
              <span className="rw-header__stat-lbl">XP</span>
            </div>
          </div>
          <div className="rw-header__stat">
            <span className="material-icons">payments</span>
            <div>
              <span className="rw-header__stat-val">{data.coins}</span>
              <span className="rw-header__stat-lbl">{t('studentSpace.profile.coinsShort')}</span>
            </div>
          </div>
          <div className="rw-header__stat">
            <span className="material-icons">local_fire_department</span>
            <div>
              <span className="rw-header__stat-val">{data.streakDays}</span>
              <span className="rw-header__stat-lbl">{t('studentSpace.profile.streakShort')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rw-body">
        <LevelProgressBar progress={data.levelProgress} level={data.level} />

        <div className="rw-summary">
          <span className="material-icons rw-summary__icon">emoji_events</span>
          <span className="rw-summary__text">
            {t('studentSpace.rewards.earnedOf', { earned: data.totalEarned, total: data.totalBadges })}
          </span>
        </div>

        {earned.length > 0 && (
          <div className="rw-section">
            <h3 className="rw-section__title">
              <span className="material-icons" style={{ color: '#10b981' }}>check_circle</span>
              {t('studentSpace.rewards.earned')}
            </h3>
            <div className="rw-badges-grid">
              {earned.map((b, i) => <BadgeCard key={b.id} badge={b} index={i} />)}
            </div>
          </div>
        )}

        {locked.length > 0 && (
          <div className="rw-section">
            <h3 className="rw-section__title">
              <span className="material-icons" style={{ color: '#94a3b8' }}>lock</span>
              {t('studentSpace.rewards.locked')}
            </h3>
            <div className="rw-badges-grid">
              {locked.map((b, i) => <BadgeCard key={b.id} badge={b} index={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
