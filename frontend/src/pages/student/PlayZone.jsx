import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const GAME_CODES = ['QUICK_MATH', 'WORD_BUILD', 'MEMORY'];
const GAME_ICONS = { QUICK_MATH: 'calculate', WORD_BUILD: 'abc', MEMORY: 'grid_view' };
const GAME_COLORS = {
  QUICK_MATH: { gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)', icon: '#0ea5e9' },
  WORD_BUILD: { gradient: 'linear-gradient(135deg, #f97316, #f59e0b)', icon: '#f59e0b' },
  MEMORY:     { gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', icon: '#ec4899' },
};

const WORDS_AR = ['قلم', 'كتاب', 'مدرسة', 'تفاحة', 'كرة', 'سيارة', 'شمس', 'بحر', 'منزل', 'وردة', 'طائر', 'سمكة'];
const WORDS_EN = ['pen', 'book', 'school', 'apple', 'ball', 'car', 'sun', 'sea', 'house', 'rose', 'bird', 'fish'];
const MEMORY_ICONS = ['🍎', '🚀', '⭐', '🌈', '🐱', '🎈'];

function quickMathQuestions(count = 10) {
  return Array.from({ length: count }, () => {
    const plus = Math.random() > 0.5;
    if (plus) {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      return { text: `${a} + ${b} = ?`, answer: a + b };
    }
    const a = Math.floor(Math.random() * 9) + 2;
    const b = Math.floor(Math.random() * a) + 1;
    return { text: `${a} - ${b} = ?`, answer: a - b };
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function PlayZone() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/teacher/student/games'), api.get('/teacher/student/games/leaderboard')])
      .then(([g, lb]) => {
        setStats(g);
        setLeaderboard(lb.leaderboard);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const finishGame = async (game, payload) => {
    try {
      const res = await api.post('/teacher/student/games', { game, ...payload });
      if (res.remainingToday === 0) flash(t('studentSpace.play.gamesDoneToday'));
      else flash(t('studentSpace.play.gainedXp', { n: res.gained?.xp }));
      load();
    } catch (err) {
      flash(err.message);
    }
  };

  if (loading) return <div className="loading-wrap"><span className="spinner" /></div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.play.title')}</h3>
        {stats && (
          <span className="badge warn">
            {t('studentSpace.play.remainingToday', { remaining: stats.remainingToday, limit: stats.dailyLimit })}
          </span>
        )}
      </div>
      {toast && <div className="game-toast">{toast}</div>}

      {!activeGame ? (
        <>
          <div className="cards-grid slide-up-stagger">
            {GAME_CODES.map((code, idx) => (
              <div key={code} className="card-item game-card card-glow wiggle-hover" style={{ borderTop: `4px solid ${GAME_COLORS[code].icon}` }}>
                <span className="game-icon material-icons" style={{ color: GAME_COLORS[code].icon, fontSize: '2.8rem' }}>{GAME_ICONS[code]}</span>
                <h4>{t(`studentSpace.play.games.${code}.title`)}</h4>
                <p className="muted">{t(`studentSpace.play.games.${code}.desc`)}</p>
                <button
                  className="btn btn-primary btn-ripple"
                  disabled={!stats || stats.remainingToday <= 0}
                  onClick={() => setActiveGame(code)}
                >
                  {stats?.remainingToday <= 0 ? t('studentSpace.play.gamesOverToday') : t('studentSpace.play.playNow')}
                </button>
              </div>
            ))}
          </div>

          {stats?.history?.length > 0 && (
            <div className="card-item" style={{ marginTop: 16 }}>
              <h4>{t('studentSpace.play.myHistory')}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('studentSpace.play.colGame')}</th>
                      <th>{t('studentSpace.play.colResult')}</th>
                      <th>{t('studentSpace.play.colDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.history.slice(0, 10).map((h) => (
                      <tr key={h.id}>
                        <td>{GAME_CODES.includes(h.game) ? t(`studentSpace.play.games.${h.game}.title`) : h.game}</td>
                        <td>
                          <span className="badge good">{h.score} {t('studentSpace.play.pointsSuffix')}</span>
                        </td>
                        <td>{new Date(h.playedAt).toLocaleString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card-item" style={{ marginTop: 16 }}>
            <h4>{t('studentSpace.play.classRanking')}</h4>
            {leaderboard.length === 0 ? (
              <p className="muted">{t('studentSpace.play.noResultsYet')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('studentSpace.play.colRank')}</th>
                      <th>{t('studentSpace.play.colStudent')}</th>
                      <th>{t('studentSpace.play.colRounds')}</th>
                      <th>{t('studentSpace.play.colScore')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r) => (
                      <tr key={r.studentId}>
                        <td>
                          <span className={`rank-badge ${r.rank <= 3 ? `rank-${r.rank}` : ''}`}>{r.rank}</span>
                        </td>
                        <td>{r.firstName} {r.lastName}</td>
                        <td>{r.plays}</td>
                        <td><strong>{r.totalScore}</strong> {t('studentSpace.play.pointsSuffix')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <GameRunner
          code={activeGame}
          onExit={() => setActiveGame(null)}
          onFinish={finishGame}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
}

function GameRunner({ code, onExit, onFinish, t, lang }) {
  const [phase, setPhase] = useState('play');
  const [result, setResult] = useState(null);
  const [startTime] = useState(Date.now());

  const finish = (correct, total) => {
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    setResult({ correct, total });
    setPhase('done');
    onFinish(code, { score: correct, correct, total, durationSec });
  };

  if (code === 'QUICK_MATH') return <QuickMath onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
  if (code === 'WORD_BUILD') return <WordBuild onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} lang={lang} />;
  if (code === 'MEMORY') return <MemoryGame onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
  return null;
}

function GameResultView({ result, onExit, t }) {
  return (
    <div className="game-result">
      <div className="avg-big good">{result.correct} / {result.total}</div>
      <p className="muted">{t('studentSpace.play.correctAnswers')}</p>
      <div className="btn-group">
        <button className="btn btn-primary" onClick={onExit}>{t('studentSpace.play.backToPlayZone')}</button>
      </div>
    </div>
  );
}

function QuickMath({ onExit, onFinish, phase, result, t }) {
  const [questions] = useState(() => quickMathQuestions(10));
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [correct, setCorrect] = useState(0);

  const submit = (e) => {
    e.preventDefault();
    const q = questions[idx];
    let ok = false;
    if (Number(answer) === q.answer) {
      ok = true;
      setCorrect((c) => c + 1);
    }
    if (idx + 1 >= questions.length) {
      onFinish(ok ? correct + 1 : correct, questions.length);
    } else {
      setIdx(idx + 1);
      setAnswer('');
    }
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;

  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.questionProgress', { cur: idx + 1, total: questions.length })}</div>
      <form onSubmit={submit} className="game-question">
        <h2 className="game-prompt">{questions[idx].text}</h2>
        <input
          className="game-input"
          type="number"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoFocus
          placeholder={t('studentSpace.play.answerPlaceholder')}
        />
        <button className="btn btn-primary" type="submit">{t('studentSpace.play.check')}</button>
        <button className="btn" type="button" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </form>
    </div>
  );
}

function WordBuild({ onExit, onFinish, phase, result, t, lang }) {
  const WORDS = lang === 'ar' ? WORDS_AR : WORDS_EN;
  const [rounds] = useState(() => shuffle(WORDS).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [letters, setLetters] = useState(() => shuffle(rounds[0].split('')));
  const [input, setInput] = useState('');
  const [correct, setCorrect] = useState(0);

  const next = () => {
    if (idx + 1 >= rounds.length) {
      onFinish(correct, rounds.length);
    } else {
      setIdx(idx + 1);
      setLetters(shuffle(rounds[idx + 1].split('')));
      setInput('');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === rounds[idx].toLowerCase()) {
      setCorrect((c) => c + 1);
    }
    next();
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;

  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.wordProgress', { cur: idx + 1, total: rounds.length })}</div>
      <form onSubmit={submit} className="game-question">
        <div className="letter-tiles">
          {letters.map((l, i) => (
            <span key={i} className="letter-tile">{l}</span>
          ))}
        </div>
        <input
          className="game-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          placeholder={t('studentSpace.play.wordPlaceholder')}
        />
        <button className="btn btn-primary" type="submit">{t('studentSpace.play.check')}</button>
        <button className="btn" type="button" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </form>
    </div>
  );
}

function MemoryGame({ onExit, onFinish, phase, result, t }) {
  const [pairs] = useState(() => shuffle([...MEMORY_ICONS, ...MEMORY_ICONS].map((icon, id) => ({ id, icon }))));
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      const cardA = pairs.find((c) => c.id === a);
      const cardB = pairs.find((c) => c.id === b);
      if (cardA.icon === cardB.icon) {
        setMatched((m) => new Set([...m, a, b]));
      }
      setTimeout(() => setFlipped([]), 600);
    }
  }, [flipped, pairs]);

  useEffect(() => {
    if (matched.size === pairs.length && pairs.length > 0 && !doneRef.current) {
      doneRef.current = true;
      onFinish(Math.max(1, 12 - moves), 12);
    }
  }, [matched, pairs, moves, onFinish]);

  const click = (id) => {
    if (flipped.length === 2 || flipped.includes(id) || matched.has(id)) return;
    setFlipped([...flipped, id]);
    setMoves((m) => m + 1);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;

  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.attemptsLabel', { n: moves })}</div>
      <div className="memory-grid">
        {pairs.map((c) => {
          const isUp = flipped.includes(c.id) || matched.has(c.id);
          return (
            <button key={c.id} className={`memory-card ${isUp ? 'up' : ''}`} onClick={() => click(c.id)}>
              {isUp ? c.icon : '?'}
            </button>
          );
        })}
      </div>
      <div className="btn-group">
        <button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </div>
    </div>
  );
}

export default PlayZone;
