import { useEffect, useRef, useState, useCallback, useId } from 'react';
import Button from './Button.jsx';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  initialFocusRef
}) {
  const [mounted, setMounted] = useState(open);
  const overlayRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (open && initialFocusRef?.current) {
      initialFocusRef.current.focus();
    }
  }, [open, initialFocusRef]);

  if (!mounted) return null;

  const sizeClass = {
    sm: 'ui-modal-sm',
    md: 'ui-modal-md',
    lg: 'ui-modal-lg',
    xl: 'ui-modal-xl'
  }[size] || 'ui-modal-md';

  return (
    <div
      className={`ui-modal-overlay ${open ? 'ui-modal-visible' : 'ui-modal-hidden'}`}
      onMouseDown={(e) => {
        if (closeOnOverlay && open && e.target === overlayRef.current) handleClose();
      }}
      ref={overlayRef}
      aria-hidden={!open}
    >
      <div
        className={`ui-modal ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-hidden={!open}
      >
        {(title || icon) && (
          <div className="ui-modal-head">
            <div className="ui-modal-title-wrap">
              {icon && <span className="material-icons ui-modal-icon" aria-hidden="true">{icon}</span>}
              <div>
                {title && <h3 className="ui-modal-title" id={titleId}>{title}</h3>}
                {subtitle && <p className="ui-modal-subtitle">{subtitle}</p>}
              </div>
            </div>
            <button className="ui-modal-close" onClick={handleClose} aria-label="إغلاق النافذة">
              <span className="material-icons" aria-hidden="true">close</span>
            </button>
          </div>
        )}
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

Modal.CloseButton = Button;
