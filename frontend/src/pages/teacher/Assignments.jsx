import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDate as fmtDate } from '../../utils/formatUtils.js';

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

const emptyForm = () => ({
  title: '',
  subject: 'MATH',
  classId: '',
  description: '',
  dueDate: '',
  status: 'PUBLISHED',
  questions: [blankQuestion(1)]
});

export default function Assignments({ classes, onChanged }) {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState([]);
  const [view, setView] = useState('list');
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState('');
  const [grading, setGrading] = useState(null);



  const load = useCallback(() => {
    api
      .get('/teacher/assignments')
      .then(setAssignments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setForm(emptyForm());
    setEditing(null);
    setView('form');
  };

  const startEdit = (a) => {
    setForm({
      title: a.title,
      subject: a.subject,
      classId: a.classId ? String(a.classId) : '',
      description: a.description || '',
      dueDate: a.dueDate ? a.dueDate.slice(0, 16) : '',
      status: a.status,
      questions: a.questions.map((q) => ({
        ...q,
        options: q.options || ['', '', '', ''],
        orderItems: q.orderItems || []
      }))
    });
    setEditing(a);
    setView('form');
  };

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
    const payload = {
      title: form.title,
      subject: form.subject,
      classId: form.classId || undefined,
      description: form.description || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      status: form.status,
      questions: form.questions.map((q) => ({
        ...q,
        options: q.type === 'MCQ' ? q.options.filter((o) => o) : undefined,
        correctOption: q.type === 'MCQ' ? q.correctOption : undefined,
        correctAnswer: q.type !== 'MCQ' ? q.correctAnswer : undefined,
        orderItems: q.type === 'ORDER' ? q.orderItems || [] : undefined
      }))
    };
    try {
      if (editing) {
        await api.put(`/teacher/assignments/${editing.id}`, payload);
      } else {
        await api.post('/teacher/assignments', payload);
      }
      setView('list');
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api.del(`/teacher/assignments/${id}`);
    load();
    onChanged && onChanged();
  };

  const openTracking = async (a) => {
    try {
      const data = await api.get(`/teacher/assignments/${a.id}/submissions`);
      setTracking(data);
    } catch {
      /* ignore */
    }
  };

  const saveGrade = async (e) => {
    e.preventDefault();
    try {
      await api.put(
        `/teacher/assignments/${tracking.assignment.id}/submissions/${grading.id}`,
        { score: grading.score, feedback: grading.feedback }
      );
      setGrading(null);
      openTracking(tracking.assignment);
    } catch (err) {
      setError(err.message);
    }
  };

  if (view === 'form') {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{editing ? t('teacherSpace.assignments.editAssignment') : t('teacherSpace.assignments.newAssignmentHeader')}</h3>
          <button className="btn" onClick={() => setView('list')}>{t('teacherSpace.common.cancel')}</button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form className="card-form" onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>{t('teacherSpace.assignments.titleLabel')}</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('teacherSpace.assignments.titlePlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.assignments.subjectLabel')}</label>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {SUBJECT_CODES.map((code) => (
                  <option key={code} value={code}>{t(`teacherSpace.common.subjects.${code}`)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.assignments.classLabel')}</label>
              <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">{t('teacherSpace.common.noClass')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group grow">
              <label>{t('teacherSpace.assignments.descriptionLabel')}</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('teacherSpace.assignments.descriptionPlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.assignments.dueDateLabel')}</label>
              <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.assignments.statusLabel')}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="PUBLISHED">{t('teacherSpace.assignments.status.PUBLISHED')}</option>
                <option value="DRAFT">{t('teacherSpace.assignments.status.DRAFT')}</option>
                <option value="CLOSED">{t('teacherSpace.assignments.status.CLOSED')}</option>
              </select>
            </div>
          </div>

          <div className="questions-editor">
            {form.questions.map((q, qi) => (
              <div key={q.id} className="question-editor">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('teacherSpace.assignments.questionTypeLabel', { n: qi + 1 })}</label>
                    <select value={q.type} onChange={(e) => updateQuestion(qi, { type: e.target.value, correctOption: '', correctAnswer: '' })}>
                      {QUESTION_TYPE_CODES.map((code) => (
                        <option key={code} value={code}>{t(`teacherSpace.common.questionTypes.${code}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group grow">
                    <label>{t('teacherSpace.assignments.questionTextLabel')}</label>
                    <input required value={q.prompt} onChange={(e) => updateQuestion(qi, { prompt: e.target.value })} placeholder={t('teacherSpace.assignments.questionTextPlaceholder')} />
                  </div>
                  <div className="form-group small">
                    <label>{t('teacherSpace.assignments.pointsLabel')}</label>
                    <input type="number" min="1" value={q.points} onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) })} />
                  </div>
                </div>

                {q.type === 'MCQ' && (
                  <div className="options-row">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="option-field">
                        <input value={opt} onChange={(e) => updateQuestion(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} placeholder={t('teacherSpace.assignments.optionPlaceholder', { n: oi + 1 })} />
                        <label className="radio">
                          <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === String(oi)} onChange={() => updateQuestion(qi, { correctOption: String(oi) })} />
                          {t('teacherSpace.common.correctLabel')}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'TRUE_FALSE' && (
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
                    <label>{t('teacherSpace.assignments.orderLabel')}</label>
                    <textarea
                      value={(q.orderItems || []).join('\n')}
                      onChange={(e) => updateQuestion(qi, { orderItems: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                      placeholder={t('teacherSpace.common.orderPlaceholder')}
                    />
                  </div>
                )}

                {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
                  <div className="form-group">
                    <label>{t('teacherSpace.assignments.correctAnswerLabel')}</label>
                    <input value={q.correctAnswer} onChange={(e) => updateQuestion(qi, { correctAnswer: e.target.value })} placeholder={t('teacherSpace.assignments.correctAnswerPlaceholder')} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="btn" onClick={addQuestion}>{t('teacherSpace.assignments.addQuestion')}</button>
            <button type="submit" className="btn btn-primary">{t('teacherSpace.assignments.saveAssignment')}</button>
          </div>
        </form>
      </div>
    );
  }

  if (tracking) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>{t('teacherSpace.assignments.trackingTitle', { title: tracking.assignment.title })}</h3>
            <p className="sub">{t('teacherSpace.assignments.trackingSub', { className: tracking.assignment.class?.name || t('teacherSpace.common.noClass'), date: fmtDate(tracking.assignment.dueDate) })}</p>
          </div>
          <button className="btn" onClick={() => { setTracking(null); setError(''); }}>{t('teacherSpace.assignments.back')}</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.assignments.studentCol')}</th>
                <th>{t('teacherSpace.assignments.statusCol')}</th>
                <th>{t('teacherSpace.assignments.pointsCol')}</th>
                <th>{t('teacherSpace.assignments.percentCol')}</th>
                <th>{t('teacherSpace.assignments.resultCol')}</th>
                <th>{t('teacherSpace.assignments.noteCol')}</th>
              </tr>
            </thead>
            <tbody>
              {tracking.classStudents.map((cs) => (
                <tr key={cs.studentId}>
                  <td>{cs.firstName} {cs.lastName}</td>
                  <td>
                    {cs.submission ? (
                      <span className={`badge ${cs.submission.status === 'GRADED' ? 'good' : 'warn'}`}>
                        {cs.submission.status === 'GRADED' ? t('teacherSpace.assignments.graded') : t('teacherSpace.assignments.sent')}
                      </span>
                    ) : (
                      <span className="badge">{t('teacherSpace.assignments.notDone')}</span>
                    )}
                  </td>
                  <td>
                    {cs.submission
                      ? `${cs.submission.score ?? t('teacherSpace.common.noValue')} / ${cs.submission.totalPoints ?? t('teacherSpace.common.noValue')}`
                      : t('teacherSpace.common.noValue')}
                  </td>
                  <td>{cs.submission?.percent !== undefined && cs.submission?.percent !== null ? `${cs.submission.percent}%` : t('teacherSpace.common.noValue')}</td>
                  <td>
                    {cs.submission ? (
                      <button className="btn btn-sm" onClick={() => setGrading({ id: cs.submission.id, score: cs.submission.score ?? '', feedback: cs.submission.feedback || '' })}>
                        {t('teacherSpace.assignments.gradeOrEdit')}
                      </button>
                    ) : (
                      t('teacherSpace.common.noValue')
                    )}
                  </td>
                  <td className="muted">{cs.submission?.feedback || t('teacherSpace.common.noValue')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {grading && (
          <form className="card-form" onSubmit={saveGrade}>
            <h4>{t('teacherSpace.assignments.gradeSubmissionTitle')}</h4>
            {error && <div className="form-error">{error}</div>}
            <div className="form-row">
              <div className="form-group small">
                <label>{t('teacherSpace.assignments.scoreOutOf', { max: tracking.assignment.questions.reduce((acc, q) => acc + (Number(q.points) || 1), 0) || '...' })}</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={grading.score}
                  onChange={(e) => setGrading({ ...grading, score: e.target.value })}
                />
              </div>
              <div className="form-group grow">
                <label>{t('teacherSpace.assignments.feedbackLabel')}</label>
                <input value={grading.feedback} onChange={(e) => setGrading({ ...grading, feedback: e.target.value })} placeholder={t('teacherSpace.assignments.feedbackPlaceholder')} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setGrading(null)}>{t('teacherSpace.common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('teacherSpace.assignments.saveGrade')}</button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.assignments.title')}</h3>
        <button className="btn btn-primary" onClick={startCreate}>{t('teacherSpace.assignments.newAssignment')}</button>
      </div>

      {assignments.length === 0 ? (
        <div className="empty">{t('teacherSpace.assignments.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.assignments.titleCol')}</th>
                <th>{t('teacherSpace.assignments.subjectCol')}</th>
                <th>{t('teacherSpace.assignments.classCol')}</th>
                <th>{t('teacherSpace.assignments.questionsCol')}</th>
                <th>{t('teacherSpace.assignments.submissionsCol')}</th>
                <th>{t('teacherSpace.assignments.dueDateCol')}</th>
                <th>{t('teacherSpace.assignments.statusCol')}</th>
                <th>{t('teacherSpace.assignments.actionsCol')}</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{t(`teacherSpace.common.subjects.${a.subject}`) || a.subject}</td>
                  <td>{a.class?.name || t('teacherSpace.common.noClass')}</td>
                  <td>{a.questions.length}</td>
                  <td>{a._count.submissions}</td>
                  <td>{fmtDate(a.dueDate)}</td>
                  <td>
                    <span className={`badge ${a.status === 'PUBLISHED' ? 'good' : a.status === 'DRAFT' ? 'warn' : ''}`}>
                      {t(`teacherSpace.assignments.status.${a.status}`)}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-sm" onClick={() => openTracking(a)}>{t('teacherSpace.assignments.track')}</button>
                    <button className="btn btn-sm" onClick={() => startEdit(a)}>{t('teacherSpace.common.edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>{t('teacherSpace.common.delete')}</button>
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
