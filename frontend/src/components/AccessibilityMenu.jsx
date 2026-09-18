import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

const STORAGE_KEY = 'rafiqi-a11y';
const FONT_SIZES = ['normal', 'large', 'xlarge'];

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (FONT_SIZES.includes(p.font) && typeof p.contrast === 'boolean') return p;
    }
  } catch { /* ignore */ }
  return { font: 'normal', contrast: false };
}

function applyPrefs({ font, contrast }) {
  const root = document.documentElement;
  root.setAttribute('data-font', font);
  if (contrast) root.setAttribute('data-contrast', 'high');
  else root.removeAttribute('data-contrast');
}

/**
 * AccessibilityMenu — options d'accessibilité (élèves à besoins spécifiques) :
 * taille du texte + contraste renforcé. Persisté en localStorage.
 */
export default function AccessibilityMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const ref = useRef(null);

  useEffect(() => {
    applyPrefs(prefs);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const update = (patch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="a11y-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        title={t('accessibility.title')}
        aria-label={t('accessibility.title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="material-icons">accessibility</span>
      </button>
      {open && (
        <div className="a11y-dropdown" role="menu" aria-label={t('accessibility.title')}>
          <p className="a11y-dropdown__label">{t('accessibility.fontSize')}</p>
          <div className="a11y-font-row" role="group" aria-label={t('accessibility.fontSize')}>
            {FONT_SIZES.map((f) => (
              <button
                key={f}
                type="button"
                className={`a11y-font-btn${prefs.font === f ? ' active' : ''}`}
                onClick={() => update({ font: f })}
                aria-pressed={prefs.font === f}
              >
                {t(`accessibility.font_${f}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`a11y-contrast${prefs.contrast ? ' active' : ''}`}
            onClick={() => update({ contrast: !prefs.contrast })}
            aria-pressed={prefs.contrast}
            role="menuitemcheckbox"
          >
            <span className="material-icons">contrast</span>
            {t('accessibility.contrast')}
          </button>
          <p className="a11y-dropdown__hint">{t('accessibility.hint')}</p>
        </div>
      )}
    </div>
  );
}
