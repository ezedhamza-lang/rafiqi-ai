import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#fbbf24', '#94a3b8', '#cd7f32'];

export default function StudentLeaderboard() {
  const { t } = useI18n();
  const [board, setBoard] = useState([]);
  const [myRank, setMyRank] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/leaderboard')
      .then(d => {
        setBoard(d.leaderboard || []);
        setMyRank(d.currentRank || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="lb-loading"><div className="spinner" /></div>;

  return (
    <div className="lb-page">
      <div className="lb-hero">
        <span className="lb-hero__icon">🏆</span>
        <h2 className="lb-hero__title">{t('studentSpace.leaderboard.title', 'لوحة الشرف')}</h2>
        <p className="lb-hero__sub">{t('studentSpace.leaderboard.subtitle', 'أفضل التلاميذ هذا الأسبوع')}</p>
      </div>

      {myRank > 0 && (
        <div className="lb-my-rank">
          <span>{t('studentSpace.leaderboard.yourRank', 'ترتيبك')}:</span>
          <span className="lb-my-rank__badge">#{myRank}</span>
        </div>
      )}

      <div className="lb-board">
        {board.length === 0 ? (
          <div className="lb-empty">
            <p>{t('studentSpace.leaderboard.empty', 'لا يوجد تلاميذ بعد')}</p>
          </div>
        ) : (
          board.map((s, i) => (
            <div key={s.id} className={`lb-row ${s.isMe ? 'lb-row--me' : ''} ${i < 3 ? 'lb-row--top' : ''}`}>
              <span className="lb-row__rank" style={i < 3 ? { background: RANK_COLORS[i], color: '#fff' } : {}}>
                {i < 3 ? RANK_ICONS[i] : `#${s.rank}`}
              </span>
              <div className="lb-row__avatar">
                {s.name?.[0] || '?'}
              </div>
              <div className="lb-row__info">
                <span className="lb-row__name">{s.name}</span>
                <span className="lb-row__level">{t('studentSpace.leaderboard.level', 'المستوى')} {s.level}</span>
              </div>
              <div className="lb-row__stats">
                <span className="lb-row__xp">⭐ {s.xp}</span>
                <span className="lb-row__streak">🔥 {s.streak}</span>
              </div>
              {s.isMe && <span className="lb-row__me">{t('studentSpace.leaderboard.me', 'أنا')}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
