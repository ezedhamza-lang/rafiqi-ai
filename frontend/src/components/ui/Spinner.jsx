export default function Spinner({ size = 28, label = 'جارٍ التحميل...', className = '' }) {
  return (
    <div className={`ui-spinner-wrap ${className}`} role="status" aria-live="polite">
      <span className="ui-spinner" style={{ width: size, height: size, borderWidth: Math.max(2, size / 9) }} />
      {label && <span className="ui-spinner-label">{label}</span>}
    </div>
  );
}
