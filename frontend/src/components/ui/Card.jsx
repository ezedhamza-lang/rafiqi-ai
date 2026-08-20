export default function Card({ title, subtitle, icon, actions, children, className = '', onClick, hoverable = true, ...rest }) {
  const classes = ['ui-card', hoverable ? 'ui-card-hover' : '', className].filter(Boolean).join(' ');
  return (
    <div className={classes} onClick={onClick} {...rest}>
      {(title || actions) && (
        <div className="ui-card-head">
          <div className="ui-card-title-wrap">
            {icon && <span className="material-icons ui-card-icon" aria-hidden="true">{icon}</span>}
            <div>
              {title && <h3 className="ui-card-title">{title}</h3>}
              {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="ui-card-actions">{actions}</div>}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  );
}
