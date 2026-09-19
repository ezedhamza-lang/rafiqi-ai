import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const SUBJECT_META = {
  ar: { label: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', color: '#E8A317', emoji: 'ðŸ“–' },
  arabic: { label: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', color: '#E8A317', emoji: 'ðŸ“–' },
  fr: { label: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', color: '#3b82f6', emoji: 'ðŸ‡«ðŸ‡·' },
  french: { label: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', color: '#3b82f6', emoji: 'ðŸ‡«ðŸ‡·' },
  en: { label: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', color: '#10b981', emoji: 'ðŸ‡¬ðŸ‡§' },
  english: { label: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', color: '#10b981', emoji: 'ðŸ‡¬ðŸ‡§' },
  math: { label: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', color: '#E8A317', emoji: 'ðŸ”¢' },
  maths: { label: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', color: '#E8A317', emoji: 'ðŸ”¢' },
  science: { label: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', color: '#8b5cf6', emoji: 'ðŸ”¬' },
  ev: { label: 'Ø§Ù„ØªØ±Ø¨ÙŠØ© Ø§Ù„Ù…Ø¯Ù†ÙŠØ©', color: '#ec4899', emoji: 'ðŸ›ï¸' },
  pe: { label: 'Ø§Ù„ØªØ±Ø¨ÙŠØ© Ø§Ù„Ø¨Ø¯Ù†ÙŠØ©', color: '#ef4444', emoji: 'âš½' },
  history: { label: 'Ø§Ù„ØªØ§Ø±ÙŠØ®', color: '#92400e', emoji: 'ðŸ“œ' },
  geography: { label: 'Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§', color: '#06b6d4', emoji: 'ðŸŒ' },
  tajweed: { label: 'Ø§Ù„ØªÙ„Ø§ÙˆØ©', color: '#059669', emoji: 'ðŸ•Œ' },
  islamic: { label: 'Ø§Ù„ØªØ±Ø¨ÙŠØ© Ø§Ù„Ø¥Ø³Ù„Ø§Ù…ÙŠØ©', color: '#047857', emoji: 'â˜ªï¸' },
  art: { label: 'Ø§Ù„ØªØ±Ø¨ÙŠØ© Ø§Ù„ØªØ´ÙƒÙŠÙ„ÙŠØ©', color: '#d946ef', emoji: 'ðŸŽ¨' },
  music: { label: 'Ø§Ù„ØªØ±Ø¨ÙŠØ© Ø§Ù„Ù…ÙˆØ³ÙŠÙ‚ÙŠØ©', color: '#f472b6', emoji: 'ðŸŽµ' },
  computer: { label: 'Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ©', color: '#6366f1', emoji: 'ðŸ’»' },
  tech: { label: 'Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§', color: '#4f46e5', emoji: 'âš™ï¸' },
};

function getSubjectMeta(id) {
  if (!id) return { label: 'â€”', color: '#94a3b8', emoji: 'ðŸ“š' };
  const lower = id.toLowerCase().replace('subject_', '');
  return SUBJECT_META[lower] || SUBJECT_META[lower.split('_')[0]] || { label: id, color: '#94a3b8', emoji: 'ðŸ“š' };
}

const MILESTONES = [
  { xp: 10, label: 'Ø¨Ø¯Ø§ÙŠØ©', emoji: 'ðŸŒ±' },
  { xp: 50, label: 'Ù…Ø³Ø§Ø± Ø¬ÙŠØ¯', emoji: 'ðŸŒ¿' },
  { xp: 100, label: 'Ø§Ù„Ù…Ø³ØªÙˆÙ‰ 2', emoji: 'â­' },
  { xp: 250, label: 'Ø·Ø§Ù„Ø¨ Ù…Ø¬ØªÙ‡Ø¯', emoji: 'ðŸ“š' },
  { xp: 500, label: 'Ù†Ø¬Ù…', emoji: 'ðŸŒŸ' },
  { xp: 1000, label: 'Ù…ØªÙÙˆÙ‚', emoji: 'ðŸ†' },
  { xp: 2000, label: 'Ø¹Ø¨Ù‚Ø±ÙŠ', emoji: 'ðŸ’Ž' },
  { xp: 5000, label: 'Ø£Ø³Ø·ÙˆØ±ÙŠ', emoji: 'ðŸ‘‘' },
];

export default function StudentProgress() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/student/dashboard'),
      api.get('/student/progress/lessons')
    ]).then(([dashboard, progress]) => {
      setData({ ...dashboard, lessonProgress: progress?.lessons || [] });
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="ds-loading"><div className="ds-spinner" /><p>{t('common.loading')}</p></div>;
  if (!data) return <div className="ds-empty">{t('common.noData')}</div>;

  const { user, subjectProgress, stats, levelProgress, badges } = data;
  const totalAllLessons = subjectProgress.reduce((a, s) => a + s.count, 0) || 1;

  const currentMilestone = MILESTONES.filter(m => user.xp >= m.xp).pop() || MILESTONES[0];
  const nextMilestone = MILESTONES.find(m => user.xp < m.xp);
  const milestonePercent = nextMilestone
    ? Math.min(100, Math.round(((user.xp - currentMilestone.xp) / (nextMilestone.xp - currentMilestone.xp)) * 100))
    : 100;

  return (
    <div className="student-progress">
      <div className="pg-header" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
        <span className="material-icons pg-header__icon">trending_up</span>
        <div>
          <h2 className="pg-header__title">{t('studentSpace.progress.title')}</h2>
          <p className="pg-header__sub">{t('studentSpace.progress.subtitle')}</p>
        </div>
      </div>

      <div className="pg-body">
        <div className="pg-milestone">
          <div className="pg-milestone__current">
            <span className="pg-milestone__emoji">{currentMilestone.emoji}</span>
            <div>
              <span className="pg-milestone__label">{currentMilestone.label}</span>
              <span className="pg-milestone__xp">{user.xp} XP</span>
            </div>
          </div>
          {nextMilestone && (
            <div className="pg-milestone__next">
              <div className="pg-milestone__bar-wrap">
                <div className="pg-milestone__bar" style={{ width: `${milestonePercent}%` }} />
              </div>
              <span className="pg-milestone__next-label">
                {nextMilestone.emoji} {nextMilestone.label} ({nextMilestone.xp - user.xp} XP {t('studentSpace.progress.remaining')})
              </span>
            </div>
          )}
        </div>

        <div className="pg-summary-row">
          <div className="pg-summary-card">
            <span className="material-icons" style={{ color: '#3b82f6' }}>auto_stories</span>
            <span className="pg-summary-card__val">{stats.totalLessons}</span>
            <span className="pg-summary-card__lbl">{t('studentSpace.profile.lessonsShort')}</span>
          </div>
          <div className="pg-summary-card">
            <span className="material-icons" style={{ color: '#10b981' }}>quiz</span>
            <span className="pg-summary-card__val">{stats.totalQuizzes}</span>
            <span className="pg-summary-card__lbl">{t('studentSpace.tabs.quizzes')}</span>
          </div>
          <div className="pg-summary-card">
            <span className="material-icons" style={{ color: '#E8A317' }}>sports_esports</span>
            <span className="pg-summary-card__val">{stats.totalGames}</span>
            <span className="pg-summary-card__lbl">{t('studentSpace.tabs.play')}</span>
          </div>
          <div className="pg-summary-card">
            <span className="material-icons" style={{ color: '#8b5cf6' }}>emoji_events</span>
            <span className="pg-summary-card__val">{badges?.length || 0}</span>
            <span className="pg-summary-card__lbl">{t('studentSpace.profile.badgesShort')}</span>
          </div>
        </div>

        <div className="pg-section">
          <h3 className="pg-section__title">
            <span className="material-icons">menu_book</span>
            {t('studentSpace.progress.subjectProgress')}
          </h3>
          {subjectProgress.length === 0 ? (
            <p className="pg-empty">{t('studentSpace.progress.noData')}</p>
          ) : (
            <div className="pg-subjects">
              {subjectProgress.sort((a, b) => b.count - a.count).map((s, i) => {
                const meta = getSubjectMeta(s.subjectId);
                const pct = Math.min(100, Math.round((s.count / Math.max(totalAllLessons * 2, 1)) * 100));
                return (
                  <div key={s.subjectId + i} className="pg-subject-card">
                    <div className="pg-subject-card__head">
                      <span className="pg-subject-card__emoji">{meta.emoji}</span>
                      <span className="pg-subject-card__name">{meta.label}</span>
                      <span className="pg-subject-card__count">{s.count} {t('studentSpace.progress.lessonsDone')}</span>
                    </div>
                    <div className="pg-subject-card__bar-wrap">
                      <div className="pg-subject-card__bar" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                    <span className="pg-subject-card__pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pg-section">
          <h3 className="pg-section__title">
            <span className="material-icons">emoji_events</span>
            {t('studentSpace.progress.milestones')}
          </h3>
          <div className="pg-milestones-grid">
            {MILESTONES.map((m, i) => {
              const reached = user.xp >= m.xp;
              return (
                <div key={i} className={`pg-milestone-chip ${reached ? 'pg-milestone-chip--reached' : ''}`}>
                  <span className="pg-milestone-chip__emoji">{m.emoji}</span>
                  <span className="pg-milestone-chip__label">{m.label}</span>
                  <span className="pg-milestone-chip__xp">{m.xp} XP</span>
                  {reached && <span className="pg-milestone-chip__check">âœ“</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
