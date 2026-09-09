import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Card, PointsCard, BadgeCard, Leaderboard } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function StudentTwin() {
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ rows: [] });
  const [boardAll, setBoardAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/student/profile'), api.get('/student/leaderboard')])
      .then(([p, lb]) => {
        setProfile(p);
        setLeaderboard(lb);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-wrap"><span className="spinner" /></div>;
  if (!profile) return <div className="empty">{t('studentSpace.twin.empty')}</div>;

  const { user, badges, activities, stats } = profile;
  const strengths = stats.avgPercent >= 70
    ? [t('studentSpace.twin.strongPerf'), t('studentSpace.twin.commitment')]
    : [t('studentSpace.twin.needsPractice')];
  const weaknesses = stats.avgPercent < 70
    ? [t('studentSpace.twin.improveAccuracy')]
    : [t('studentSpace.twin.diversifyActivities')];

  return (
    <>
      <Card
        title={t('studentSpace.twin.title')}
        icon="insights"
        subtitle={t('studentSpace.twin.subtitle')}
      >
        <div className="card-item intro-video-card">
          <video
            src="/media/rafiqi-intro.mp4"
            controls
            preload="metadata"
            className="intro-video"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        <div className="twin-cards">
          <PointsCard icon="emoji_events" label={t('studentSpace.twin.myLevel')} value={`Lv ${user.level}`} color="gold"
            sub={t('studentSpace.twin.nextLevelAt', { xp: user.xp, next: Math.floor(user.xp / 100) * 100 + 100 })} />
          <PointsCard icon="track_changes" label={t('studentSpace.twin.overallAccuracy')} value={`${stats.accuracy}%`} color="primary"
            sub={t('studentSpace.twin.quizzesDone', { n: stats.quizzesDone })} />
          <PointsCard icon="local_fire_department" label={t('studentSpace.twin.streak')} value={user.streakDays} color="accent"
            sub={t('studentSpace.twin.streakSub')} />
        </div>

        <div className="sub-grid">
          <div className="card-item">
            <h4>{t('studentSpace.twin.strengths')}</h4>
            <ul>
              {strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="card-item">
            <h4>{t('studentSpace.twin.weaknesses')}</h4>
            <ul>
              {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      </Card>

      <div className="sub-grid" style={{ marginTop: '1.5rem' }}>
        <Card title={t('studentSpace.twin.badgesCount', { n: badges.length })} icon="military_tech">
          {badges.length === 0 ? (
            <p className="muted">{t('studentSpace.twin.noBadgesYet')}</p>
          ) : (
            <div className="badges-row">
              {badges.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
          )}
        </Card>

        <div className="ui-leaderboard-wrap">
          <Leaderboard title={t('studentSpace.twin.classLeaderboard')} rows={(leaderboard.rows || []).slice(0, 10)} emptyText={t('studentSpace.twin.noBadgesYet')} />
          {(leaderboard.rows || []).length > 10 && (
            <div className="lb-modal-actions">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setBoardAll(true)}>
                {t('studentSpace.twin.viewAll')}
              </button>
            </div>
          )}
        </div>
        {boardAll && (
          <div className="modal-overlay" onClick={() => setBoardAll(false)}>
            <div className="modal lb-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>{t('studentSpace.twin.classLeaderboard')}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setBoardAll(false)}>{t('common.close')}</button>
              </div>
              <Leaderboard title="" rows={leaderboard.rows || []} emptyText={t('studentSpace.twin.noBadgesYet')} />
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <Card title={t('studentSpace.twin.activityLog')} icon="history">
          {activities.length === 0 ? (
            <p className="muted">{t('studentSpace.twin.noActivitiesYet')}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('studentSpace.twin.colActivity')}</th>
                    <th>{t('studentSpace.twin.colPoints')}</th>
                    <th>{t('studentSpace.twin.colDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id}>
                      <td>{a.type === 'QUIZ' ? t('studentSpace.twin.quizActivity', { detail: a.detail || '' }) : a.detail || a.type}</td>
                      <td>+{a.points} XP</td>
                      <td>{new Date(a.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
