import { forwardRef, useId } from 'react';

const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className = '', id, required, children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className={`ui-field ${error ? 'ui-field-error' : ''}`}>
      {label && (
        <label className="ui-label" htmlFor={selectId}>
          {label}
          {required && <span className="ui-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ui-select-wrap">
        <select
          ref={ref}
          id={selectId}
          className={`ui-select ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {children ||
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>
        <span className="material-icons ui-select-caret" aria-hidden="true">expand_more</span>
      </div>
      {error && (
        <p className="ui-field-error-msg" id={`${selectId}-error`} role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="ui-field-hint" id={`${selectId}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
});

export default Select;
