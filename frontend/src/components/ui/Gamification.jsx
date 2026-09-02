import Badge from './Badge.jsx';

const RANK_CLASSES = { 1: 'ui-rank-gold', 2: 'ui-rank-silver', 3: 'ui-rank-bronze' };

export default function BadgeItem({ badge, size = 'md', locked = false }) {
  return (
    <div className={`ui-badge-item ui-badge-size-${size} ${locked ? 'ui-badge-locked' : ''}`} title={badge?.description}>
      <span className="ui-badge-icon" role="img" aria-label={badge?.name}>
        {locked ? '🔒' : badge?.icon}
      </span>
      <span className="ui-badge-name">{badge?.name}</span>
    </div>
  );
}

export function LeaderboardRow({ rank, name, points, avatar, current = false, className = '' }) {
  const rankClass = RANK_CLASSES[rank] || '';
  return (
    <div className={`ui-leaderboard-row ${current ? 'ui-leaderboard-current' : ''} ${className}`}>
      <span className={`ui-rank-badge ${rankClass}`} aria-label={`المرتبة ${rank}`}>
        {rank <= 3 ? rank : '#' + rank}
      </span>
      {avatar && <span className="ui-leaderboard-avatar">{avatar}</span>}
      <span className="ui-leaderboard-name">{name}</span>
      <span className="ui-leaderboard-points">
        <span className="material-icons" aria-hidden="true">bolt</span>
        {points}
      </span>
    </div>
  );
}

export function Leaderboard({ title = 'لوحة الترتيب', icon = 'leaderboard', rows = [], emptyText = 'لا توجد نتائج بعد' }) {
  return (
    <div className="ui-leaderboard">
      <div className="ui-leaderboard-head">
        <span className="material-icons" aria-hidden="true">{icon}</span>
        <h4>{title}</h4>
      </div>
      {rows.length === 0 ? (
        <div className="ui-empty-state">
          <span className="material-icons" aria-hidden="true">trophy</span>
          <p>{emptyText}</p>
        </div>
      ) : (
        rows.map((r, i) => (
          <LeaderboardRow
            key={r.id ?? i}
            rank={r.rank ?? i + 1}
            name={r.name}
            points={r.points}
            avatar={r.avatar}
            current={r.current}
          />
        ))
      )}
    </div>
  );
}

export function BadgeCard({ badge, locked = false }) {
  return (
    <div className={`ui-badge-card ${locked ? 'ui-badge-locked' : ''}`}>
      <span className="ui-badge-icon" role="img" aria-label={badge?.name}>
        {locked ? '🔒' : badge?.icon}
      </span>
      <span className="ui-badge-name">{badge?.name}</span>
      {badge?.description && <span className="ui-badge-desc">{badge.description}</span>}
      <Badge variant={locked ? 'default' : 'accent'}>{locked ? 'غير مكتسبة' : 'مكتسبة'}</Badge>
    </div>
  );
}
