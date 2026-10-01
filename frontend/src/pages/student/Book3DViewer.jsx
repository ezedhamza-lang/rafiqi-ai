import { useState, useRef, useEffect, useCallback } from 'react';
import { imgSrc } from '../../utils/imgSrc';

function pageUrl(base, ext, page) {
  const num = String(page).padStart(3, '0');
  return `${base}page-${num}${ext || '.png'}`;
}

export default function Book3DViewer({ book, onClose }) {
  const [page, setPage] = useState(1);
  const [turning, setTurning] = useState(null);
  const [zoom, setZoom] = useState(1);
  const total = book.totalPages || 0;
  const sceneRef = useRef(null);

  const go = useCallback((p) => {
    const target = Math.min(Math.max(1, p), total);
    if (target === page || turning) return;
    const dir = target > page ? 'next' : 'prev';
    setTurning(dir);
    setTimeout(() => {
      setPage(target);
      setTimeout(() => setTurning(null), 50);
    }, 450);
  }, [page, total, turning]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(page + 1);
      else if (e.key === 'ArrowRight') go(page - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, go, onClose]);

  // Touch / swipe support
  const touchRef = useRef({ startX: 0, moved: false });
  const onTouchStart = (e) => {
    touchRef.current = { startX: e.touches[0].clientX, moved: false };
  };
  const onTouchEnd = (e) => {
    // مُكبَّر ⇒ السحب يمرّر الصفحة لا يقلّبها (التمرير الأصلي يتحكّم بالتحريك).
    if (zoom > 1) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) go(page + 1);
      else go(page - 1);
    }
  };

  // سحب بالفأرة فوق محتوى ممرَّر (تكبير > 1): نمرّر الصندوق يدويًا.
  const dragRef = useRef(null);
  const onPointerDown = (e) => {
    if (zoom <= 1) return;
    const el = sceneRef.current;
    if (!el) return;
    dragRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    const el = sceneRef.current;
    if (!d || !el) return;
    el.scrollLeft = d.sl - (e.clientX - d.x);
    el.scrollTop = d.st - (e.clientY - d.y);
  };
  const onPointerUp = () => { dragRef.current = null; };

  const prevSrc = pageUrl(book.imageBase, book.imageExt, Math.max(1, page - 1));
  const currSrc = pageUrl(book.imageBase, book.imageExt, page);
  const nextSrc = pageUrl(book.imageBase, book.imageExt, Math.min(total, page + 1));

  return (
    <div className="book3d-fullscreen" onClick={onClose}>
      {/* Top bar */}
      <div className="book3d-topbar">
        <div className="book3d-topbar-left">
          <span className="material-icons" style={{ color: book.color || '#E91E63', fontSize: 28 }}>auto_stories</span>
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
              max={total}
              value={page}
              onChange={(e) => { e.stopPropagation(); go(Number(e.target.value) || 1); }}
              onClick={(e) => e.stopPropagation()}
              className="book3d-pageinput"
            />
            <span>/ {total}</span>
          </div>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); go(total); }} disabled={page >= total}>
            <span className="material-icons">last_page</span>
          </button>
          <div className="book3d-sep" />
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.15)); }} disabled={zoom <= 0.5}>
            <span className="material-icons">zoom_out</span>
          </button>
          <span className="book3d-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(2.5, z + 0.15)); }} disabled={zoom >= 2.5}>
            <span className="material-icons">zoom_in</span>
          </button>
          <button className="book3d-topbtn" onClick={(e) => { e.stopPropagation(); setZoom(1); }}>
            <span className="material-icons">restart_alt</span>
          </button>
          <div className="book3d-sep" />
          <button className="book3d-topbtn book3d-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>
      </div>

      {/* 3D Book Scene — fullscreen */}
      <div
        className={`book3d-scene${zoom > 1 ? ' is-zoomed' : ''}`}
        ref={sceneRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="book3d-wrapper">
          <div
            className="book3d-book"
            /* التكبير بقياس الصفحة لا بـ transform: يعيد المتصفح رسم الصورة
               بدقة في كل تكبير (النصّ يبقى حادًّا) ويسمح بالتمرير للتحريك */
            style={{ width: `calc(min(96vw, 2400px) * ${zoom})`, height: `calc(min(80vh, 1040px) * ${zoom})` }}
          >
            {/* Spine */}
            <div className="book3d-spine" style={{ background: book.color || '#E91E63' }}>
              <span className="book3d-spine-title">{book.title}</span>
            </div>

            {/* Left Page */}
            <div className="book3d-page book3d-page-left">
              {page > 1 && (
                <img src={imgSrc(prevSrc)} alt="" draggable={false} decoding="async" />
              )}
            </div>

            {/* Right Page */}
            <div className="book3d-page book3d-page-right">
              <img key={currSrc} src={imgSrc(currSrc)} alt={`${book.title} — ${page}`} draggable={false} decoding="async" />
            </div>

            {/* Turning page */}
            {turning && (
              <div className={`book3d-turning book3d-turning-${turning}`}>
                <div className="book3d-turn-front">
                  <img src={imgSrc(turning === 'next' ? currSrc : nextSrc)} alt="" draggable={false} decoding="async" />
                </div>
                <div className="book3d-turn-back">
                  <img src={imgSrc(turning === 'next' ? nextSrc : currSrc)} alt="" draggable={false} decoding="async" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Arrow buttons */}
        <button className="book3d-arrow book3d-arrow-right" disabled={page >= total || !!turning} onClick={(e) => { e.stopPropagation(); go(page + 1); }}>
          <span className="material-icons">chevron_right</span>
        </button>
        <button className="book3d-arrow book3d-arrow-left" disabled={page <= 1 || !!turning} onClick={(e) => { e.stopPropagation(); go(page - 1); }}>
          <span className="material-icons">chevron_left</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="book3d-progress" onClick={(e) => e.stopPropagation()}>
        <div className="book3d-progress-fill" style={{ width: total > 0 ? `${(page / total) * 100}%` : '0%', background: book.color || '#E91E63' }} />
      </div>
    </div>
  );
}
