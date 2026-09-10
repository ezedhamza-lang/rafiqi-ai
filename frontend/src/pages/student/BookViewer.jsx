import { useState } from 'react';
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
  const total = book.totalPages || 0;

  const src = pageUrl(book.imageBase, book.imageExt, page);
  const go = (p) => {
    setImgError(false);
    setPage(Math.min(Math.max(1, p), total));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{book.title}</h3>
            <p className="viewer-sub">{book.grade} — {book.subject}</p>
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
            <img
              key={src}
              src={imgSrc(src)}
              alt={t('studentSpace.bookViewer.pageAlt', { title: book.title, page })}
              className="viewer-page"
              decoding="async"
              onError={(e) => { if (restoreOriginalImg(e, src)) return; setImgError(true); }}
            />
          )}
        </div>

        {total > 0 && (
          <div className="viewer-nav">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>
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
            <button className="btn btn-primary btn-sm" disabled={page >= total} onClick={() => go(page + 1)}>
              {t('studentSpace.bookViewer.next')}
              <span className="material-icons" style={{ fontSize: '18px' }}>chevron_left</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
