import { Badge, BadgeItem } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return { emoji: '🌙', key: 'night' };
  if (h < 12) return { emoji: '☀️', key: 'morning' };
  if (h < 17) return { emoji: '🌤️', key: 'afternoon' };
  return { emoji: '🌙', key: 'evening' };
}

function ProgressRing({ percent = 0, size = 72, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg className="profile-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-text">{percent}%</text>
    </svg>
  );
}

export default function StudentProfile({ profile, onMenu }) {
  const { t } = useI18n();
  if (!profile) return null;
  const { user, class: cls, badges } = profile;
  const levelProgress = user.xp % 100;
  const greeting = getGreeting();
  const greetingKey = `studentSpace.profile.greeting.${greeting.key}`;

  return (
    <div className="student-profile-card sp-v3">
      {onMenu && (
        <button type="button" className="profile-menu-btn" onClick={onMenu} aria-label={t('studentSpace.menu')}>
          <span className="material-icons">menu</span>
        </button>
      )}

      <div className="sp-v3__left">
        <div className="sp-v3__avatar-wrap">
          <ProgressRing percent={levelProgress} size={48} stroke={5} />
          <div className="sp-v3__avatar">
            <span className="material-icons">person</span>
          </div>
        </div>
      </div>

      <div className="sp-v3__center">
        <p className="sp-v3__greeting">{greeting.emoji} {t(greetingKey, { name: user.firstName })}</p>
        <h3 className="sp-v3__name">{user.firstName} {user.lastName}</h3>
        <p className="sp-v3__class">
          {cls ? `${cls.name}${cls.level ? ` — ${cls.level}` : ''}` : t('studentSpace.profile.noClass')}
        </p>
        <div className="sp-v3__badges">
          {badges && badges.slice(0, 4).map((b) => (
            <BadgeItem key={b.id} badge={b} size="sm" />
          ))}
          {badges && badges.length > 4 && <span className="sp-v3__badge-more">+{badges.length - 4}</span>}
        </div>
      </div>

      <div className="sp-v3__stats">
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#E8A317' }}>star</span>
          <span className="sp-v3__stat-val">{user.level}</span>
          <span className="sp-v3__stat-lbl">{t('studentSpace.profile.levelShort')}</span>
        </div>
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#E8A317' }}>bolt</span>
          <span className="sp-v3__stat-val">{user.xp}</span>
          <span className="sp-v3__stat-lbl">XP</span>
        </div>
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#E8A317' }}>local_fire_department</span>
          <span className="sp-v3__stat-val">{user.streakDays}</span>
          <span className="sp-v3__stat-lbl">{t('studentSpace.profile.streakShort')}</span>
        </div>
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#10b981' }}>payments</span>
          <span className="sp-v3__stat-val">{user.coins}</span>
          <span className="sp-v3__stat-lbl">{t('studentSpace.profile.coinsShort')}</span>
        </div>
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#E8A317' }}>auto_stories</span>
          <span className="sp-v3__stat-val">{profile.stats?.lessonsCompleted || 0}</span>
          <span className="sp-v3__stat-lbl">{t('studentSpace.profile.lessonsShort')}</span>
        </div>
        <div className="sp-v3__stat">
          <span className="material-icons sp-v3__stat-ico" style={{ color: '#E8A317' }}>emoji_events</span>
          <span className="sp-v3__stat-val">{badges?.length || 0}</span>
          <span className="sp-v3__stat-lbl">{t('studentSpace.profile.badgesShort')}</span>
        </div>
      </div>
    </div>
  );
}
