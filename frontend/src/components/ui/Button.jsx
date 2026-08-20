import { forwardRef } from 'react';

const VARIANTS = {
  primary: 'ui-btn-primary',
  accent: 'ui-btn-accent',
  outline: 'ui-btn-outline',
  ghost: 'ui-btn-ghost',
  danger: 'ui-btn-danger',
  success: 'ui-btn-success',
  subtle: 'ui-btn-subtle'
};

const SIZES = {
  sm: 'ui-btn-sm',
  md: 'ui-btn-md',
  lg: 'ui-btn-lg',
  block: 'ui-btn-block'
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon, loading = false, disabled, block = false, className = '', children, ...rest },
  ref
) {
  const classes = ['ui-btn', VARIANTS[variant] || VARIANTS.primary, SIZES[size] || SIZES.md, block && SIZES.block, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="ui-btn-spinner" aria-hidden="true" />
      ) : (
        icon && <span className="material-icons ui-btn-icon" aria-hidden="true">{icon}</span>
      )}
      {children}
    </button>
  );
});

export default Button;
