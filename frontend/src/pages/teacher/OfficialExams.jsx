import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const LEVELS = [
  { code: 'year1', label: 'السنة الأولى' },
  { code: 'year2', label: 'السنة الثانية' },
  { code: 'year3', label: 'السنة الثالثة' },
  { code: 'year4', label: 'السنة الرابعة' },
  { code: 'year5', label: 'السنة الخامسة' },
  { code: 'year6', label: 'السنة السادسة' }
];

const SUBJECTS = [
  { code: 'math', label: 'الرياضيات' },
  { code: 'anisi', label: 'القراءة' },
  { code: 'science', label: 'الإيقاظ العلمي' },
  { code: 'production', label: 'الإنتاج الكتابي' },
  { code: 'handwriting', label: 'الخط والإملاء' }
];

function CriteriaTable({ criteria, t }) {
  if (!criteria || criteria.length === 0) return null;
  const MASTERY_KEYS = ['none', 'below', 'min', 'max'];
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('teacherSpace.officialExams.criteriaCol')}</th>
            {MASTERY_KEYS.map((k) => (
              <th key={k}>{t(`teacherSpace.officialExams.mastery.${k}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id}>
              <td>{c.label || c.id}</td>
              {MASTERY_KEYS.map((k) => (
                <td key={k}>{c.mastery?.[k] ?? t('teacherSpace.officialExams.noValue')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OfficialExams({ classes }) {
  const { t } = useI18n();
  const [exams, setExams] = useState([]);
  const [bank, setBank] = useState([]);
  const [bankFilter, setBankFilter] = useState({ level: '', subject: '', trimester: '' });
  const [bankLoading, setBankLoading] = useState(false);
  const [view, setView] = useState('list');
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ title: '', subject: 'math', classId: '', trimester: 1, content: {} });

  const load = useCallback(() => {
    api
      .get('/teacher/exams')
      .then(setExams)
      .catch(() => {});
  }, []);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const q = new URLSearchParams();
      if (bankFilter.level) q.set('level', bankFilter.level);
      if (bankFilter.subject) q.set('subject', bankFilter.subject);
      if (bankFilter.trimester) q.set('trimester', bankFilter.trimester);
      const data = await api.get(`/public/official-exams-bank?${q.toString()}`);
      setBank(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBankLoading(false);
    }
  }, [bankFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view === 'bank') loadBank();
  }, [view, loadBank]);

  const importBank = async (exam) => {
    try {
      await api.post('/teacher/exams/instantiate', {
        bankId: exam.id,
        classId: draft.classId ? Number(draft.classId) : undefined
      });
      load();
      setView('list');
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/teacher/exams', {
        title: draft.title,
        subject: draft.subject,
        classId: draft.classId ? Number(draft.classId) : undefined,
        trimester: Number(draft.trimester),
        content: { ...draft.content, header: 'الجمهورية التونسية — وزارة التربية' }
      });
      load();
      setView('list');
      setActive(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const togglePublish = async (exam) => {
    await api.put(`/teacher/exams/${exam.id}`, { published: !exam.published });
    load();
  };

  const remove = async (id) => {
    await api.del(`/teacher/exams/${id}`);
    load();
  };

  const subjectLabel = (code) => SUBJECTS.find((s) => s.code === code)?.label || code;
  const levelLabel = (code) => LEVELS.find((l) => l.code === code)?.label || code;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.officialExams.title')}</h3>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => { setView('bank'); setActive(null); }}>
            {t('teacherSpace.officialExams.bankBtn')}
          </button>
          <button className="btn" onClick={() => { setView('create'); setActive(null); }}>
            {t('teacherSpace.officialExams.manualBtn')}
          </button>
          {view !== 'list' && (
            <button className="btn" onClick={() => setView('list')}>
              {t('teacherSpace.officialExams.back')}
            </button>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {view === 'list' && (
        exams.length === 0 ? (
          <div className="empty">{t('teacherSpace.officialExams.empty')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('teacherSpace.officialExams.titleCol')}</th>
                  <th>{t('teacherSpace.officialExams.subjectCol')}</th>
                  <th>{t('teacherSpace.officialExams.trimesterCol')}</th>
                  <th>{t('teacherSpace.officialExams.classCol')}</th>
                  <th>{t('teacherSpace.officialExams.statusCol')}</th>
                  <th>{t('teacherSpace.officialExams.actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td>{e.title}</td>
                    <td>{subjectLabel(e.subject)}</td>
                    <td>{e.trimester ? t(`teacherSpace.officialExams.trimesters.${e.trimester}`) : t('teacherSpace.officialExams.noValue')}</td>
                    <td>{e.class?.name || t('teacherSpace.officialExams.allClasses')}</td>
                    <td>
                      <span className={`badge ${e.published ? 'good' : ''}`}>{e.published ? t('teacherSpace.officialExams.published') : t('teacherSpace.officialExams.draft')}</span>
                    </td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => { setActive(e); setView('preview'); }}>
                        {t('teacherSpace.officialExams.preview')}
                      </button>
                      <button className="btn btn-sm" onClick={() => togglePublish(e)}>
                        {e.published ? t('teacherSpace.officialExams.unpublish') : t('teacherSpace.officialExams.publish')}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)}>
                        {t('teacherSpace.officialExams.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {view === 'bank' && (
        <div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.yearLabel')}</label>
              <select value={bankFilter.level} onChange={(e) => setBankFilter({ ...bankFilter, level: e.target.value })}>
                <option value="">{t('teacherSpace.officialExams.all')}</option>
                {LEVELS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.subjectLabel')}</label>
              <select value={bankFilter.subject} onChange={(e) => setBankFilter({ ...bankFilter, subject: e.target.value })}>
                <option value="">{t('teacherSpace.officialExams.all')}</option>
                {SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.trimesterLabel')}</label>
              <select value={bankFilter.trimester} onChange={(e) => setBankFilter({ ...bankFilter, trimester: e.target.value })}>
                <option value="">{t('teacherSpace.officialExams.all')}</option>
                <option value="1">{t('teacherSpace.officialExams.trimesters.1')}</option>
                <option value="2">{t('teacherSpace.officialExams.trimesters.2')}</option>
                <option value="3">{t('teacherSpace.officialExams.trimesters.3')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.classOnImportLabel')}</label>
              <select value={draft.classId} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
                <option value="">{t('teacherSpace.officialExams.all')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {bankLoading ? (
            <div className="empty">{t('teacherSpace.officialExams.bankLoading')}</div>
          ) : bank.length === 0 ? (
            <div className="empty">{t('teacherSpace.officialExams.bankEmpty')}</div>
          ) : (
            <div className="cards-grid">
              {bank.map((exam) => (
                <div key={exam.id} className="card-item">
                  <h4>{exam.title}</h4>
                  <p className="sub">
                    {levelLabel(exam.level)} — {subjectLabel(exam.subject)} — {t('teacherSpace.officialExams.trimesterInline', { n: exam.trimester })}
                  </p>
                  <p className="muted">
                    {t('teacherSpace.officialExams.durationMinutes', { n: exam.durationMinutes })}
                  </p>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => { setActive(exam); setView('bank-preview'); }}>
                      {t('teacherSpace.officialExams.previewCriteria')}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => importBank(exam)}>
                      {t('teacherSpace.officialExams.importToMine')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'bank-preview' && active && (
        <div className="exam-preview">
          <div className="exam-header">
            <h4>{active.title}</h4>
            <p>{t('teacherSpace.officialExams.totalPointsLine', { duration: active.durationMinutes, points: active.totalPoints })}</p>
          </div>

          <div className="form-group">
            <label>{t('teacherSpace.officialExams.passagesLabel')}</label>
            {active.passages?.map((p) => (
              <div key={p.id} className="card-item">
                <h5>{p.title}</h5>
                <p>{p.text}</p>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label>{t('teacherSpace.officialExams.criteriaTableLabel')}</label>
            <CriteriaTable criteria={active.criteria} t={t} />
          </div>

          <div className="form-group">
            <label>{t('teacherSpace.officialExams.questionsLabel', { n: active.questions?.length || 0 })}</label>
            {active.questions?.map((q, i) => (
              <div key={q.id} className="card-item">
                <p><strong>{i + 1}. {q.prompt}</strong></p>
                <p className="sub">{t('teacherSpace.officialExams.criterionLabel', { criterion: q.criterion, type: q.type })}</p>
                {q.options?.length > 0 && (
                  <ul>
                    {q.options.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => importBank(active)}>
              {t('teacherSpace.officialExams.importToMine')}
            </button>
            <button className="btn" onClick={() => setView('bank')}>
              {t('teacherSpace.officialExams.backToBank')}
            </button>
          </div>
        </div>
      )}

      {view === 'create' && (
        <form className="card-form" onSubmit={submit}>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('teacherSpace.officialExams.examTitleLabel')}</label>
              <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.subjectLabel')}</label>
              <select value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                {SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.trimesterLabel')}</label>
              <select value={draft.trimester} onChange={(e) => setDraft({ ...draft, trimester: e.target.value })}>
                <option value="1">{t('teacherSpace.officialExams.trimesters.1')}</option>
                <option value="2">{t('teacherSpace.officialExams.trimesters.2')}</option>
                <option value="3">{t('teacherSpace.officialExams.trimesters.3')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.classCol')}</label>
              <select value={draft.classId} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
                <option value="">{t('teacherSpace.officialExams.all')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.officialExams.instructionsLabel')}</label>
            <textarea value={draft.content.instructions || ''} onChange={(e) => setDraft({ ...draft, content: { ...draft.content, instructions: e.target.value } })} placeholder={t('teacherSpace.officialExams.instructionsPlaceholder')} />
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.officialExams.gradingScaleLabel')}</label>
            <textarea
              value={(draft.content.grading || []).map((g) => `${g.label} | ${g.points}`).join('\n')}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  content: {
                    ...draft.content,
                    grading: e.target.value.split('\n').map((line) => {
                      const [label, points] = line.split('|').map((s) => s.trim());
                      return { label: label || '', points: Number(points) || 1 };
                    }).filter((g) => g.label)
                  }
                })
              }
              placeholder={t('teacherSpace.officialExams.gradingScalePlaceholder')}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            {t('teacherSpace.officialExams.saveExam')}
          </button>
        </form>
      )}

      {view === 'preview' && active && (
        <div className="exam-preview">
          <div className="exam-header">
            <h4>{active.title}</h4>
            <p>{active.content?.header}</p>
            <p>{active.content?.school} — {active.content?.date}</p>
          </div>

          {active.content?.criteria?.length > 0 && (
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.criteriaTableLabel')}</label>
              <CriteriaTable criteria={active.content.criteria} t={t} />
            </div>
          )}

          {active.content?.grading && (
            <div className="grading-scale">
              <h5>{t('teacherSpace.officialExams.gradingScaleTitle')}</h5>
              {active.content.grading.map((g, i) => (
                <div key={i} className="grading-row">
                  <span>{g.label}</span>
                  <span>{g.points} {t('teacherSpace.officialExams.pointsSuffix')}</span>
                </div>
              ))}
            </div>
          )}

          {active.content?.passages?.length > 0 && (
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.passagesLabel')}</label>
              {active.content.passages.map((p) => (
                <div key={p.id} className="card-item">
                  <h5>{p.title}</h5>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          )}

          {active.content?.questions?.length > 0 && (
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.questionsLabel', { n: active.content.questions.length })}</label>
              {active.content.questions.map((q, i) => (
                <div key={q.id} className="card-item">
                  <p><strong>{i + 1}. {q.prompt}</strong></p>
                  {q.options?.length > 0 && (
                    <ul>
                      {q.options.map((o, j) => (
                        <li key={j}>{o}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label>{t('teacherSpace.officialExams.instructionsLabel')}</label>
            <p>{active.content?.instructions}</p>
          </div>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            {t('teacherSpace.officialExams.printOfficial')}
          </button>
        </div>
      )}
    </div>
  );
}
