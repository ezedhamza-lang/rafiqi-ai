import { useState, useEffect } from 'react';
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

  useEffect(() => {
    api
      .get('/teacher/student/quizzes')
      .then(setQuizzes)
      .catch(() => {});
  }, []);

  const startQuiz = async (quiz) => {
    setError('');
    setActive(quiz);
    setAnswers({});
    setResult(null);
    setStartedAt(Date.now());
  };

  const submit = async (e) => {
    e.preventDefault();
    const durationSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    try {
      const res = await api.post(`/teacher/student/quizzes/${active.id}/submit`, { answers, durationSec });
      setResult(res);
      setActive(null);
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
    return (
      <form className="panel" onSubmit={submit}>
        <div className="panel-head">
          <h3>{active.title}</h3>
          <button type="button" className="btn" onClick={() => setActive(null)}>{t('studentSpace.quizzes.cancel')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {active.questions.map((q, qi) => (
          <div key={q.id} className="stage-item quiz-question">
            <p><strong>{qi + 1}. {q.prompt}</strong> {t('studentSpace.quizzes.points', { n: q.points })}</p>
            {q.type === 'MCQ' && (
              <div className="quiz-options">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="quiz-option">
                    <input type="radio" name={q.id} value={String(oi)} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'TRUE_FALSE' && (
              <div className="quiz-options">
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="TRUE" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('time.trueLabel')}
                </label>
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="FALSE" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
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
        ))}
        <button className="btn btn-primary" type="submit">{t('studentSpace.quizzes.submit')}</button>
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
