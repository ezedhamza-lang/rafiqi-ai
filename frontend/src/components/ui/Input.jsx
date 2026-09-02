import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, icon, type = 'text', className = '', id, required, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={`ui-field ${error ? 'ui-field-error' : ''}`}>
      {label && (
        <label className="ui-label" htmlFor={inputId}>
          {label}
          {required && <span className="ui-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ui-input-wrap">
        {icon && <span className="material-icons ui-input-icon" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`ui-input ${icon ? 'ui-input-with-icon' : ''} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
      </div>
      {error && (
        <p className="ui-field-error-msg" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="ui-field-hint" id={`${inputId}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;
