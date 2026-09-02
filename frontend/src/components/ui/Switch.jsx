export default function Switch({ checked, onChange, label, id, disabled, className = '' }) {
  return (
    <label className={`ui-switch ${className}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" aria-hidden="true" />
      </span>
      {label && <span className="ui-switch-label">{label}</span>}
    </label>
  );
}
