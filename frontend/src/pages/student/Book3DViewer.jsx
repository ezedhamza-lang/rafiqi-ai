import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { imgSrc } from '../../utils/imgSrc';

function pageUrl(base, ext, page) {
  const num = String(page).padStart(3, '0');
  return `${base}page-${num}${ext || '.webp'}`;
}

export default function Book3DViewer({ book, onClose }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [turning, setTurning] = useState(null); // 'next' | 'prev' | null
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(true);
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
    }, 400);
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

  const prevSrc = pageUrl(book.imageBase, book.imageExt, Math.max(1, page - 1));
  const currSrc = pageUrl(book.imageBase, book.imageExt, page);
  const nextSrc = pageUrl(book.imageBase, book.imageExt, Math.min(total, page + 1));

  return (
    <div className={`modal-overlay${full ? ' viewer-full-overlay' : ''}`} onClick={onClose}>
      <div className={`modal book3d-modal${full ? ' viewer-full' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head">
          <div>
            <h3 style={{ color: book.color || '#E91E63' }}>{book.title}</h3>
            <p className="viewer-sub">{book.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setFull(v => !v)}>
              <span className="material-icons" style={{ fontSize: 18 }}>{full ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>

        {/* 3D Book Scene */}
        <div className="book3d-scene" ref={sceneRef}>
          <div className="book3d-wrapper" style={{ transform: `scale(${zoom})` }}>
            {/* Book Body */}
            <div className="book3d-book">
              {/* Spine */}
              <div className="book3d-spine" style={{ background: book.color || '#E91E63' }}>
                <span className="book3d-spine-title">{book.title}</span>
              </div>

              {/* Left Page (back of previous) */}
              <div className="book3d-page book3d-page-left">
                {page > 1 && (
                  <img
                    src={imgSrc(prevSrc)}
                    alt=""
                    draggable={false}
                    decoding="async"
                  />
                )}
              </div>

              {/* Right Page (current) */}
              <div className="book3d-page book3d-page-right">
                <img
                  key={currSrc}
                  src={imgSrc(currSrc)}
                  alt={`${book.title} — ${page}`}
                  draggable={false}
                  decoding="async"
                />
              </div>

              {/* Turning page overlay */}
              {turning && (
                <div className={`book3d-turning book3d-turning-${turning}`}>
                  <div className="book3d-turn-front">
                    <img
                      src={imgSrc(turning === 'next' ? currSrc : nextSrc)}
                      alt=""
                      draggable={false}
                      decoding="async"
                    />
                  </div>
                  <div className="book3d-turn-back">
                    <img
                      src={imgSrc(turning === 'next' ? nextSrc : currSrc)}
                      alt=""
                      draggable={false}
                      decoding="async"
                    />
                  </div>
                </div>
              )}

              {/* Book cover overlay (first page) */}
              {page === 1 && !turning && (
                <div className="book3d-cover-edge" style={{ borderColor: book.color || '#E91E63' }} />
              )}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            className="book3d-nav book3d-nav-right"
            disabled={page >= total || !!turning}
            onClick={() => go(page + 1)}
            title={t('studentSpace.bookViewer.next')}
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <button
            className="book3d-nav book3d-nav-left"
            disabled={page <= 1 || !!turning}
            onClick={() => go(page - 1)}
            title={t('studentSpace.bookViewer.prev')}
          >
            <span className="material-icons">chevron_right</span>
          </button>
        </div>

        {/* Bottom bar */}
        <div className="viewer-nav">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1 || !!turning} onClick={() => go(page - 1)}>
            <span className="material-icons" style={{ fontSize: 18 }}>chevron_right</span>
            {t('studentSpace.bookViewer.prev')}
          </button>
          <div className="viewer-zoom">
            <button className="btn btn-ghost btn-sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} disabled={zoom <= 0.5}>
              <span className="material-icons" style={{ fontSize: 18 }}>remove</span>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setZoom(z => Math.min(2, z + 0.15))} disabled={zoom >= 2}>
              <span className="material-icons" style={{ fontSize: 18 }}>add</span>
            </button>
          </div>
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
          <button className="btn btn-primary btn-sm" disabled={page >= total || !!turning} onClick={() => go(page + 1)}>
            {t('studentSpace.bookViewer.next')}
            <span className="material-icons" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
        </div>
      </div>
    </div>
  );
}
