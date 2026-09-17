import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECT_CODES = ['MATH', 'READING', 'SCIENCE', 'STORIES'];
const QUESTION_TYPE_CODES = ['MCQ', 'TRUE_FALSE', 'ORDER', 'EXTRACT', 'FILL_BLANK'];

const blankQuestion = (id) => ({
  id: `q${id}`,
  type: 'MCQ',
  prompt: '',
  points: 1,
  options: ['', '', '', ''],
  correctOption: '',
  correctAnswer: ''
});

export default function Quizzes({ classes, onChanged }) {
  const { t } = useI18n();
  const [quizzes, setQuizzes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', subject: 'MATH', classId: '', questions: [blankQuestion(1)] });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/teacher/quizzes')
      .then(setQuizzes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addQuestion = () => {
    setForm((f) => ({ ...f, questions: [...f.questions, blankQuestion(f.questions.length + 1)] }));
  };

  const updateQuestion = (idx, patch) => {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/teacher/quizzes', {
        title: form.title,
        subject: form.subject,
        classId: form.classId || undefined,
        questions: form.questions.map((q) => ({
          ...q,
          options: q.type === 'MCQ' ? q.options.filter((o) => o) : undefined,
          correctOption: q.type === 'MCQ' ? q.correctOption : undefined,
          correctAnswer: q.type !== 'MCQ' ? q.correctAnswer : undefined,
          orderItems: q.type === 'ORDER' ? q.orderItems || [] : undefined
        }))
      });
      setShowForm(false);
      setForm({ title: '', subject: 'MATH', classId: '', questions: [blankQuestion(1)] });
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/teacher/quizzes/${id}`);
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.quizzes.title')}</h3>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? t('teacherSpace.quizzes.cancel') : t('teacherSpace.quizzes.newQuiz')}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {showForm && (
        <form className="card-form" onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>{t('teacherSpace.quizzes.titleLabel')}</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('teacherSpace.quizzes.titlePlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.quizzes.subjectLabel')}</label>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {SUBJECT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {t(`teacherSpace.common.subjects.${code}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.quizzes.classOptionalLabel')}</label>
              <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">{t('teacherSpace.common.noClass')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="questions-editor">
            {form.questions.map((q, qi) => (
              <div key={q.id} className="question-editor">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('teacherSpace.quizzes.questionTypeLabel', { n: qi + 1 })}</label>
                    <select value={q.type} onChange={(e) => updateQuestion(qi, { type: e.target.value, correctOption: '', correctAnswer: '' })}>
                      {QUESTION_TYPE_CODES.map((code) => (
                        <option key={code} value={code}>
                          {t(`teacherSpace.common.questionTypes.${code}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group grow">
                    <label>{t('teacherSpace.quizzes.questionTextLabel')}</label>
                    <input required value={q.prompt} onChange={(e) => updateQuestion(qi, { prompt: e.target.value })} placeholder={t('teacherSpace.quizzes.questionTextPlaceholder')} />
                  </div>
                  <div className="form-group small">
                    <label>{t('teacherSpace.quizzes.pointsLabel')}</label>
                    <input type="number" min="1" value={q.points} onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })} />
                  </div>
                </div>

                {q.type === 'MCQ' && (
                  <div className="options-row">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="option-field">
                        <input value={opt} onChange={(e) => updateQuestion(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} placeholder={t('teacherSpace.quizzes.optionPlaceholder', { n: oi + 1 })} />
                        <label className="radio">
                          <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === String(oi)} onChange={() => updateQuestion(qi, { correctOption: String(oi) })} />
                          {t('teacherSpace.common.correctLabel')}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {(q.type === 'TRUE_FALSE') && (
                  <div className="form-row">
                    <label className="radio">
                      <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === 'TRUE'} onChange={() => updateQuestion(qi, { correctAnswer: 'TRUE' })} />
                      {t('teacherSpace.common.correctLabel')}
                    </label>
                    <label className="radio">
                      <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === 'FALSE'} onChange={() => updateQuestion(qi, { correctAnswer: 'FALSE' })} />
                      {t('time.falseLabel')}
                    </label>
                  </div>
                )}

                {q.type === 'ORDER' && (
                  <div className="form-group">
                    <label>{t('teacherSpace.quizzes.orderLabel')}</label>
                    <textarea
                      value={(q.orderItems || []).join('\n')}
                      onChange={(e) => updateQuestion(qi, { orderItems: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                      placeholder={t('teacherSpace.common.orderPlaceholder')}
                    />
                  </div>
                )}

                {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
                  <div className="form-group">
                    <label>{t('teacherSpace.quizzes.correctAnswerLabel')}</label>
                    <input value={q.correctAnswer} onChange={(e) => updateQuestion(qi, { correctAnswer: e.target.value })} placeholder={t('teacherSpace.quizzes.correctAnswerPlaceholder')} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={addQuestion}>
              {t('teacherSpace.quizzes.addQuestion')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('teacherSpace.quizzes.saveQuiz')}
            </button>
          </div>
        </form>
      )}

      {quizzes.length === 0 ? (
        <div className="empty">{t('teacherSpace.quizzes.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.quizzes.titleCol')}</th>
                <th>{t('teacherSpace.quizzes.subjectCol')}</th>
                <th>{t('teacherSpace.quizzes.classCol')}</th>
                <th>{t('teacherSpace.quizzes.questionsCol')}</th>
                <th>{t('teacherSpace.quizzes.attemptsCol')}</th>
                <th>{t('teacherSpace.quizzes.actionsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{t(`teacherSpace.common.subjects.${q.subject}`) || q.subject}</td>
                  <td>{q.class?.name || t('teacherSpace.quizzes.allClassesShort')}</td>
                  <td>{q.questions.length}</td>
                  <td>{q._count?.submissions ?? 0}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(q.id)}>
                      {t('teacherSpace.quizzes.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
