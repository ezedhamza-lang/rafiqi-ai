import { Badge, BadgeItem } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function StudentProfile({ profile }) {
  const { t } = useI18n();
  if (!profile) return null;
  const { user, class: cls, badges } = profile;
  const levelProgress = user.xp % 100;

  return (
    <div className="student-profile-card">
      <div className="profile-avatar" aria-hidden="true">
        <span className="material-icons" style={{ fontSize: '3rem', color: '#fff' }}>person</span>
      </div>
      <div className="profile-info">
        <h3>{user.firstName} {user.lastName}</h3>
        <p className="sub">{cls ? `${cls.name} — ${t(`studentSpace.profile.levels.${cls.level}`)}` : t('studentSpace.profile.noClass')}</p>
        <div className="profile-xp">
          <span className="xp-badge">{t('studentSpace.profile.level', { n: user.level })}</span>
          <span className="xp-badge">{t('studentSpace.profile.xp', { n: user.xp })}</span>
          <span className="xp-badge">{t('studentSpace.profile.coins', { n: user.coins })}</span>
          <span className="xp-badge">{t('studentSpace.profile.streak', { n: user.streakDays })}</span>
          <span className="xp-badge">{t('studentSpace.profile.lessonsCompleted', { n: profile.stats?.lessonsCompleted || 0 })}</span>
          <Badge variant="accent" icon="emoji_events">
            {t('studentSpace.profile.badgesCount', { n: badges?.length || 0 })}
          </Badge>
        </div>
        <div className="progress" style={{ maxWidth: 300 }}>
          <div
            className="progress-bar good"
            style={{ width: `${levelProgress}%` }}
            role="progressbar"
            aria-valuenow={levelProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('studentSpace.profile.levelProgressAria', { n: levelProgress })}
          />
        </div>
        {badges && badges.length > 0 && (
          <div className="badges-row" style={{ marginTop: '0.8rem' }}>
            {badges.slice(0, 5).map((b) => (
              <BadgeItem key={b.id} badge={b} size="sm" />
            ))}
            {badges.length > 5 && (
              <span className="xp-badge">+{badges.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
