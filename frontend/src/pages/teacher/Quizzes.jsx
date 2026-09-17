import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import QuestionEditor, { SUBJECT_CODES, blankQuestion } from '../../components/QuestionEditor.jsx';

export default function Quizzes({ classes, onChanged }) {
  const { t } = useI18n();
  const [quizzes, setQuizzes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', subject: 'MATH', classId: '', questions: [blankQuestion(1)] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/teacher/quizzes')
      .then(setQuizzes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    if (!window.confirm(t('common.confirmDelete'))) return;
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

          <QuestionEditor questions={form.questions} onChange={(qs) => setForm({ ...form, questions: qs })} t={t} prefix="teacherSpace.quizzes" />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {t('teacherSpace.quizzes.saveQuiz')}
            </button>
          </div>
        </form>
      )}

      {quizzes.length === 0 && !loading ? (
        <div className="empty">{t('teacherSpace.quizzes.empty')}</div>
      ) : loading ? (
        <p className="muted">{t('common.loading')}</p>
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
