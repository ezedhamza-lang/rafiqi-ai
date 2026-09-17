import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function StudentQuizzes({ onChanged }) {
  const { t } = useI18n();
  const [quizzes, setQuizzes] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    api
      .get('/teacher/student/quizzes')
      .then(setQuizzes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active || !startedAt) return;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [active, startedAt]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const startQuiz = async (quiz) => {
    setError('');
    setActive(quiz);
    setAnswers({});
    setResult(null);
    setStartedAt(Date.now());
    setCurrentQ(0);
    setElapsed(0);
  };

  const submit = async (e) => {
    e.preventDefault();
    clearInterval(timerRef.current);
    const durationSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    try {
      const res = await api.post(`/teacher/student/quizzes/${active.id}/submit`, { answers, durationSec });
      setResult(res);
      setActive(null);
      setStartedAt(null);
      setQuizzes((qs) => qs.map((q) => (q.id === active.id ? { ...q, done: true } : q)));
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  if (result) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{t('studentSpace.quizzes.resultTitle')}</h3>
        </div>
        <div className={`result-big ${result.percent >= 70 ? 'good' : result.percent >= 45 ? 'warn' : 'bad'}`}>
          {result.percent}%
        </div>
        <p className="muted">{t('studentSpace.quizzes.resultScore', { score: result.score, total: result.totalPoints })}</p>
        <p className="muted">{t('studentSpace.quizzes.timeSpent', { time: formatTime(elapsed || result.durationSec || 0) })}</p>
        {result.newBadges?.length > 0 && (
          <div className="new-badges">
            <h4>{t('studentSpace.quizzes.newBadges')}</h4>
            {result.newBadges.map((b) => (
              <span key={b.id} className="badge-chip">
                {b.icon} {b.name}
              </span>
            ))}
          </div>
        )}
        <button className="btn" onClick={() => setResult(null)}>{t('studentSpace.quizzes.back')}</button>
      </div>
    );
  }

  if (active) {
    const q = active.questions[currentQ];
    const total = active.questions.length;
    return (
      <form className="panel" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h3>{active.title}</h3>
            <p className="muted" style={{ margin: 0 }}>{currentQ + 1} / {total} — ⏱ {formatTime(elapsed)}</p>
          </div>
          <button type="button" className="btn" onClick={() => { clearInterval(timerRef.current); setActive(null); }}>{t('studentSpace.quizzes.cancel')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {q && (
          <div key={q.id} className="stage-item quiz-question">
            <p><strong>{currentQ + 1}. {q.prompt}</strong> {t('studentSpace.quizzes.points', { n: q.points })}</p>
            {q.type === 'MCQ' && (
              <div className="quiz-options">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="quiz-option">
                    <input type="radio" name={q.id} value={String(oi)} checked={answers[q.id] === String(oi)} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'TRUE_FALSE' && (
              <div className="quiz-options">
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="TRUE" checked={answers[q.id] === 'TRUE'} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('time.trueLabel')}
                </label>
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="FALSE" checked={answers[q.id] === 'FALSE'} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('time.falseLabel')}
                </label>
              </div>
            )}
            {q.type === 'ORDER' && (
              <div className="form-group">
                <input value={(answers[q.id] || []).join(', ')} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value.split(',').map((s) => s.trim()) })} placeholder={t('studentSpace.quizzes.orderPlaceholder')} />
              </div>
            )}
            {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
              <div className="form-group">
                <input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={t('studentSpace.quizzes.answerPlaceholder')} />
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <button type="button" className="btn" disabled={currentQ === 0} onClick={() => setCurrentQ((c) => c - 1)}>
            <span className="material-icons">chevron_right</span> {t('studentSpace.quizzes.prev')}
          </button>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {active.questions.map((_, i) => (
              <button key={i} type="button" className={`btn btn-sm ${i === currentQ ? 'btn-primary' : ''}`} style={{ minWidth: 32, padding: '2px 6px' }} onClick={() => setCurrentQ(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          {currentQ < total - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setCurrentQ((c) => c + 1)}>
              {t('studentSpace.quizzes.next')} <span className="material-icons">chevron_left</span>
            </button>
          ) : (
            <button className="btn btn-primary" type="submit">{t('studentSpace.quizzes.submit')}</button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.quizzes.title')}</h3>
      </div>
      {quizzes.length === 0 ? (
        <div className="empty">{t('studentSpace.quizzes.empty')}</div>
      ) : (
        <div className="cards-grid">
          {quizzes.map((q) => (
            <div key={q.id} className={`card-item ${q.done ? 'done' : ''}`}>
              <h4>{q.title}</h4>
              <p className="sub">{t('studentSpace.quizzes.questionsCount', { subject: q.subject, n: q.questions.length })}</p>
              {q.done ? (
                <span className="badge good">{t('studentSpace.quizzes.done')}</span>
              ) : (
                <button className="btn btn-primary" onClick={() => startQuiz(q)}>{t('studentSpace.quizzes.start')}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
