import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/index.jsx';

export default function PDFBookViewer({ book, onClose }) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="book3d-fullscreen" style={{ background: '#525659' }}>
      <div className="book3d-topbar">
        <div className="book3d-topbar-left">
          <span className="material-icons" style={{ color: book.color || '#E91E63', fontSize: 28 }}>picture_as_pdf</span>
          <div>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>{book.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.75rem' }}>{book.subtitle}</p>
          </div>
        </div>
        <div className="book3d-topbar-right">
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(50, z - 10)); }} disabled={zoom <= 50}>
            <span className="material-icons">zoom_out</span>
          </button>
          <span className="book3d-zoom-label">{zoom}%</span>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(200, z + 10)); }} disabled={zoom >= 200}>
            <span className="material-icons">zoom_in</span>
          </button>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(100); }}>
            <span className="material-icons">restart_alt</span>
          </button>
          <div className="book3d-sep" />
          <a
            href={book.pdfUrl}
            download
            className="book3d-topbtn"
            style={{ textDecoration: 'none', color: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-icons">download</span>
          </a>
          <button className="book3d-topbtn book3d-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', background: '#525659' }}>
        <iframe
          src={`${book.pdfUrl}#zoom=${zoom}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
          title={book.title}
        />
      </div>
    </div>
  );
}
