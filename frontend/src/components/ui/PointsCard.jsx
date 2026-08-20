export default function PointsCard({ icon = 'emoji_events', label, value, color = 'accent', sub, className = '' }) {
  return (
    <div className={`ui-points-card ui-points-${color} ${className}`}>
      <span className="material-icons ui-points-icon" aria-hidden="true">{icon}</span>
      <div className="ui-points-info">
        <span className="ui-points-label">{label}</span>
        <strong className="ui-points-value">{value}</strong>
        {sub && <span className="ui-points-sub">{sub}</span>}
      </div>
    </div>
  );
}
