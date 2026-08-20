import { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';

const ToastContext = createContext(null);

let counter = 0;

const VARIANTS = {
  success: { icon: 'check_circle', cls: 'ui-toast-success' },
  error: { icon: 'error', cls: 'ui-toast-error' },
  warning: { icon: 'warning', cls: 'ui-toast-warning' },
  info: { icon: 'info', cls: 'ui-toast-info' }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, type = 'info', options = {}) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, message, type, options }]);
      const duration = options.duration ?? 4000;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const api = {
    success: (msg, opts) => push(msg, 'success', opts),
    error: (msg, opts) => push(msg, 'error', opts),
    warning: (msg, opts) => push(msg, 'warning', opts),
    info: (msg, opts) => push(msg, 'info', opts),
    dismiss
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-container" role="region" aria-label="الإشعارات">
        {toasts.map((t) => {
          const v = VARIANTS[t.type] || VARIANTS.info;
          return (
            <div key={t.id} className={`ui-toast ${v.cls}`} role="status">
              <span className="material-icons ui-toast-icon" aria-hidden="true">{v.icon}</span>
              <p className="ui-toast-msg">{t.message}</p>
              <button className="ui-toast-close" onClick={() => dismiss(t.id)} aria-label="إغلاق الإشعار">
                <span className="material-icons" aria-hidden="true">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
