import { useId } from 'react';

export default function Tabs({ items, active, onChange, className = '', ariaLabel }) {
  const baseId = useId();
  if (!items || items.length === 0) return null;

  return (
    <div className={`ui-tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      {items.map((item, idx) => {
        const value = item.value ?? item.key ?? idx;
        const isActive = active === value;
        const tabId = `${baseId}-tab-${idx}`;
        return (
          <button
            key={value}
            id={tabId}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${baseId}-panel-${idx}`}
            className={`ui-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(value)}
          >
            {item.icon && <span className="material-icons" aria-hidden="true">{item.icon}</span>}
            {item.label}
            {typeof item.count === 'number' && (
              <span className="ui-tab-count" aria-label={`${item.count} عنصر`}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }) {
  return (
    <div id={id} role="tabpanel" hidden={!active} tabIndex="0">
      {children}
    </div>
  );
}
