export default function EmptyState({ icon = 'inbox', title = 'لا توجد بيانات', description, action }) {
  return (
    <div className="ui-empty-state">
      <span className="material-icons ui-empty-state-icon" aria-hidden="true">{icon}</span>
      <p className="ui-empty-state-title">{title}</p>
      {description && <p className="ui-empty-state-desc">{description}</p>}
      {action && <div className="ui-empty-state-action">{action}</div>}
    </div>
  );
}
