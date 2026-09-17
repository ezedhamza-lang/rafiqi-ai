import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, PointsCard, BadgeCard, Leaderboard } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

const QUICK_ACTIONS = [
  { icon: 'auto_stories', label: 'studentSpace.twin.qaBooks', to: '/student-space/books', color: '#14b8a6', gradient: 'linear-gradient(135deg,#14b8a6,#06b6d4)' },
  { icon: 'quiz', label: 'studentSpace.twin.qaQuizzes', to: '/student-space/quizzes', color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f97316)' },
  { icon: 'smart_toy', label: 'studentSpace.twin.qaRefeeqi', to: '/student-space/refeeqi', color: '#ff6a00', gradient: 'linear-gradient(135deg,#ff6a00,#f59e0b)' },
  { icon: 'sports_esports', label: 'studentSpace.twin.qaPlay', to: '/student-space/play', color: '#ec4899', gradient: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
];

function MiniRing({ value, max, color, size = 48, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ - pct * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke="rgba(255,255,255,.15)" />
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
        stroke={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  );
}

export default function StudentTwin() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ rows: [] });
  const [boardAll, setBoardAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/student/profile'), api.get('/student/leaderboard')])
      .then(([p, lb]) => { setProfile(p); setLeaderboard(lb); })
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
    <div className="twin-v3">
      {/* ── Quick Actions ── */}
      <div className="twin-v3__qa slide-up-stagger">
        {QUICK_ACTIONS.map((qa) => (
          <button key={qa.to} className="twin-v3__qa-btn" style={{ '--qa-grad': qa.gradient, '--qa-color': qa.color }}
            onClick={() => navigate(qa.to)}>
            <span className="material-icons twin-v3__qa-ico">{qa.icon}</span>
            <span className="twin-v3__qa-lbl">{t(qa.label)}</span>
          </button>
        ))}
      </div>

      {/* ── Daily Challenge ── */}
      <div className="twin-v3__challenge">
        <div className="twin-v3__challenge-head">
          <span className="sparkle-wrap"><span className="material-icons" style={{ color: '#f59e0b' }}>emoji_events</span></span>
          <h3>{t('studentSpace.twin.dailyChallenge')}</h3>
        </div>
        <p className="twin-v3__challenge-desc">{t('studentSpace.twin.dailyChallengeDesc')}</p>
        <div className="twin-v3__challenge-goals">
          <div className="twin-v3__goal">
            <MiniRing value={stats.quizzesDone || 0} max={3} color="#ef4444" />
            <div>
              <span className="twin-v3__goal-title">{t('studentSpace.twin.goalQuizzes')}</span>
              <span className="twin-v3__goal-val">{Math.min(stats.quizzesDone || 0, 3)}/3</span>
            </div>
          </div>
          <div className="twin-v3__goal">
            <MiniRing value={profile.stats?.lessonsCompleted || 0} max={5} color="#14b8a6" />
            <div>
              <span className="twin-v3__goal-title">{t('studentSpace.twin.goalLessons')}</span>
              <span className="twin-v3__goal-val">{Math.min(profile.stats?.lessonsCompleted || 0, 5)}/5</span>
            </div>
          </div>
          <div className="twin-v3__goal">
            <MiniRing value={user.streakDays || 0} max={7} color="#f97316" />
            <div>
              <span className="twin-v3__goal-title">{t('studentSpace.twin.goalStreak')}</span>
              <span className="twin-v3__goal-val">{Math.min(user.streakDays || 0, 7)}/7</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="twin-v3__stats">
        <div className="twin-v3__stat-card twin-v3__stat-card--gold">
          <span className="material-icons">emoji_events</span>
          <div className="twin-v3__stat-card-val">Lv {user.level}</div>
          <div className="twin-v3__stat-card-lbl">{t('studentSpace.twin.myLevel')}</div>
          <div className="twin-v3__stat-card-sub">{t('studentSpace.twin.nextLevelAt', { xp: user.xp, next: Math.floor(user.xp / 100) * 100 + 100 })}</div>
        </div>
        <div className="twin-v3__stat-card twin-v3__stat-card--blue">
          <span className="material-icons">track_changes</span>
          <div className="twin-v3__stat-card-val">{stats.accuracy}%</div>
          <div className="twin-v3__stat-card-lbl">{t('studentSpace.twin.overallAccuracy')}</div>
          <div className="twin-v3__stat-card-sub">{t('studentSpace.twin.quizzesDone', { n: stats.quizzesDone })}</div>
        </div>
        <div className="twin-v3__stat-card twin-v3__stat-card--red">
          <span className="material-icons">local_fire_department</span>
          <div className="twin-v3__stat-card-val">{user.streakDays}</div>
          <div className="twin-v3__stat-card-lbl">{t('studentSpace.twin.streak')}</div>
          <div className="twin-v3__stat-card-sub">{t('studentSpace.twin.streakSub')}</div>
        </div>
      </div>

      {/* ── Strengths & Weaknesses ── */}
      <div className="twin-v3__sub-grid">
        <div className="twin-v3__analysis">
          <h4><span className="material-icons" style={{ color: '#10b981' }}>trending_up</span> {t('studentSpace.twin.strengths')}</h4>
          <ul>{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="twin-v3__analysis">
          <h4><span className="material-icons" style={{ color: '#f97316' }}>trending_down</span> {t('studentSpace.twin.weaknesses')}</h4>
          <ul>{weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      </div>

      {/* ── Badges & Leaderboard ── */}
      <div className="twin-v3__sub-grid" style={{ marginTop: '1.2rem' }}>
        <Card title={t('studentSpace.twin.badgesCount', { n: badges.length })} icon="military_tech">
          {badges.length === 0 ? (
            <div className="twin-v3__empty-state">
              <span className="material-icons">military_tech</span>
              <p>{t('studentSpace.twin.noBadgesYet')}</p>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/student-space/quizzes')}>
                {t('studentSpace.twin.startEarning')}
              </button>
            </div>
          ) : (
            <div className="badges-row">{badges.map((b) => <BadgeCard key={b.id} badge={b} />)}</div>
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

      {/* ── Activity Log ── */}
      <div style={{ marginTop: '1.2rem' }}>
        <Card title={t('studentSpace.twin.activityLog')} icon="history">
          {activities.length === 0 ? (
            <div className="twin-v3__empty-state">
              <span className="material-icons">history</span>
              <p>{t('studentSpace.twin.noActivitiesYet')}</p>
            </div>
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
    </div>
  );
}
