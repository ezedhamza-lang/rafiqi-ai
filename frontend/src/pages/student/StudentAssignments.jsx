import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDate as fmtDate } from '../../utils/formatUtils.js';

export default function StudentAssignments({ onChanged }) {
  const { t, lang } = useI18n();
  const [assignments, setAssignments] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');



  const load = () => {
    api
      .get('/teacher/student/assignments')
      .then(setAssignments)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const start = async (a) => {
    setError('');
    setAnswers({});
    try {
      const detail = await api.get(`/teacher/student/assignments/${a.id}`);
      if (detail.submission) {
        setActive({ ...detail, view: 'result' });
      } else {
        setActive({ ...detail, view: 'form' });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const processedAnswers = {};
    for (const [qId, val] of Object.entries(answers)) {
      processedAnswers[qId] = typeof val === 'string' ? val.split(',').map((s) => s.trim()).filter(Boolean) : val;
    }
    try {
      await api.post(`/teacher/student/assignments/${active.id}/submit`, { answers: processedAnswers });
      setActive(null);
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  if (active && active.view === 'result') {
    const sub = active.submission;
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{active.title}</h3>
          <button className="btn" onClick={() => setActive(null)}>{t('studentSpace.assignments.back')}</button>
        </div>
        {sub.status === 'GRADED' ? (
          <>
            <div className={`result-big ${sub.percent >= 70 ? 'good' : sub.percent >= 45 ? 'warn' : 'bad'}`}>
              {sub.percent}%
            </div>
            <p className="muted">{t('studentSpace.assignments.scoreLine', { score: sub.score, total: sub.totalPoints })}</p>
            {sub.feedback && (
              <div className="feedback-box">
                <strong>{t('studentSpace.assignments.teacherFeedback')}</strong> {sub.feedback}
              </div>
            )}
            {Array.isArray(sub.graded) && sub.graded.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('studentSpace.assignments.questionCol')}</th>
                      <th>{t('studentSpace.assignments.pointsCol')}</th>
                      <th>{t('studentSpace.assignments.resultCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.graded.map((g) => (
                      <tr key={g.questionId}>
                        <td>{g.questionId}</td>
                        <td>{g.points}</td>
                        <td>
                          <span className={`badge ${g.correct ? 'good' : 'bad'}`}>
                            {g.correct ? t('studentSpace.assignments.correct') : t('studentSpace.assignments.incorrect')}
                          </span>
                          <span className="muted"> — {g.earned}/{g.points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="muted">{t('studentSpace.assignments.pendingGrading')}</p>
        )}
      </div>
    );
  }

  if (active && active.view === 'form') {
    return (
      <form className="panel" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h3>{active.title}</h3>
            <p className="sub">{active.description}</p>
          </div>
          <button type="button" className="btn" onClick={() => setActive(null)}>{t('studentSpace.assignments.cancel')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {active.questions.map((q, qi) => (
          <div key={q.id} className="stage-item quiz-question">
            <p><strong>{qi + 1}. {q.prompt}</strong> {t('studentSpace.assignments.points', { n: q.points })}</p>
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
                  {t('studentSpace.assignments.trueLabel')}
                </label>
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="FALSE" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('studentSpace.assignments.falseLabel')}
                </label>
              </div>
            )}
            {q.type === 'ORDER' && (
              <div className="form-group">
                <input value={typeof answers[q.id] === 'string' ? answers[q.id] : (answers[q.id] || []).join(', ')} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={t('studentSpace.assignments.orderPlaceholder')} />
              </div>
            )}
            {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
              <div className="form-group">
                <input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={t('studentSpace.assignments.answerPlaceholder')} />
              </div>
            )}
          </div>
        ))}
        <button className="btn btn-primary" type="submit">{t('studentSpace.assignments.submit')}</button>
      </form>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.assignments.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}
      {assignments.length === 0 ? (
        <div className="empty">{t('studentSpace.assignments.empty')}</div>
      ) : (
        <div className="cards-grid">
          {assignments.map((a) => (
            <div key={a.id} className={`card-item ${a.done ? 'done' : ''}`}>
              <h4>{a.title}</h4>
              <p className="sub">{t('studentSpace.assignments.questionsCount', { subject: a.subject, n: a.questions.length })}</p>
              <p className="muted">{a.description}</p>
              <p className="muted">{t('studentSpace.assignments.dueDate', { date: fmtDate(a.dueDate, lang) })}</p>
              {a.done ? (
                <div>
                  <span className="badge good">{t('studentSpace.assignments.done')}</span>
                  {a.submission?.status === 'GRADED' && (
                    <span className={`badge ${a.submission.percent >= 70 ? 'good' : a.submission.percent >= 45 ? 'warn' : 'bad'}`}>
                      {a.submission.percent}%
                    </span>
                  )}
                  <button className="btn btn-sm" style={{ marginInlineStart: 8 }} onClick={() => start(a)}>
                    {t('studentSpace.assignments.reviewResult')}
                  </button>
                </div>
              ) : (
                <div>
                  {a.overdue && <span className="badge warn">{t('studentSpace.assignments.overdue')}</span>}
                  <button className="btn btn-primary" onClick={() => start(a)}>{t('studentSpace.assignments.start')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
