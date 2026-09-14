import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/index.jsx';

export default function PDFBookViewer({ book, onClose }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(book.totalPages || 0);
  const [pdf, setPdf] = useState(null);
  const [scale, setScale] = useState(1.2);
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument(book.pdfUrl).promise;
      if (!cancelled) {
        setPdf(doc);
        setNumPages(doc.numPages);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [book.pdfUrl]);

  const renderPages = useCallback(async () => {
    if (!pdf) return;
    const dpr = window.devicePixelRatio || 1;

    const renderTo = async (canvas, pageNum) => {
      if (!canvas || pageNum < 1 || pageNum > numPages) return;
      const page = await pdf.getPage(pageNum);
      const vp = page.getViewport({ scale: scale * dpr });
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = (vp.width / dpr) + 'px';
      canvas.style.height = (vp.height / dpr) + 'px';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    };

    await Promise.all([
      renderTo(leftCanvasRef.current, page - 1),
      renderTo(rightCanvasRef.current, page)
    ]);
  }, [pdf, page, scale, numPages]);

  useEffect(() => {
    renderPages();
  }, [renderPages]);

  const go = useCallback((p) => {
    const target = Math.max(1, Math.min(p, numPages));
    setPage(target);
  }, [numPages]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(page + 2);
      else if (e.key === 'ArrowRight') go(page - 2);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, go, onClose]);

  const touchRef = useRef({ startX: 0 });
  const onTouchStart = (e) => { touchRef.current.startX = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) go(page + 2);
      else go(page - 2);
    }
  };

  return (
    <div className="book3d-fullscreen" onClick={onClose}>
      <div className="book3d-topbar">
        <div className="book3d-topbar-left">
          <span className="material-icons" style={{ color: book.color || '#E91E63', fontSize: 28 }}>picture_as_pdf</span>
          <div>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>{book.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: '0.75rem' }}>{book.subtitle}</p>
          </div>
        </div>
        <div className="book3d-topbar-right">
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); go(1); }} disabled={page <= 1}>
            <span className="material-icons">first_page</span>
          </button>
          <div className="book3d-pagecounter">
            <input
              type="number"
              min={1}
              max={numPages}
              value={page}
              onChange={(e) => { e.stopPropagation(); go(Number(e.target.value) || 1); }}
              onClick={(e) => e.stopPropagation()}
              className="book3d-pageinput"
            />
            <span>— {page + 1} / {numPages}</span>
          </div>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); go(numPages - 1); }} disabled={page >= numPages - 1}>
            <span className="material-icons">last_page</span>
          </button>
          <div className="book3d-sep" />
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.2)); }} disabled={scale <= 0.5}>
            <span className="material-icons">zoom_out</span>
          </button>
          <span className="book3d-zoom-label">{Math.round(scale * 100)}%</span>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.2)); }} disabled={scale >= 3}>
            <span className="material-icons">zoom_in</span>
          </button>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setScale(1.2); }}>
            <span className="material-icons">restart_alt</span>
          </button>
          <div className="book3d-sep" />
          <button className="book3d-topbtn book3d-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="book3d-scene"
        style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', gap: 0 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="book3d-arrow book3d-arrow-left" disabled={page <= 1} onClick={(e) => { e.stopPropagation(); go(page - 2); }}>
          <span className="material-icons">chevron_right</span>
        </button>

        <div style={{ display: 'flex', gap: 0, transform: `scale(${scale > 1.2 ? 1 : scale / 1.2})`, transition: 'transform 0.3s' }}>
          {page > 1 && (
            <div style={{ background: '#fff', borderRadius: '4px 0 0 4px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <canvas ref={leftCanvasRef} style={{ display: 'block' }} />
            </div>
          )}
          <div style={{ background: '#fff', borderRadius: page <= 1 ? '4px' : '0 4px 4px 0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderLeft: page > 1 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
            <canvas ref={rightCanvasRef} style={{ display: 'block' }} />
          </div>
        </div>

        <button className="book3d-arrow book3d-arrow-right" disabled={page >= numPages - 1} onClick={(e) => { e.stopPropagation(); go(page + 2); }}>
          <span className="material-icons">chevron_left</span>
        </button>
      </div>

      <div className="book3d-progress" onClick={(e) => e.stopPropagation()}>
        <div className="book3d-progress-fill" style={{ width: `${(page / numPages) * 100}%`, background: book.color || '#E91E63' }} />
      </div>
    </div>
  );
}
