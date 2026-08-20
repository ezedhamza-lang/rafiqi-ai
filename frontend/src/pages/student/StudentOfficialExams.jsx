import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

function ResultCriteriaTable({ result, t }) {
  if (!result?.criteria) return null;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('studentSpace.officialExams.criteriaCol')}</th>
            <th>{t('studentSpace.officialExams.resultCol')}</th>
            <th>{t('studentSpace.officialExams.pointsCol')}</th>
          </tr>
        </thead>
        <tbody>
          {result.criteria.map((c) => (
            <tr key={c.criterion}>
              <td>{c.label || c.criterion}</td>
              <td>{c.masteryLabel}</td>
              <td>{c.earned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentOfficialExams({ onChanged }) {
  const { t } = useI18n();
  const [exams, setExams] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/teacher/student/official-exams')
      .then(setExams)
      .catch(() => {});
  }, []);

  const startExam = async (exam) => {
    setError('');
    setActive(exam);
    setAnswers({});
    setResult(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post(`/teacher/student/official-exams/${active.id}/submit`, { answers });
      setResult(res);
      setActive(null);
      setExams((xs) => xs.map((x) => (x.id === active.id ? { ...x, done: true, mySubmission: res } : x)));
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const total = result.result?.total ?? result.score;
    const totalMax = result.result?.totalMax ?? 20;
    const percent = totalMax ? Math.round((total / totalMax) * 100) : 0;
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{t('studentSpace.officialExams.resultTitle')}</h3>
        </div>
        <div className={`result-big ${percent >= 70 ? 'good' : percent >= 45 ? 'warn' : 'bad'}`}>
          {total} / {totalMax}
        </div>
        <p className="muted">{t('studentSpace.officialExams.percentLabel', { n: percent })}</p>
        {result.result?.needsManualGrading && (
          <div className="form-error">
            {t('studentSpace.officialExams.manualGradingNotice')}
          </div>
        )}
        <div className="form-group">
          <label>{t('studentSpace.officialExams.criteriaTableLabel')}</label>
          <ResultCriteriaTable result={result.result} t={t} />
        </div>
        {result.newBadges?.length > 0 && (
          <div className="new-badges">
            <h4>{t('studentSpace.officialExams.newBadges')}</h4>
            {result.newBadges.map((b) => (
              <span key={b.id} className="badge-chip">
                {b.icon} {b.name}
              </span>
            ))}
          </div>
        )}
        <button className="btn" onClick={() => setResult(null)}>{t('studentSpace.officialExams.back')}</button>
      </div>
    );
  }

  if (active) {
    const content = active.content || {};
    return (
      <form className="panel" onSubmit={submit}>
        <div className="panel-head">
          <h3>{active.title}</h3>
          <button type="button" className="btn" onClick={() => setActive(null)}>{t('studentSpace.officialExams.cancel')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}

        {content.passages?.length > 0 && (
          <div className="form-group">
            <label>{t('studentSpace.officialExams.passages')}</label>
            {content.passages.map((p) => (
              <div key={p.id} className="card-item">
                <h5>{p.title}</h5>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        )}

        {(content.questions || []).map((q, qi) => (
          <div key={q.id} className="stage-item quiz-question">
            <p><strong>{qi + 1}. {q.prompt}</strong></p>
            {q.type === 'MCQ' && (
              <div className="quiz-options">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="quiz-option">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'TRUE_FALSE' && (
              <div className="quiz-options">
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="صواب" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('time.trueLabel')}
                </label>
                <label className="quiz-option">
                  <input type="radio" name={q.id} value="خطأ" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  {t('time.falseLabel')}
                </label>
              </div>
            )}
            {q.type === 'ORDER' && (
              <div className="form-group">
                <input
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value.split(',') })}
                  placeholder={t('studentSpace.officialExams.orderPlaceholder')}
                />
              </div>
            )}
            {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
              <div className="form-group">
                <input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={t('studentSpace.officialExams.answerPlaceholder')} />
              </div>
            )}
            {q.type === 'OPEN' && (
              <div className="form-group">
                <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={t('studentSpace.officialExams.openPlaceholder')} />
              </div>
            )}
          </div>
        ))}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? t('studentSpace.officialExams.submitting') : t('studentSpace.officialExams.submit')}
        </button>
      </form>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.officialExams.title')}</h3>
      </div>
      {exams.length === 0 ? (
        <div className="empty">{t('studentSpace.officialExams.empty')}</div>
      ) : (
        <div className="cards-grid">
          {exams.map((x) => (
            <div key={x.id} className={`card-item ${x.done ? 'done' : ''}`}>
              <h4>{x.title}</h4>
              <p className="sub">
                {x.subject} — {x.trimester ? t('studentSpace.officialExams.trimester', { n: x.trimester }) : ''}
              </p>
              {x.done && x.mySubmission ? (
                <div>
                  <span className="badge good">{t('studentSpace.officialExams.done')}</span>
                  {x.mySubmission.score !== null && (
                    <p className="muted">{t('studentSpace.officialExams.yourScore', { score: x.mySubmission.score })}</p>
                  )}
                </div>
              ) : (
                <button className="btn btn-primary" onClick={() => startExam(x)}>{t('studentSpace.officialExams.start')}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
