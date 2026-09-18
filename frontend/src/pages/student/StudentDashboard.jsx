import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const SUBJECT_LABELS = {
  'ar': 'العربية', 'fr': 'الفرنسية', 'en': 'الإنجليزية', 'math': 'الرياضيات',
  'science': 'العلوم', 'ev': 'التربية المدنية', 'pe': 'التربية البدنية',
  'history': 'التاريخ', 'geography': 'الجغرافيا', 'tajweed': 'التلاوة',
  'islamic': 'التربية الإسلامية', 'art': 'التربية التشكيلية', 'music': 'التربية الموسيقية',
  'computer': 'المعلوماتية', 'tech': 'التكنولوجيا', 'french': 'الفرنسية',
  'english': 'الإنجليزية', 'arabic': 'العربية', 'maths': 'الرياضيات'
};

function getSubjectLabel(id) {
  if (!id) return '—';
  const lower = id.toLowerCase();
  return SUBJECT_LABELS[lower] || SUBJECT_LABELS[lower.replace('subject_', '')] || id;
}

const SUBJECT_COLORS = ['#ff6a00', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

function getGreetingTime() {
  const h = new Date().getHours();
  if (h < 6) return { emoji: '🌙', key: 'night' };
  if (h < 12) return { emoji: '☀️', key: 'morning' };
  if (h < 17) return { emoji: '🌤️', key: 'afternoon' };
  return { emoji: '🌙', key: 'evening' };
}

function ProgressRing({ percent = 0, size = 120, stroke = 10, color = '#ff6a00' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke="rgba(255,255,255,0.15)" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
        stroke={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size * 0.2} fontWeight="bold" style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {percent}%
      </text>
    </svg>
  );
}

function MiniStatCard({ icon, value, label, color }) {
  return (
    <div className="ds-mini-stat" style={{ borderLeftColor: color }}>
      <span className="material-icons ds-mini-stat__icon" style={{ color }}>{icon}</span>
      <div className="ds-mini-stat__text">
        <span className="ds-mini-stat__value">{value}</span>
        <span className="ds-mini-stat__label">{label}</span>
      </div>
    </div>
  );
}

function ActivityIcon({ type }) {
  const map = {
    LESSON: 'auto_stories', QUIZ: 'quiz', ASSIGNMENT: 'assignment',
    GAME: 'sports_esports', LESSON_SUBMITTED: 'send', DEFAULT: 'bolt'
  };
  return <span className="material-icons">{map[type] || map.DEFAULT}</span>;
}

export default function StudentDashboard() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/dashboard')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="ds-loading">
        <div className="ds-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="ds-empty">{t('common.noData')}</div>;
  }

  const greeting = getGreetingTime();
  const greetingKey = `studentSpace.profile.greeting.${greeting.key}`;
  const { user, subjectProgress, stats, levelProgress, badges, recentActivity } = data;

  const totalLessonsAll = subjectProgress.reduce((a, s) => a + s.count, 0) || 1;
  const overallPercent = Math.min(100, Math.round((stats.totalLessons / Math.max(totalLessonsAll * 3, 1)) * 100));

  return (
    <div className="student-dashboard">
      <div className="ds-hero" style={{ background: 'linear-gradient(135deg, #ff6a00, #f59e0b)' }}>
        <div className="ds-hero__left">
          <h2 className="ds-hero__greeting">{greeting.emoji} {t(greetingKey, { name: user.firstName })}</h2>
          <p className="ds-hero__sub">
            {t('studentSpace.dashboard.level', { n: user.level })}
          </p>
        </div>
        <div className="ds-hero__ring">
          <ProgressRing percent={levelProgress} color="#fff" />
          <span className="ds-hero__ring-label">{t('studentSpace.dashboard.nextLevel')}</span>
        </div>
      </div>

      <div className="ds-stats-grid">
        <MiniStatCard icon="bolt" value={user.xp} label="XP" color="#f59e0b" />
        <MiniStatCard icon="payments" value={user.coins} label={t('studentSpace.profile.coinsShort')} color="#10b981" />
        <MiniStatCard icon="local_fire_department" value={user.streakDays} label={t('studentSpace.profile.streakShort')} color="#ef4444" />
        <MiniStatCard icon="emoji_events" value={badges?.length || 0} label={t('studentSpace.profile.badgesShort')} color="#8b5cf6" />
        <MiniStatCard icon="auto_stories" value={stats.totalLessons} label={t('studentSpace.profile.lessonsShort')} color="#ff6a00" />
        <MiniStatCard icon="quiz" value={stats.totalQuizzes} label={t('studentSpace.tabs.quizzes')} color="#3b82f6" />
      </div>

      <div className="ds-section">
        <h3 className="ds-section__title">
          <span className="material-icons">today</span>
          {t('studentSpace.dashboard.todayActivity')}
        </h3>
        <div className="ds-today-grid">
          <div className="ds-today-card">
            <span className="material-icons" style={{ color: '#ff6a00' }}>auto_stories</span>
            <span className="ds-today-card__num">{stats.today.lessons}</span>
            <span className="ds-today-card__lbl">{t('studentSpace.profile.lessonsShort')}</span>
          </div>
          <div className="ds-today-card">
            <span className="material-icons" style={{ color: '#3b82f6' }}>quiz</span>
            <span className="ds-today-card__num">{stats.today.quizzes}</span>
            <span className="ds-today-card__lbl">{t('studentSpace.tabs.quizzes')}</span>
          </div>
          <div className="ds-today-card">
            <span className="material-icons" style={{ color: '#10b981' }}>sports_esports</span>
            <span className="ds-today-card__num">{stats.today.games}</span>
            <span className="ds-today-card__lbl">{t('studentSpace.tabs.play')}</span>
          </div>
        </div>
      </div>

      {subjectProgress.length > 0 && (
        <div className="ds-section">
          <h3 className="ds-section__title">
            <span className="material-icons">menu_book</span>
            {t('studentSpace.dashboard.subjectProgress')}
          </h3>
          <div className="ds-subjects">
            {subjectProgress.slice(0, 8).map((s, i) => {
              const pct = Math.min(100, Math.round((s.count / Math.max(totalLessonsAll, 1)) * 100));
              return (
                <div key={s.subjectId} className="ds-subject-row">
                  <div className="ds-subject-row__info">
                    <span className="ds-subject-row__dot" style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                    <span className="ds-subject-row__name">{getSubjectLabel(s.subjectId)}</span>
                    <span className="ds-subject-row__count">{s.count} {t('studentSpace.dashboard.lessonsDone')}</span>
                  </div>
                  <div className="ds-subject-row__bar-wrap">
                    <div className="ds-subject-row__bar" style={{ width: `${pct}%`, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentActivity && recentActivity.length > 0 && (
        <div className="ds-section">
          <h3 className="ds-section__title">
            <span className="material-icons">history</span>
            {t('studentSpace.dashboard.recentActivity')}
          </h3>
          <div className="ds-activity-list">
            {recentActivity.slice(0, 8).map((a, i) => (
              <div key={i} className="ds-activity-row">
                <div className="ds-activity-row__icon">
                  <ActivityIcon type={a.type} />
                </div>
                <div className="ds-activity-row__text">
                  <span className="ds-activity-row__detail">{a.detail || a.type}</span>
                  <span className="ds-activity-row__time">
                    {new Date(a.createdAt).toLocaleDateString('ar-TN', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <span className="ds-activity-row__points" style={{ color: '#10b981' }}>+{a.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {badges && badges.length > 0 && (
        <div className="ds-section">
          <h3 className="ds-section__title">
            <span className="material-icons">emoji_events</span>
            {t('studentSpace.dashboard.myBadges')}
          </h3>
          <div className="ds-badges-row">
            {badges.map((b, i) => (
              <div key={i} className="ds-badge-chip">
                <span className="ds-badge-chip__icon">{b.icon || '⭐'}</span>
                <span className="ds-badge-chip__name">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
