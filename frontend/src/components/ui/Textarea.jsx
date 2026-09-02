import { forwardRef, useId } from 'react';

const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = '', id, required, rows = 4, ...rest },
  ref
) {
  const autoId = useId();
  const textareaId = id || autoId;
  return (
    <div className={`ui-field ${error ? 'ui-field-error' : ''}`}>
      {label && (
        <label className="ui-label" htmlFor={textareaId}>
          {label}
          {required && <span className="ui-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`ui-input ui-textarea ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        {...rest}
      />
      {error && (
        <p className="ui-field-error-msg" id={`${textareaId}-error`} role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="ui-field-hint" id={`${textareaId}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
});

export default Textarea;
