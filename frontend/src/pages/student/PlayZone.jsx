import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const GAME_CODES = [
  'QUICK_MATH', 'WORD_BUILD', 'MEMORY',
  'SCIENCE_QUIZ', 'SCIENCE_CLASSIFY', 'EXPERIMENT_STEPS',
  'ARABIC_SCRAMBLE', 'SENTENCE_BUILDER', 'FRENCH_MATCH'
];
const GAME_ICONS = {
  QUICK_MATH: 'calculate', WORD_BUILD: 'abc', MEMORY: 'grid_view',
  SCIENCE_QUIZ: 'science', SCIENCE_CLASSIFY: 'category', EXPERIMENT_STEPS: 'biotech',
  ARABIC_SCRAMBLE: 'text_fields', SENTENCE_BUILDER: 'article', FRENCH_MATCH: 'translate'
};
const GAME_SUBJECTS = {
  QUICK_MATH: 'math', WORD_BUILD: 'arabic', MEMORY: 'general',
  SCIENCE_QUIZ: 'science', SCIENCE_CLASSIFY: 'science', EXPERIMENT_STEPS: 'science',
  ARABIC_SCRAMBLE: 'arabic', SENTENCE_BUILDER: 'arabic', FRENCH_MATCH: 'french'
};
const GAME_COLORS = {
  QUICK_MATH: { gradient: 'linear-gradient(135deg, #E8A317, #F5B942)', icon: '#E8A317' },
  WORD_BUILD: { gradient: 'linear-gradient(135deg, #047857, #10B981)', icon: '#047857' },
  MEMORY: { gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', icon: '#ec4899' },
  SCIENCE_QUIZ: { gradient: 'linear-gradient(135deg, #10b981, #06b6d4)', icon: '#10b981' },
  SCIENCE_CLASSIFY: { gradient: 'linear-gradient(135deg, #14b8a6, #22d3ee)', icon: '#14b8a6' },
  EXPERIMENT_STEPS: { gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', icon: '#0ea5e9' },
  ARABIC_SCRAMBLE: { gradient: 'linear-gradient(135deg, #DC2626, #F87171)', icon: '#DC2626' },
  SENTENCE_BUILDER: { gradient: 'linear-gradient(135deg, #155EEF, #60A5FA)', icon: '#155EEF' },
  FRENCH_MATCH: { gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)', icon: '#3b82f6' }
};

/**
 * «حديقة المعرفة» — the 3D Rafiqi adventure.
 * It is NOT one of the inline React runners below: the route renders
 * KnowledgeGarden.jsx, which embeds the Three.js game (public/games +
 * vanilla JS, no build step) in an iframe with the platform header, RTL
 * layout and account intact. Same-tab navigation keeps the session, so the
 * game picks up the learner's save without a login prompt.
 */
const KNOWLEDGE_GARDEN_URL = '/games/letters-garden';

const WORDS_AR = ['قلم', 'كتاب', 'مدرسة', 'تفاحة', 'كرة', 'سيارة', 'شمس', 'بحر', 'منزل', 'وردة', 'طائر', 'سمكة'];
const WORDS_EN = ['pen', 'book', 'school', 'apple', 'ball', 'car', 'sun', 'sea', 'house', 'rose', 'bird', 'fish'];
const MEMORY_ICONS = ['🍎', '🚀', '⭐', '🌈', '🐱', '🎈', '🌺', '🔥'];

const SCIENCE_QUIZ_QUESTIONS = [
  { q: 'ما هو أكبر كوكب في المجموعة الشمسية؟', opts: ['المشتري', 'زحل', 'الأرض', 'المريخ'], a: 0 },
  { q: 'كم عدد أرجل العنكبوت؟', opts: ['6', '8', '10', '12'], a: 1 },
  { q: 'ما هو الغاز الذي نتنفسه؟', opts: ['النيتروجين', 'الأكسجين', 'ثاني أكسيد الكربون', 'الهيدروجين'], a: 1 },
  { q: 'ما هو المحيط الأكبر في العالم؟', opts: ['الأطلسي', 'الهادئ', 'الهندي', 'الشمال'], a: 1 },
  { q: 'كم عدد عظام جسم الإنسان البالغ؟', opts: ['186', '206', '256', '306'], a: 1 },
  { q: 'ما هو الحيوان الأسرع في العالم؟', opts: ['الأسد', 'الفهد', 'الحصان', 'النسر'], a: 1 },
  { q: 'ما هي المرحلة الأولى من دورة حياة النبات؟', opts: ['البذرة', 'الزهرة', 'الثمرة', 'الجذور'], a: 0 },
  { q: 'أين يُصنع الغذاء في النبات؟', opts: ['الجذور', 'الساق', 'الأوراق', 'الزهرة'], a: 2 },
  { q: 'ما هو خليط الماء والملح يُسمى؟', opts: ['محاليل', 'غاز', 'معادن', 'أحماض'], a: 0 },
  { q: 'كم عدد أضلاع المثلث؟', opts: ['2', '3', '4', '5'], a: 1 },
];

const SCIENCE_CLASSIFY_ITEMS = [
  { item: 'القط', group: 'حي', groups: ['حي', 'غير حي'] },
  { item: 'الحجر', group: 'غير حي', groups: ['حي', 'غير حي'] },
  { item: 'الشمس', group: 'غير حي', groups: ['حي', 'غير حي'] },
  { item: 'الكلب', group: 'حي', groups: ['حي', 'غير حي'] },
  { item: 'الزهرة', group: 'حي', groups: ['حي', 'غير حي'] },
  { item: 'الكتاب', group: 'غير حي', groups: ['حي', 'غير حي'] },
  { item: 'الماء', group: 'سائل', groups: ['سائل', 'صلب', 'غاز'] },
  { item: 'الحديد', group: 'صلب', groups: ['سائل', 'صلب', 'غاز'] },
  { item: 'الهواء', group: 'غاز', groups: ['سائل', 'صلب', 'غاز'] },
  { item: 'الزيت', group: 'سائل', groups: ['سائل', 'صلب', 'غاز'] },
  { item: 'المغناطيس', group: 'موصل', groups: ['موصل', 'عازل'] },
  { item: 'المطاط', group: 'عازل', groups: ['موصل', 'عازل'] },
  { item: 'النحاس', group: 'موصل', groups: ['موصل', 'عازل'] },
  { item: 'الزجاج', group: 'عازل', groups: ['موصل', 'عازل'] },
];

const EXPERIMENT_STEPS_DATA = [
  { title: 'تجربة نمو البذرة', steps: ['نحضر اناءاً بالتراب', 'نزرع البذرة في التراب', 'نضيف الماء بانتظام', 'نضع الاناء في الشمس', 'نراقب النمو يوماً بيوم'] },
  { title: 'تجربة الماء والزيت', steps: ['نملأ كأساً بالماء', 'نضيف القليل من الزيت', 'نراقب أن الزيت يطفو', 'نخلط بالملعقة', 'ننتظر قليلاً ونرى الفصل'] },
  { title: 'تجربة المغناطيس', steps: ['نحضر مغناطيساً', 'نقرّبه من الابرة الحديدية', 'نرى أن الإبرة تلتصق', 'نقرّبه من البلاستيك', 'نرى أن البلاستيك لا يلتصق'] },
  { title: 'تجربة التبخر', steps: ['نملأ قطراً بالماء', 'نضعه على النار', 'ننتظر حتى يغلي', 'نرى بخار الماء يصعد', 'نرى الماء يتقلص'] },
];

const ARABIC_SCRAMBLE_WORDS = [
  { word: 'قلم', hint: 'نكتب به' },
  { word: 'كتاب', hint: 'نقرأ فيه' },
  { word: 'مدرسة', hint: 'نتعلم فيها' },
  { word: 'شمس', hint: 'تشرق في الصباح' },
  { word: 'ماء', hint: 'نشربه' },
  { word: 'بيت', hint: 'نسكن فيه' },
  { word: 'يد', hint: 'نمسك بها' },
  { word: 'عين', hint: 'نرى بها' },
  { word: 'قلب', hint: 'ينبض في صدرنا' },
  { word: 'سماء', hint: 'فوقنا' },
];

const SENTENCE_DATA = [
  { words: ['الطالب', 'يذهب', 'إلى', 'المدرسة'], hint: '每天上学' },
  { words: ['الشمس', 'تشرق', 'في', 'الصباح'], hint: '每天早上' },
  { words: ['الأم', 'طبخت', 'طعاماً', 'لذيذاً'], hint: '妈妈做饭' },
  { words: ['القط', 'يجلس', 'على', 'الكرسي'], hint: '猫坐在椅子上' },
  { words: ['نحب', 'بلدنا', 'تونس', 'الكثير'], hint: '我们爱突尼斯' },
  { words: ['المعلم', 'يشرح', 'درسالعلوم', 'للتلاميذ'], hint: '老师讲课' },
];

const FRENCH_MATCH_DATA = [
  { fr: 'Bonjour', ar: 'مرحبا', hint: 'تحية' },
  { fr: 'Merci', ar: 'شكرا', hint: 'امتنان' },
  { fr: 'Oui', ar: 'نعم', hint: 'إيجاب' },
  { fr: 'Non', ar: 'لا', hint: 'نفي' },
  { fr: 'Chat', ar: 'قط', hint: 'حيوان' },
  { fr: 'Chien', ar: 'كلب', hint: 'حيوان' },
  { fr: 'Maison', ar: 'بيت', hint: 'مكان' },
  { fr: 'École', ar: 'مدرسة', hint: 'مكان' },
  { fr: 'Pomme', ar: 'تفاحة', hint: 'فاكهة' },
  { fr: 'Livre', ar: 'كتاب', hint: 'شيء' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

function PlayZone() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');

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

  useEffect(() => { load(); }, [load]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const finishGame = async (game, payload) => {
    try {
      const res = await api.post('/teacher/student/games', { game, ...payload });
      if (res.remainingToday === 0) flash(t('studentSpace.play.gamesDoneToday'));
      else flash(t('studentSpace.play.gainedXp', { n: res.gained?.xp }));
      load();
    } catch (err) { flash(err.message); }
  };

  const SUBJECTS = [
    { code: 'all', icon: 'sports_esports', label: 'الكل' },
    { code: 'math', icon: 'calculate', label: 'الرياضيات' },
    { code: 'science', icon: 'science', label: 'العلوم' },
    { code: 'arabic', icon: 'text_fields', label: 'العربية' },
    { code: 'french', icon: 'translate', label: 'الفرنسية' },
  ];

  const filteredGames = filterSubject === 'all'
    ? GAME_CODES
    : GAME_CODES.filter((g) => GAME_SUBJECTS[g] === filterSubject);

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
          <div className="subject-tabs" style={{ marginBottom: '1rem' }}>
            {SUBJECTS.map((s) => (
              <button
                key={s.code}
                className={`subject-tab ${filterSubject === s.code ? 'active' : ''}`}
                style={filterSubject === s.code ? { background: 'var(--primary)', color: '#fff' } : {}}
                onClick={() => setFilterSubject(s.code)}
              >
                <span className="material-icons">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* ---- featured: the 3D Rafiqi adventure ---- */}
          <div
            className="card-item game-card card-glow"
            style={{
              marginBottom: '1.25rem',
              borderTop: '4px solid #1f4e9c',
              background: 'linear-gradient(135deg, #1f4e9c0d 0%, #2f7fe014 45%, #fff 100%)',
              textAlign: 'start',
            }}
          >
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                className="material-icons"
                style={{ fontSize: '3.2rem', color: '#1f4e9c' }}
                aria-hidden="true"
              >
                forest
              </span>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0 }}>{t('studentSpace.play.games.KNOWLEDGE_GARDEN.title')}</h4>
                  <span className="badge" style={{ background: '#f0a91c', color: '#5a3d00' }}>
                    {t('studentSpace.play.games.KNOWLEDGE_GARDEN.badge')}
                  </span>
                </div>
                <p className="muted" style={{ margin: '.25rem 0' }}>
                  {t('studentSpace.play.games.KNOWLEDGE_GARDEN.desc')}
                </p>
                <small className="muted">{t('studentSpace.play.games.KNOWLEDGE_GARDEN.tagline')}</small>
              </div>
              <a
                className="btn btn-primary btn-ripple"
                href={KNOWLEDGE_GARDEN_URL}
                onClick={() => setToast(t('studentSpace.play.games.KNOWLEDGE_GARDEN.open'))}
              >
                {t('studentSpace.play.games.KNOWLEDGE_GARDEN.open')} ↗
              </a>
            </div>
          </div>

          <div className="cards-grid slide-up-stagger">
            {filteredGames.map((code) => (
              <div key={code} className="card-item game-card card-glow wiggle-hover" style={{ borderTop: `4px solid ${GAME_COLORS[code].icon}`, background: `linear-gradient(180deg, ${GAME_COLORS[code].icon}08 0%, #fff 100%)` }}>
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
                        <td><span className="badge good">{h.score} {t('studentSpace.play.pointsSuffix')}</span></td>
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
                        <td><span className={`rank-badge ${r.rank <= 3 ? `rank-${r.rank}` : ''}`}>{r.rank}</span></td>
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
        <GameRunner code={activeGame} onExit={() => setActiveGame(null)} onFinish={finishGame} t={t} lang={lang} />
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

  switch (code) {
    case 'QUICK_MATH': return <QuickMath onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'WORD_BUILD': return <WordBuild onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} lang={lang} />;
    case 'MEMORY': return <MemoryGame onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'SCIENCE_QUIZ': return <ScienceQuiz onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'SCIENCE_CLASSIFY': return <ScienceClassify onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'EXPERIMENT_STEPS': return <ExperimentSteps onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'ARABIC_SCRAMBLE': return <ArabicScramble onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'SENTENCE_BUILDER': return <SentenceBuilder onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    case 'FRENCH_MATCH': return <FrenchMatch onExit={onExit} onFinish={finish} phase={phase} result={result} t={t} />;
    default: return null;
  }
}

function GameResultView({ result, onExit, t }) {
  const pct = Math.round((result.correct / result.total) * 100);
  return (
    <div className="game-result">
      <div className="avg-big good">{result.correct} / {result.total}</div>
      <p className="muted">{t('studentSpace.play.correctAnswers')} — {pct}%</p>
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
    if (Number(answer) === q.answer) { ok = true; setCorrect((c) => c + 1); }
    if (idx + 1 >= questions.length) onFinish(ok ? correct + 1 : correct, questions.length);
    else { setIdx(idx + 1); setAnswer(''); }
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.questionProgress', { cur: idx + 1, total: questions.length })}</div>
      <form onSubmit={submit} className="game-question">
        <h2 className="game-prompt">{questions[idx].text}</h2>
        <input className="game-input" type="number" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus placeholder={t('studentSpace.play.answerPlaceholder')} />
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
    if (idx + 1 >= rounds.length) onFinish(correct, rounds.length);
    else { setIdx(idx + 1); setLetters(shuffle(rounds[idx + 1].split(''))); setInput(''); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === rounds[idx].toLowerCase()) setCorrect((c) => c + 1);
    next();
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.wordProgress', { cur: idx + 1, total: rounds.length })}</div>
      <form onSubmit={submit} className="game-question">
        <div className="letter-tiles">
          {letters.map((l, i) => (<span key={i} className="letter-tile">{l}</span>))}
        </div>
        <input className="game-input" value={input} onChange={(e) => setInput(e.target.value)} autoFocus placeholder={t('studentSpace.play.wordPlaceholder')} />
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
      if (cardA.icon === cardB.icon) setMatched((m) => new Set([...m, a, b]));
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
      <div className="btn-group"><button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button></div>
    </div>
  );
}

function ScienceQuiz({ onExit, onFinish, phase, result, t }) {
  const [questions] = useState(() => shuffle(SCIENCE_QUIZ_QUESTIONS).slice(0, 8));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');

  const submit = () => {
    if (selected === null) return;
    const ok = selected === questions[idx].a;
    if (ok) setCorrect((c) => c + 1);
    setFeedback(ok ? t('studentSpace.play.correctFeedback') : t('studentSpace.play.wrongFeedback'));
    setTimeout(() => {
      setFeedback('');
      if (idx + 1 >= questions.length) onFinish(ok ? correct + 1 : correct, questions.length);
      else { setIdx(idx + 1); setSelected(null); }
    }, 800);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  const q = questions[idx];
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.questionProgress', { cur: idx + 1, total: questions.length })}</div>
      <div className="game-question">
        <h2 className="game-prompt">{q.q}</h2>
        <div className="quiz-options">
          {q.opts.map((opt, i) => (
            <button key={i} className={`quiz-option ${selected === i ? 'selected' : ''} ${feedback && i === q.a ? 'correct' : ''} ${feedback && selected === i && selected !== q.a ? 'wrong' : ''}`} onClick={() => !feedback && setSelected(i)}>
              <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
        {feedback && <div className={`game-feedback ${selected === questions[idx].a ? 'good' : 'bad'}`}>{feedback}</div>}
        <div className="btn-group">
          <button className="btn btn-primary" onClick={submit} disabled={selected === null || feedback}>{t('studentSpace.play.check')}</button>
          <button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button>
        </div>
      </div>
    </div>
  );
}

function ScienceClassify({ onExit, onFinish, phase, result, t }) {
  const [items] = useState(() => shuffle(SCIENCE_CLASSIFY_ITEMS).slice(0, 8));
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');

  const classify = (group) => {
    const ok = items[idx].group === group;
    if (ok) setCorrect((c) => c + 1);
    setFeedback(ok ? t('studentSpace.play.correctFeedback') : t('studentSpace.play.wrongFeedback'));
    setTimeout(() => {
      setFeedback('');
      if (idx + 1 >= items.length) onFinish(ok ? correct + 1 : correct, items.length);
      else setIdx(idx + 1);
    }, 800);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  const item = items[idx];
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.sortOrder', { cur: idx + 1, total: items.length })}</div>
      <div className="game-question">
        <h2 className="game-prompt">{item.item}</h2>
        <div className="classify-options">
          {item.groups.map((g) => (
            <button key={g} className={`btn btn-primary classify-btn ${feedback && g === item.group ? 'correct' : ''}`} onClick={() => !feedback && classify(g)}>
              {g}
            </button>
          ))}
        </div>
        {feedback && <div className={`game-feedback ${feedback.includes('✓') ? 'good' : 'bad'}`}>{feedback}</div>}
        <div className="btn-group"><button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button></div>
      </div>
    </div>
  );
}

function ExperimentSteps({ onExit, onFinish, phase, result, t }) {
  const [experiment] = useState(() => EXPERIMENT_STEPS_DATA[Math.floor(Math.random() * EXPERIMENT_STEPS_DATA.length)]);
  const [steps, setSteps] = useState(() => shuffle(experiment.steps.map((s, i) => ({ id: i, text: s }))));

  const move = (from, dir) => {
    const to = from + dir;
    if (to < 0 || to >= steps.length) return;
    const arr = [...steps];
    [arr[from], arr[to]] = [arr[to], arr[from]];
    setSteps(arr);
  };

  const checkOrder = () => {
    let c = 0;
    steps.forEach((s, i) => { if (s.id === i) c++; });
    onFinish(c, steps.length);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <h3 className="game-prompt">{experiment.title}</h3>
      <p className="muted" style={{ marginBottom: '1rem' }}>{t('studentSpace.play.sortOrder', { cur: steps.length, total: steps.length })}</p>
      <div className="steps-list">
        {steps.map((s, i) => (
          <div key={s.id} className={`step-item ${s.id === i ? 'correct-pos' : ''}`}>
            <span className="step-num">{i + 1}</span>
            <span className="step-text">{s.text}</span>
            <div className="step-arrows">
              <button className="btn btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
              <button className="btn btn-sm" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>▼</button>
            </div>
          </div>
        ))}
      </div>
      <div className="btn-group" style={{ marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={checkOrder}>{t('studentSpace.play.check')}</button>
        <button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </div>
    </div>
  );
}

function ArabicScramble({ onExit, onFinish, phase, result, t }) {
  const [rounds] = useState(() => shuffle(ARABIC_SCRAMBLE_WORDS).slice(0, 6));
  const [idx, setIdx] = useState(0);
  const [letters, setLetters] = useState(() => shuffle(rounds[0].word.split('')));
  const [input, setInput] = useState('');
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');

  const next = () => {
    if (idx + 1 >= rounds.length) onFinish(correct, rounds.length);
    else { setIdx(idx + 1); setLetters(shuffle(rounds[idx + 1].word.split(''))); setInput(''); setFeedback(''); }
  };

  const submit = (e) => {
    e.preventDefault();
    const ok = input.trim() === rounds[idx].word;
    if (ok) setCorrect((c) => c + 1);
    setFeedback(ok ? t('studentSpace.play.correctFeedback') : `${t('studentSpace.play.wrongFeedback')} — ${rounds[idx].word}`);
    setTimeout(next, 1000);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.wordProgress', { cur: idx + 1, total: rounds.length })}</div>
      <form onSubmit={submit} className="game-question">
        <p className="muted" style={{ marginBottom: '0.5rem' }}>{rounds[idx].hint}</p>
        <div className="letter-tiles">
          {letters.map((l, i) => (<span key={i} className="letter-tile">{l}</span>))}
        </div>
        <input className="game-input" value={input} onChange={(e) => setInput(e.target.value)} autoFocus placeholder={t('studentSpace.play.wordPlaceholder')} />
        {feedback && <div className={`game-feedback ${feedback.includes('✓') ? 'good' : 'bad'}`}>{feedback}</div>}
        <button className="btn btn-primary" type="submit">{t('studentSpace.play.check')}</button>
        <button className="btn" type="button" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </form>
    </div>
  );
}

function SentenceBuilder({ onExit, onFinish, phase, result, t }) {
  const [rounds] = useState(() => shuffle(SENTENCE_DATA).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [pool, setPool] = useState(() => shuffle(rounds[0].words.map((w, i) => ({ id: i, word: w }))));
  const [placed, setPlaced] = useState([]);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');

  const addToSentence = (w) => {
    setPool((p) => p.filter((x) => x.id !== w.id));
    setPlaced((p) => [...p, w]);
  };

  const removeFromSentence = (w) => {
    setPlaced((p) => p.filter((x) => x.id !== w.id));
    setPool((p) => [...p, w]);
  };

  const nextRound = () => {
    if (idx + 1 >= rounds.length) onFinish(correct, rounds.length);
    else {
      setIdx(idx + 1);
      setPool(shuffle(rounds[idx + 1].words.map((w, i) => ({ id: i, word: w }))));
      setPlaced([]);
      setFeedback('');
    }
  };

  const checkSentence = () => {
    const built = placed.map((w) => w.word).join(' ');
    const answer = rounds[idx].words.join(' ');
    const ok = built === answer;
    if (ok) setCorrect((c) => c + 1);
    setFeedback(ok ? t('studentSpace.play.correctFeedback') : `${t('studentSpace.play.wrongFeedback')} — ${answer}`);
    setTimeout(nextRound, 1200);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.wordProgress', { cur: idx + 1, total: rounds.length })}</div>
      <div className="game-question">
        <p className="muted">{rounds[idx].hint}</p>
        <div className="sentence-placed">
          {placed.map((w) => (
            <button key={w.id} className="sentence-word placed" onClick={() => removeFromSentence(w)}>{w.word}</button>
          ))}
          {placed.length === 0 && <span className="muted">اضغط الكلمات لتجميع الجملة</span>}
        </div>
        <div className="sentence-pool">
          {pool.map((w) => (
            <button key={w.id} className="sentence-word" onClick={() => addToSentence(w)}>{w.word}</button>
          ))}
        </div>
        {feedback && <div className={`game-feedback ${feedback.includes('✓') ? 'good' : 'bad'}`}>{feedback}</div>}
        <div className="btn-group">
          <button className="btn btn-primary" onClick={checkSentence} disabled={pool.length > 0}>{t('studentSpace.play.check')}</button>
          <button className="btn" onClick={onExit}>{t('studentSpace.play.finish')}</button>
        </div>
      </div>
    </div>
  );
}

function FrenchMatch({ onExit, onFinish, phase, result, t }) {
  const [pairs] = useState(() => shuffle(FRENCH_MATCH_DATA).slice(0, 6));
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('');

  const next = () => {
    if (idx + 1 >= pairs.length) onFinish(correct, pairs.length);
    else { setIdx(idx + 1); setInput(''); setFeedback(''); }
  };

  const submit = (e) => {
    e.preventDefault();
    const ok = input.trim() === pairs[idx].ar;
    if (ok) setCorrect((c) => c + 1);
    setFeedback(ok ? t('studentSpace.play.correctFeedback') : `${t('studentSpace.play.wrongFeedback')} — ${pairs[idx].ar}`);
    setTimeout(next, 1000);
  };

  if (phase === 'done') return <GameResultView result={result} onExit={onExit} t={t} />;
  return (
    <div className="game-play">
      <div className="game-progress">{t('studentSpace.play.wordProgress', { cur: idx + 1, total: pairs.length })}</div>
      <form onSubmit={submit} className="game-question">
        <h2 className="game-prompt" style={{ fontSize: '2rem' }}>{pairs[idx].fr}</h2>
        <p className="muted">{pairs[idx].hint}</p>
        <input className="game-input" value={input} onChange={(e) => setInput(e.target.value)} autoFocus placeholder={t('studentSpace.play.wordPlaceholder')} dir="rtl" />
        {feedback && <div className={`game-feedback ${feedback.includes('✓') ? 'good' : 'bad'}`}>{feedback}</div>}
        <button className="btn btn-primary" type="submit">{t('studentSpace.play.check')}</button>
        <button className="btn" type="button" onClick={onExit}>{t('studentSpace.play.finish')}</button>
      </form>
    </div>
  );
}

export default PlayZone;
