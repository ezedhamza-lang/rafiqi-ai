const VARIANTS = {
  default: 'ui-badge-default',
  primary: 'ui-badge-primary',
  success: 'ui-badge-success',
  danger: 'ui-badge-danger',
  warning: 'ui-badge-warning',
  info: 'ui-badge-info',
  accent: 'ui-badge-accent'
};

export default function Badge({ variant = 'default', icon, children, className = '', ...rest }) {
  return (
    <span className={`ui-badge ${VARIANTS[variant] || VARIANTS.default} ${className}`} {...rest}>
      {icon && <span className="material-icons ui-badge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
