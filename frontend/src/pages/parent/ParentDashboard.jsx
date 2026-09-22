import { useI18n } from '../../i18n/index.jsx';

const BADGE_EMOJIS = ['⭐','🏆','🌟','🎯','📚','🔥','💪','🦁','🎓','👑'];

export default function ParentDashboard({ childrenData }) {
  const { t } = useI18n();
  const summaries = (childrenData || []).map(({ student, progress }) => ({
    child: student,
    dash: progress
  }));

  if (!childrenData?.length) {
    return (
      <div className="pd-page">
        <div className="pd-empty">
          <span className="material-icons" style={{ fontSize: '3rem', color: 'var(--muted)' }}>family_restroom</span>
          <p>{t('parentSpace.dashboard.noChildren', 'لا يوجد أطفال مرتبطين بحسابك')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-page">
      <h2 className="pd-title">
        <span className="material-icons">dashboard</span>
        {t('parentSpace.dashboard.title', 'نظرة عامة على الأبناء')}
      </h2>

      <div className="pd-grid">
        {summaries.map(({ child, dash }) => (
          <ChildCard key={child.id} child={child} dash={dash} t={t} />
        ))}
      </div>

      <div className="pd-tips">
        <h3 className="pd-tips__title">
          <span className="material-icons">tips_and_updates</span>
          {t('parentSpace.dashboard.tips', 'نصائح للأهل')}
        </h3>
        <div className="pd-tips__grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="pd-tip">
              <span className="material-icons pd-tip__icon">{['menu_book', 'track_changes', 'emoji_events', 'bedtime'][i - 1]}</span>
              <div>
                <strong className="pd-tip__title">{t(`parentSpace.dashboard.tip${i}t`)}</strong>
                <p className="pd-tip__desc">{t(`parentSpace.dashboard.tip${i}d`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChildCard({ child, dash, t }) {
  const xp = dash?.xp || 0;
  const coins = dash?.coins || 0;
  const level = dash?.level || child.level || 1;
  const streak = dash?.streakDays || 0;
  const badges = dash?.badges || [];
  const recentActivity = dash?.activities || [];
  const subjectProgress = dash?.subjectProgress || [];

  return (
    <div className="pd-card">
      <div className="pd-card__header">
        <div className="pd-card__avatar">
          {child.firstName?.[0]}{child.lastName?.[0]}
        </div>
        <div>
          <h3 className="pd-card__name">{child.firstName} {child.lastName}</h3>
          <span className="pd-card__level">
            {t('studentSpace.dashboard.level', 'المستوى')} {level}
          </span>
        </div>
      </div>

      <div className="pd-card__stats">
        <div className="pd-stat">
          <span className="material-icons pd-stat__icon" style={{ color: '#E8A317' }}>star</span>
          <span className="pd-stat__value">{xp}</span>
          <span className="pd-stat__label">XP</span>
        </div>
        <div className="pd-stat">
          <span className="material-icons pd-stat__icon" style={{ color: '#10B981' }}>payments</span>
          <span className="pd-stat__value">{coins}</span>
          <span className="pd-stat__label">{t('studentSpace.profile.coinsShort')}</span>
        </div>
        <div className="pd-stat">
          <span className="material-icons pd-stat__icon" style={{ color: '#E8A317' }}>local_fire_department</span>
          <span className="pd-stat__value">{streak}</span>
          <span className="pd-stat__label">{t('studentSpace.profile.streakShort')}</span>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="pd-card__section">
          <h4 className="pd-card__section-title">{t('parentSpace.dashboard.badges', 'الشارات')}</h4>
          <div className="pd-badges">
            {badges.slice(0, 5).map((b, i) => (
              <span key={i} className="pd-badge" title={b.name}>
                {BADGE_EMOJIS[i % BADGE_EMOJIS.length]}
              </span>
            ))}
          </div>
        </div>
      )}

      {subjectProgress.length > 0 && (
        <div className="pd-card__section">
          <h4 className="pd-card__section-title">{t('parentSpace.dashboard.progress', 'التقدم الدراسي')}</h4>
          <div className="pd-subjects">
            {subjectProgress.slice(0, 4).map((sp, i) => (
              <div key={i} className="pd-subject">
                <span className="pd-subject__name">{sp.name}</span>
                <div className="pd-subject__bar">
                  <div className="pd-subject__fill" style={{ width: `${Math.min(100, sp.percent || 0)}%` }} />
                </div>
                <span className="pd-subject__pct">{sp.percent || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div className="pd-card__section">
          <h4 className="pd-card__section-title">{t('parentSpace.dashboard.recent', 'النشاط الأخير')}</h4>
          <ul className="pd-activity">
            {recentActivity.slice(0, 3).map((a, i) => (
              <li key={i} className="pd-activity__item">
                <span className="material-icons pd-activity__icon" style={{ fontSize: '0.9rem' }}>
                  {a.type === 'lesson' ? 'menu_book' : a.type === 'quiz' ? 'quiz' : 'star'}
                </span>
                <span className="pd-activity__text">{a.description || a.detail || a.title || 'نشاط'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

