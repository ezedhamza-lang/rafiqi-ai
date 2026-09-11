import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { imgSrc, restoreOriginalImg } from '../../utils/imgSrc';

function pageUrl(imageBase, imageExt, page) {
  const num = String(page).padStart(3, '0');
  return `${imageBase}page-${num}${imageExt || '.jpg'}`;
}

export default function BookViewer({ book, onClose }) {
  const { t } = useI18n();
  const [page, setPage] = useState(book.totalPages ? 1 : 0);
  const [imgError, setImgError] = useState(false);
  const [lift, setLift] = useState(null); // { next, angle, anim }
  const sceneRef = useRef(null);
  const dragRef = useRef({ startX: 0, width: 600, moved: false });
  const total = book.totalPages || 0;

  const go = (p) => {
    const target = Math.min(Math.max(1, p), total);
    if (target === page || lift) return;
    if (target > page && page < total) startAutoFlip(target);
    else { setImgError(false); setPage(target); }
  };

  const startAutoFlip = (target) => {
    setLift({ next: page + 1, angle: 0, anim: false });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setLift((l) => (l ? { ...l, angle: 180, anim: true } : l));
      setTimeout(() => {
        setPage((p) => Math.min(p + 1, total));
        setLift(null);
        setImgError(false);
        if (target > page + 1) setTimeout(() => go(target), 60);
      }, 400);
    }));
  };

  const onPointerDown = (e) => {
    if (page >= total || lift || !book.hasImages || imgError) return;
    const rect = sceneRef.current?.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, width: Math.max(280, rect?.width || 600), moved: false };
    setLift({ next: page + 1, angle: 0, anim: false });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!lift || lift.anim) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 6) dragRef.current.moved = true;
    const angle = Math.max(0, Math.min(178, (dx * 180) / dragRef.current.width));
    setLift((l) => (l && !l.anim ? { ...l, angle } : l));
  };
  const onPointerUp = (e) => {
    if (!lift || lift.anim) return;
    const tapped = !dragRef.current.moved;
    if (tapped) {
      const rect = sceneRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left || 0);
      setLift(null);
      if (x < (rect?.width || 600) * 0.5) startAutoFlip(page + 1);
      else go(page - 1);
      return;
    }
    if (lift.angle > 55) {
      setLift({ ...lift, angle: 180, anim: true });
      setTimeout(() => { setPage((p) => Math.min(p + 1, total)); setLift(null); setImgError(false); }, 400);
    } else {
      setLift({ ...lift, angle: 0, anim: true });
      setTimeout(() => setLift(null), 380);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(page + 1);
      else if (e.key === 'ArrowRight') go(page - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const basePage = lift ? lift.next : page;
  const baseSrc = pageUrl(book.imageBase, book.imageExt, basePage);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{book.title}</h3>
            <p className="viewer-sub">{book.grade} - {book.subject}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>

        <div className="viewer-stage">
          {!book.hasImages || imgError ? (
            <div className="viewer-noimg">
              <span className="material-icons" style={{ fontSize: '3rem', color: 'var(--muted)' }}>auto_stories</span>
              <p>{t('studentSpace.bookViewer.noImages')}</p>
            </div>
          ) : (
            <div
              className="flip-scene"
              ref={sceneRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                key={baseSrc}
                src={imgSrc(baseSrc)}
                alt={t('studentSpace.bookViewer.pageAlt', { title: book.title, page: basePage })}
                className="viewer-page"
                decoding="async"
                draggable={false}
                onError={(e) => { if (restoreOriginalImg(e, baseSrc)) return; setLift(null); setImgError(true); }}
              />
              {lift && (
                <div
                  className={`flip-leaf${lift.anim ? ' anim' : ''}`}
                  style={{ transform: `rotateY(${lift.angle}deg)` }}
                >
                  <div className="flip-face front">
                    <img
                      src={imgSrc(pageUrl(book.imageBase, book.imageExt, page))}
                      alt=""
                      draggable={false}
                      decoding="async"
                      onError={(e) => { if (restoreOriginalImg(e, pageUrl(book.imageBase, book.imageExt, page))) return; setLift(null); setImgError(true); }}
                    />
                  </div>
                  <div className="flip-face back">
                    <img src={imgSrc(baseSrc)} alt="" draggable={false} decoding="async" />
                  </div>
                  <div className="flip-shadow" style={{ opacity: Math.min(0.5, lift.angle / 180) }} />
                </div>
              )}
              <div className="flip-hint">
                <span className="material-icons" style={{ fontSize: 15 }}>swipe</span>
                {t('studentSpace.bookViewer.swipeHint', { defaultValue: 'اسحب الصفحة أو انقر نصفها الأيسر للتالي' })}
              </div>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="viewer-nav">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1 || !!lift} onClick={() => go(page - 1)}>
              <span className="material-icons" style={{ fontSize: '18px' }}>chevron_right</span>
              {t('studentSpace.bookViewer.prev')}
            </button>
            <div className="viewer-pages">
              <span>{t('studentSpace.bookViewer.page')}</span>
              <input
                type="number"
                min={1}
                max={total}
                value={page}
                onChange={(e) => go(Number(e.target.value) || 1)}
                className="viewer-page-input"
              />
              <span>/ {total}</span>
            </div>
            <button className="btn btn-primary btn-sm" disabled={page >= total || !!lift} onClick={() => go(page + 1)}>
              {t('studentSpace.bookViewer.next')}
              <span className="material-icons" style={{ fontSize: '18px' }}>chevron_left</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
