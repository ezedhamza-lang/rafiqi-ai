/**
 * حديقة المعرفة — Knowledge Garden Adventure (embedded game).
 *
 * The 3D game itself lives in /public/games/knowledge-garden and runs inside
 * an iframe. This page only provides the platform chrome around it: a title,
 * a back link and the standard page padding, so the existing Rafiqi header,
 * RTL layout and account stay exactly as they are.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';
import './KnowledgeGarden.css';

const GAME_SRC = '/games/knowledge-garden/index.html';

export default function KnowledgeGarden() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  return (
    <div className="kg-page">
      <div className="kg-page__bar">
        <Link to="/student-space" className="btn btn-outline btn-sm">
          ← {t('common.back') || 'رجوع'}
        </Link>
        <span className="kg-page__title">🎮 {t('nav.games') || 'الألعاب'} — 🌳 {t('nav.lettersGarden') || 'حديقة الحروف'}</span>
      </div>

      {loading && (
        <div className="kg-page__loading">
          <div className="kg-page__owl" aria-hidden="true">🦉</div>
          <p>جارٍ تحميل حديقة المعرفة…</p>
        </div>
      )}

      <iframe
        className="kg-page__frame"
        src={GAME_SRC}
        title="مغامرة رفيقي – حديقة المعرفة"
        onLoad={() => setLoading(false)}
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
