import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { BOOKS } from '../data/books.js';

const SPEED_PX_PER_S = 20;

export default function BooksShowcase() {
  const { t, lang } = useI18n();
  const isAr = lang !== 'en';
  const scrollerRef = useRef(null);
  const pausedRef = useRef(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current && !document.hidden) {
        el.scrollLeft += SPEED_PX_PER_S * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    pausedRef.current = selected !== null;
  }, [selected]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const nudge = useCallback((dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
  }, []);

  const cards = [...BOOKS, ...BOOKS];

  return (
    <section className="section books-showcase" id="books" dir="rtl">
      <div className="container">
        <div className="books-head">
          <div>
            <span className="books-eyebrow">{t('home.books.eyebrow')}</span>
            <h2 className="section-title books-title">📚 {t('home.books.title')}</h2>
            <p className="books-sub">{t('home.books.sub')}</p>
          </div>
          <div className="books-arrows" dir="ltr">
            <button type="button" className="books-arrow" onClick={() => nudge(1)} aria-label={t('home.books.next')} >
              <span className="material-icons">chevron_right</span>
            </button>
            <button type="button" className="books-arrow" onClick={() => nudge(-1)} aria-label={t('home.books.prev')}>
              <span className="material-icons">chevron_left</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="books-scroller"
        dir="ltr"
        ref={scrollerRef}
        onPointerEnter={() => { pausedRef.current = true; }}
        onPointerLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
      >
        <div className="books-track">
          {cards.map((b, i) => (
            <button
              type="button"
              className="book-card"
              key={b.id + (i < BOOKS.length ? '-a' : '-b')}
              onClick={() => setSelected(b)}
              tabIndex={i < BOOKS.length ? 0 : -1}
              aria-hidden={i >= BOOKS.length || undefined}
            >
              <span className="book-cover">
                <img src={b.cover} alt={isAr ? b.name : b.nameEn} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
                <span className="book-spine" aria-hidden="true" />
                <span className="book-gloss" aria-hidden="true" />
                <span className="book-discover"><span className="material-icons">auto_stories</span> {t('home.books.discover')}</span>
              </span>
              <span className="book-name">{isAr ? b.name : b.nameEn}</span>
              {b.price != null && <span className="book-price">{b.price} د</span>}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="book-modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div className="book-modal" role="dialog" aria-modal="true" aria-label={selected.name} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="book-modal-close" onClick={() => setSelected(null)} aria-label={t('home.books.close')}>
              <span className="material-icons">close</span>
            </button>
            <div className="book-modal-cover">
              <img src={selected.cover} alt={isAr ? selected.name : selected.nameEn} />
            </div>
            <div className="book-modal-info">
              <h3>{isAr ? selected.name : selected.nameEn}</h3>
              <p>{isAr ? selected.desc : selected.descEn}</p>
              {selected.price != null
                ? <div className="book-modal-price"><b>{selected.price} د</b></div>
                : <div className="book-modal-price hint">{t('home.books.priceHint')}</div>}
              <div className="book-modal-actions">
                <Link to="/register" className="btn btn-primary btn-lg">
                  <span className="material-icons">shopping_cart</span> {t('home.books.buy')}
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>{t('home.books.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
