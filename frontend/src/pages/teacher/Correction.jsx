import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Correction() {
  const { t, lang } = useI18n();
  const STATUS_STYLES = {
    SENT: { label: t('teacherSpace.correction.status.SENT'), cls: 'warn' },
    IN_REVIEW: { label: t('teacherSpace.correction.status.IN_REVIEW'), cls: 'warn' },
    CORRECTED: { label: t('teacherSpace.correction.status.CORRECTED'), cls: 'good' }
  };

  const LESSON_SUB_STATUS = {
    SUBMITTED: { label: t('teacherSpace.correction.lessonStatus.SUBMITTED'), cls: 'warn' },
    IN_REVIEW: { label: t('teacherSpace.correction.lessonStatus.IN_REVIEW'), cls: 'warn' },
    GRADED: { label: t('teacherSpace.correction.lessonStatus.GRADED'), cls: 'good' },
    RETURNED: { label: t('teacherSpace.correction.lessonStatus.RETURNED'), cls: 'info' }
  };

  const [submissions, setSubmissions] = useState([]);
  const [examSubs, setExamSubs] = useState([]);
  const [lessonSubs, setLessonSubs] = useState([]);
  const [suggestion, setSuggestion] = useState('');
  const [paperExams, setPaperExams] = useState([]);
  const [paperFilter, setPaperFilter] = useState('ALL');
  const [lessonFilter, setLessonFilter] = useState('ALL');
  const [grading, setGrading] = useState({});
  const [lessonGrading, setLessonGrading] = useState({});
  const [batchGrading, setBatchGrading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/teacher/submissions')
      .then(setSubmissions)
      .catch(() => {});
  }, []);

  const loadLessonSubs = useCallback(() => {
    api
      .get('/teacher/lesson-submissions')
      .then(setLessonSubs)
      .catch(() => {});
  }, []);

  const loadPaperExams = useCallback(() => {
    api
      .get('/teacher/submitted-exams')
      .then(setPaperExams)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadPaperExams();
    loadLessonSubs();
  }, [load, loadPaperExams, loadLessonSubs]);

  const loadExamSubs = async (examId) => {
    const data = await api.get(`/teacher/exams/${examId}/submissions`);
    setExamSubs(data);
  };

  const askSuggestion = async (question, studentAnswer) => {
    try {
      const res = await api.post('/ai/grade-suggestion', { question, studentAnswer });
      setSuggestion(res.suggestion);
    } catch {
      setSuggestion(t('teacherSpace.correction.aiFallback'));
    }
  };

  const saveGrade = async (id) => {
    const g = grading[id] || {};
    try {
      await api.put(`/teacher/submitted-exams/${id}`, {
        score: g.score !== '' ? Number(g.score) : undefined,
        feedback: g.feedback,
        status: g.status || 'CORRECTED'
      });
      loadPaperExams();
      setGrading((prev) => ({ ...prev, [id]: {} }));
    } catch (err) {
      setError(err.message);
    }
  };

  const startReview = async (id) => {
    try {
      await api.put(`/teacher/submitted-exams/${id}`, { status: 'IN_REVIEW' });
      loadPaperExams();
    } catch (err) {
      setError(err.message);
    }
  };

  const startLessonReview = async (id) => {
    try {
      await api.put(`/teacher/lesson-submissions/${id}`, { status: 'IN_REVIEW' });
      loadLessonSubs();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveLessonGrade = async (id) => {
    const g = lessonGrading[id] || {};
    try {
      await api.put(`/teacher/lesson-submissions/${id}`, {
        score: g.score !== '' ? Number(g.score) : undefined,
        feedback: g.feedback,
        status: g.status || 'GRADED'
      });
      loadLessonSubs();
      setLessonGrading((prev) => ({ ...prev, [id]: {} }));
    } catch (err) {
      setError(err.message);
    }
  };

  const batchGrade = async () => {
    const pendingSubs = lessonSubs.filter(s => s.status === 'SUBMITTED');
    const lessonIds = [...new Set(pendingSubs.map(s => s.lessonId))];
    if (lessonIds.length === 0) {
      setError(t('teacherSpace.correction.noPendingSubs'));
      return;
    }
    setBatchGrading(true);
    try {
      let totalGraded = 0;
      for (const lid of lessonIds) {
        const res = await api.post('/ai/batch-grade', { lessonId: lid });
        totalGraded += res.results?.length || 0;
      }
      loadLessonSubs();
    } catch (err) {
      setError(err.message || t('teacherSpace.correction.batchError'));
    } finally {
      setBatchGrading(false);
    }
  };

  const publishGrades = async (lessonId) => {
    try {
      await api.post('/ai/publish-grades', { lessonId });
      loadLessonSubs();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredPapers =
    paperFilter === 'ALL' ? paperExams : paperExams.filter((p) => p.status === paperFilter);

  const filteredLessons =
    lessonFilter === 'ALL' ? lessonSubs : lessonSubs.filter((ls) => ls.status === lessonFilter);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.correction.title')}</h3>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}

      <div className="sub-grid">
        <div className="card-item">
          <h4>{t('teacherSpace.correction.quickQuizzesTitle')}</h4>
          {submissions.length === 0 ? (
            <div className="empty">{t('teacherSpace.correction.noAttempts')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.correction.studentCol')}</th>
                    <th>{t('teacherSpace.correction.quizCol')}</th>
                    <th>{t('teacherSpace.correction.resultCol')}</th>
                    <th>{t('teacherSpace.correction.dateCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.student.firstName} {s.student.lastName}</td>
                      <td>{s.quiz.title}</td>
                      <td>
                        <span className={`badge ${s.score === s.totalPoints ? 'good' : 'warn'}`}>
                          {s.score}/{s.totalPoints}
                        </span>
                      </td>
                      <td>{new Date(s.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-item">
          <h4>{t('teacherSpace.correction.aiGradeTitle')}</h4>
          <div className="form-group">
            <label>{t('teacherSpace.correction.questionLabel')}</label>
            <input id="ai-q" placeholder={t('teacherSpace.correction.questionPlaceholder')} />
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.correction.studentAnswerLabel')}</label>
            <textarea id="ai-a" placeholder={t('teacherSpace.correction.studentAnswerPlaceholder')} />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => askSuggestion(document.getElementById('ai-q').value, document.getElementById('ai-a').value)}
          >
            {t('teacherSpace.correction.suggestCorrection')}
          </button>
          {suggestion && <div className="ai-suggestion">{suggestion}</div>}
        </div>
      </div>

      <h4 style={{ marginTop: 24 }}>{t('teacherSpace.correction.officialExamsTitle')}</h4>
      <div className="form-row">
        <div className="form-group">
          <label>{t('teacherSpace.correction.selectExamLabel')}</label>
          <select onChange={(e) => e.target.value && loadExamSubs(e.target.value)}>
            <option value="">...</option>
            {examSubs.length === 0 && <option value="" disabled>{t('teacherSpace.correction.loadFromTab')}</option>}
          </select>
        </div>
      </div>
      {examSubs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.correction.studentCol')}</th>
                <th>{t('teacherSpace.correction.statusCol')}</th>
                <th>{t('teacherSpace.correction.scoreCol')}</th>
              </tr>
            </thead>
            <tbody>
              {examSubs.map((s) => (
                <tr key={s.id}>
                  <td>{s.student.firstName} {s.student.lastName}</td>
                  <td>{s.status}</td>
                  <td>{s.score ?? t('teacherSpace.correction.noValue')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ marginTop: 24 }}>{t('teacherSpace.correction.lessonSubmissionsTitle')}</h4>
      <div className="form-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group">
          <label>{t('teacherSpace.correction.filterByStatus')}</label>
          <select value={lessonFilter} onChange={(e) => setLessonFilter(e.target.value)}>
            <option value="ALL">{t('teacherSpace.correction.all')}</option>
            <option value="SUBMITTED">{t('teacherSpace.correction.lessonStatus.SUBMITTED')}</option>
            <option value="IN_REVIEW">{t('teacherSpace.correction.lessonStatus.IN_REVIEW')}</option>
            <option value="GRADED">{t('teacherSpace.correction.lessonStatus.GRADED')}</option>
            <option value="RETURNED">{t('teacherSpace.correction.lessonStatus.RETURNED')}</option>
          </select>
        </div>
        <button
          className="btn btn-primary"
          onClick={batchGrade}
          disabled={batchGrading || lessonSubs.filter(s => s.status === 'SUBMITTED').length === 0}
          style={{ marginBottom: 2 }}
        >
          {batchGrading ? t('teacherSpace.correction.batchGrading') : t('teacherSpace.correction.batchGradeBtn')}
        </button>
      </div>

      {filteredLessons.length === 0 ? (
        <div className="empty">{t('teacherSpace.correction.noLessonSubmissions')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.correction.studentCol')}</th>
                <th>{t('teacherSpace.correction.lessonCol')}</th>
                <th>{t('teacherSpace.correction.statusCol')}</th>
                <th>{t('teacherSpace.correction.fileCol')}</th>
                <th>{t('teacherSpace.correction.gradingCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLessons.map((ls) => {
                const st = LESSON_SUB_STATUS[ls.status] || LESSON_SUB_STATUS.SUBMITTED;
                const g = lessonGrading[ls.id] || {};
                return (
                  <tr key={ls.id}>
                    <td>{ls.student.firstName} {ls.student.lastName}</td>
                    <td>{ls.lessonTitle}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      {ls.files && ls.files.length > 0 ? (
                        <a href={ls.files[0].dataUrl || '#'} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">{t('teacherSpace.correction.viewFile')}</a>
                      ) : (
                        <span className="muted">{t('teacherSpace.correction.noFile')}</span>
                      )}
                    </td>
                    <td className="paper-grade-cell">
                      {ls.status === 'SUBMITTED' && (
                        <button className="btn btn-sm" onClick={() => startLessonReview(ls.id)}>{t('teacherSpace.correction.startReview')}</button>
                      )}
                      {ls.status !== 'GRADED' && (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            placeholder={t('teacherSpace.correction.scorePlaceholder')}
                            value={g.score ?? ''}
                            onChange={(e) => setLessonGrading({ ...lessonGrading, [ls.id]: { ...g, score: e.target.value } })}
                            className="grade-input"
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => saveLessonGrade(ls.id)}>{t('teacherSpace.correction.save')}</button>
                        </>
                      )}
                      {ls.status === 'GRADED' && ls.grade !== null && (
                        <strong>{ls.grade} / 20</strong>
                      )}
                      {ls.status === 'IN_REVIEW' && (
                        <button className="btn btn-sm btn-outline" style={{ marginLeft: 4 }} onClick={() => publishGrades(ls.lessonId)}>{t('teacherSpace.correction.publishGradesBtn')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ marginTop: 24 }}>{t('teacherSpace.correction.paperBoxTitle')}</h4>
      <div className="form-row">
        <div className="form-group">
          <label>{t('teacherSpace.correction.filterByStatus')}</label>
          <select value={paperFilter} onChange={(e) => setPaperFilter(e.target.value)}>
            <option value="ALL">{t('teacherSpace.correction.all')}</option>
            <option value="SENT">{t('teacherSpace.correction.status.SENT')}</option>
            <option value="IN_REVIEW">{t('teacherSpace.correction.status.IN_REVIEW')}</option>
            <option value="CORRECTED">{t('teacherSpace.correction.status.CORRECTED')}</option>
          </select>
        </div>
      </div>

      {filteredPapers.length === 0 ? (
        <div className="empty">{t('teacherSpace.correction.noScans')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.correction.studentCol')}</th>
                <th>{t('teacherSpace.correction.examCol')}</th>
                <th>{t('teacherSpace.correction.subjectCol')}</th>
                <th>{t('teacherSpace.correction.statusCol')}</th>
                <th>{t('teacherSpace.correction.fileCol')}</th>
                <th>{t('teacherSpace.correction.gradingCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPapers.map((p) => {
                const st = STATUS_STYLES[p.status] || STATUS_STYLES.SENT;
                const g = grading[p.id] || {};
                return (
                  <tr key={p.id}>
                    <td>{p.student.firstName} {p.student.lastName}</td>
                    <td>{p.examTitle}</td>
                    <td>{p.subjectLabel}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <a href={p.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">{t('teacherSpace.correction.viewPdf')}</a>
                    </td>
                    <td className="paper-grade-cell">
                      {p.status === 'SENT' && (
                        <button className="btn btn-sm" onClick={() => startReview(p.id)}>{t('teacherSpace.correction.startReview')}</button>
                      )}
                      {p.status !== 'GRADED' && p.status !== 'CORRECTED' && (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            placeholder={t('teacherSpace.correction.scorePlaceholder')}
                            value={g.score ?? ''}
                            onChange={(e) => setGrading({ ...grading, [p.id]: { ...g, score: e.target.value } })}
                            className="grade-input"
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => saveGrade(p.id)}>{t('teacherSpace.correction.save')}</button>
                        </>
                      )}
                      {(p.status === 'CORRECTED' || p.status === 'GRADED') && p.score !== null && p.score !== undefined && (
                        <strong>{p.score} / 20</strong>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}