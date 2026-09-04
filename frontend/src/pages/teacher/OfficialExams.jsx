import { useState, useEffect, useCallback, useRef } from 'react';
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
  { code: 'handwriting', label: 'الخط والإملاء' },
  { code: 'arabic', label: 'اللغة العربية' },
  { code: 'french', label: 'اللغة الفرنسية' },
  { code: 'islamic', label: 'التربية الإسلامية' }
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
  const [editingId, setEditingId] = useState(null);
  const [aiForm, setAiForm] = useState({ subject: 'arabic', level: 'year3', trimester: 1, title: '', lessonTitle: '', count: 6, classId: '', durationMinutes: 60 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

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
      if (editingId) {
        await api.put(`/teacher/exams/${editingId}`, {
          title: draft.title,
          subject: draft.subject,
          classId: draft.classId ? Number(draft.classId) : undefined,
          trimester: Number(draft.trimester),
          content: draft.content
        });
        setEditingId(null);
      } else {
        await api.post('/teacher/exams', {
          title: draft.title,
          subject: draft.subject,
          classId: draft.classId ? Number(draft.classId) : undefined,
          trimester: Number(draft.trimester),
          content: { ...draft.content, header: 'الجمهورية التونسية — وزارة التربية' }
        });
      }
      setDraft({ title: '', subject: 'math', classId: '', trimester: 1, content: {} });
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

  const downloadDocx = async (exam, inline) => {
    try {
      const res = await fetch(`/api/teacher/exams/${exam.id}/${inline ? 'preview-docx' : 'docx'}`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('school_token') }
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-${exam.id}.docx`;
      if (inline) a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadExamImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const token = localStorage.getItem('school_token');
    const res = await fetch('/api/teacher/exams/upload-image', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd
    });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    return data.url;
  };

  const startEdit = (exam) => {
    setDraft({
      title: exam.title || '',
      subject: exam.subject || 'math',
      classId: exam.classId ? String(exam.classId) : '',
      trimester: exam.trimester || 1,
      content: exam.content || {}
    });
    setEditingId(exam.id);
    setView('create');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ title: '', subject: 'math', classId: '', trimester: 1, content: {} });
    setView('list');
  };

  const updateQuestion = (idx, patch) => {
    const questions = [...(draft.content.questions || [])];
    questions[idx] = { ...questions[idx], ...patch };
    setDraft({ ...draft, content: { ...draft.content, questions } });
  };

  const addQuestion = () => {
    const questions = [...(draft.content.questions || [])];
    questions.push({
      id: 'q' + Date.now(),
      criterion: 'مع1',
      type: 'OPEN',
      prompt: '',
      instruction: '',
      label: '',
      options: [],
      points: 1,
      answerLines: 4
    });
    setDraft({ ...draft, content: { ...draft.content, questions } });
  };

  const removeQuestion = (idx) => {
    const questions = [...(draft.content.questions || [])];
    questions.splice(idx, 1);
    setDraft({ ...draft, content: { ...draft.content, questions } });
  };

  const updatePassage = (idx, patch) => {
    const passages = [...(draft.content.passages || [])];
    passages[idx] = { ...passages[idx], ...patch };
    setDraft({ ...draft, content: { ...draft.content, passages } });
  };

  const addPassage = () => {
    const passages = [...(draft.content.passages || [])];
    passages.push({ id: 'p' + Date.now(), title: '', text: '' });
    setDraft({ ...draft, content: { ...draft.content, passages } });
  };

  const removePassage = (idx) => {
    const passages = [...(draft.content.passages || [])];
    passages.splice(idx, 1);
    setDraft({ ...draft, content: { ...draft.content, passages } });
  };

  const promptRefs = useRef({});
  const SYMBOLS = ['○', '□', '△', '▲', '●', '■', '★', '✓', '✗', '→', '◄', '►', '…', '......'];

  const insertSymbol = (idx, sym) => {
    const el = promptRefs.current[idx];
    const cur = (draft.content.questions || [])[idx] || {};
    const base = cur.prompt || cur.text || '';
    if (el && typeof el.selectionStart === 'number') {
      const a = el.selectionStart;
      const b = el.selectionEnd == null ? a : el.selectionEnd;
      updateQuestion(idx, { prompt: base.slice(0, a) + sym + base.slice(b) });
      setTimeout(() => {
        try {
          const n = document.querySelector('[data-qprompt="' + idx + '"]');
          if (n) { n.focus(); n.selectionStart = n.selectionEnd = a + sym.length; }
        } catch (e) {}
      }, 0);
    } else {
      updateQuestion(idx, { prompt: base + sym });
    }
  };

  const updateCriterion = (idx, patch) => {
    const criteria = [...(draft.content.criteria || [])];
    criteria[idx] = { ...criteria[idx], ...patch };
    setDraft({ ...draft, content: { ...draft.content, criteria } });
  };

  const updateCriterionMastery = (idx, key, val) => {
    const criteria = [...(draft.content.criteria || [])];
    const c = { ...(criteria[idx] || {}), mastery: { ...((criteria[idx] || {}).mastery || {}) } };
    c.mastery[key] = Number(val);
    criteria[idx] = c;
    setDraft({ ...draft, content: { ...draft.content, criteria } });
  };

  const addCriterion = () => {
    const criteria = [...(draft.content.criteria || [])];
    criteria.push({ id: 'مع' + (criteria.length + 1), label: '', mastery: { none: 0, below: 1, min: 2, max: 3 } });
    setDraft({ ...draft, content: { ...draft.content, criteria } });
  };

  const removeCriterion = (idx) => {
    const criteria = [...(draft.content.criteria || [])];
    criteria.splice(idx, 1);
    setDraft({ ...draft, content: { ...draft.content, criteria } });
  };

  const criterionOptions = () => {
    const list = draft.content.criteria || [];
    if (list.length === 0) return [{ id: 'مع1' }, { id: 'مع2' }, { id: 'مع3' }];
    return list;
  };

  const generateAi = async (e) => {
    e.preventDefault();
    setAiLoading(true);
    setError('');
    setAiResult(null);
    try {
      const data = await api.post('/teacher/exams/generate-ai', {
        subject: aiForm.subject,
        level: aiForm.level,
        trimester: Number(aiForm.trimester),
        title: aiForm.title || undefined,
        lessonTitle: aiForm.lessonTitle || undefined,
        count: Number(aiForm.count) || 6,
        classId: aiForm.classId ? Number(aiForm.classId) : undefined,
        durationMinutes: Number(aiForm.durationMinutes) || 60
      });
      setAiResult(data);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
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
          <button className="btn" onClick={() => { setView('ai'); setActive(null); }}>
            {t('teacherSpace.officialExams.aiBtn')}
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
                      <button className="btn btn-sm" onClick={() => downloadDocx(e, false)}>
                        {t('teacherSpace.officialExams.downloadWord')}
                      </button>
                      <button className="btn btn-sm" onClick={() => startEdit(e)}>
                        {t('teacherSpace.officialExams.edit')}
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

      {view === 'ai' && (
        <form className="card-form" onSubmit={generateAi}>
          <h4>{t('teacherSpace.officialExams.aiTitle')}</h4>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('teacherSpace.officialExams.subjectLabel')}</label>
              <select value={aiForm.subject} onChange={(e) => setAiForm({ ...aiForm, subject: e.target.value })}>
                {SUBJECTS.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.yearLabel')}</label>
              <select value={aiForm.level} onChange={(e) => setAiForm({ ...aiForm, level: e.target.value })}>
                {LEVELS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.trimesterLabel')}</label>
              <select value={aiForm.trimester} onChange={(e) => setAiForm({ ...aiForm, trimester: e.target.value })}>
                <option value="1">{t('teacherSpace.officialExams.trimesters.1')}</option>
                <option value="2">{t('teacherSpace.officialExams.trimesters.2')}</option>
                <option value="3">{t('teacherSpace.officialExams.trimesters.3')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.officialExams.countLabel')}</label>
              <input type="number" min="1" max="15" value={aiForm.count} onChange={(e) => setAiForm({ ...aiForm, count: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('teacherSpace.officialExams.examTitleLabel')}</label>
              <input value={aiForm.title} onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })} placeholder={t('teacherSpace.officialExams.examTitleLabel')} />
            </div>
            <div className="form-group grow">
              <label>{t('teacherSpace.officialExams.lessonLabel')}</label>
              <input value={aiForm.lessonTitle} onChange={(e) => setAiForm({ ...aiForm, lessonTitle: e.target.value })} placeholder={t('teacherSpace.officialExams.lessonPlaceholder')} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={aiLoading}>
            {aiLoading ? '...' : t('teacherSpace.officialExams.generateAiBtn')}
          </button>
          {aiResult && (
            <div className="card-item">
              <h5>{aiResult.title}</h5>
              <p className="sub">{t('teacherSpace.officialExams.questionsLabel', { n: aiResult.content?.questions?.length || 0 })} {aiResult.savedToBank ? '— ' + t('teacherSpace.officialExams.aiSaved') : ''}</p>
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => { setActive(aiResult); setView('preview'); }}>
                  {t('teacherSpace.officialExams.preview')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => downloadDocx(aiResult, false)}>
                  {t('teacherSpace.officialExams.downloadWord')}
                </button>
              </div>
            </div>
          )}
        </form>
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
            <label>{t('teacherSpace.officialExams.passagesLabel')}</label>
            {(draft.content.passages || []).map((p, i) => (
              <div key={p.id || i} className="card-item">
                <div className="form-row">
                  <div className="form-group grow">
                    <input value={p.title || ''} onChange={(e) => updatePassage(i, { title: e.target.value })} placeholder={t('teacherSpace.officialExams.passageTitlePh')} />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removePassage(i)}>×</button>
                </div>
                <textarea value={p.text || ''} rows="3" onChange={(e) => updatePassage(i, { text: e.target.value })} placeholder={t('teacherSpace.officialExams.passageTextPh')} />
                <div className="form-row">
                  <div className="form-group grow">
                    <input value={p.image || p.visual || ''} onChange={(e) => updatePassage(i, { image: e.target.value, visual: e.target.value })} placeholder="/uploads/exams/..." />
                  </div>
                  <label className="btn btn-sm">
                    {t('teacherSpace.officialExams.uploadImage')}
                    <input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
                      const f = e.target.files && e.target.files[0];
                      if (!f) return;
                      try {
                        const url = await uploadExamImage(f);
                        updatePassage(i, { image: url, visual: url });
                      } catch (err) {
                        setError(err.message);
                      }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
                {(p.image || p.visual) && (
                  <img src={p.image || p.visual} alt="" style={{ maxWidth: '160px', maxHeight: '120px', marginTop: '4px' }} />
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addPassage}>+ {t('teacherSpace.officialExams.addPassage')}</button>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.officialExams.questionsLabel', { n: (draft.content.questions || []).length })}</label>
            {(draft.content.questions || []).map((q, i) => (
              <div key={q.id || i} className="card-item">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.qTypeLabel')}</label>
                    <select value={q.type || 'OPEN'} onChange={(e) => updateQuestion(i, { type: e.target.value })}>
                      {['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING', 'ORDERING', 'EXTRACT', 'OPEN'].map((tp) => (
                        <option key={tp} value={tp}>{tp}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.qPointsLabel')}</label>
                    <input type="number" min="0.5" step="0.5" value={q.points ?? 1} onChange={(e) => updateQuestion(i, { points: Number(e.target.value) })} />
                  </div>
                  <div className="form-group grow">
                    <label>{t('teacherSpace.officialExams.qLabelLabel')}</label>
                    <input value={q.label || ''} onChange={(e) => updateQuestion(i, { label: e.target.value })} placeholder="التعليمة 1-1" />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(i)}>×</button>
                </div>
                <div className="form-group">
                  <label>{t('teacherSpace.officialExams.qImageLabel')}</label>
                  <div className="form-row">
                    <div className="form-group grow">
                      <input value={q.visual || q.image || ''} onChange={(e) => updateQuestion(i, { visual: e.target.value, image: e.target.value })} placeholder="/uploads/exams/..." />
                    </div>
                    <label className="btn btn-sm">
                      {t('teacherSpace.officialExams.uploadImage')}
                      <input type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (!f) return;
                        try {
                          const url = await uploadExamImage(f);
                          updateQuestion(i, { visual: url, image: url });
                        } catch (err) {
                          setError(err.message);
                        }
                        e.target.value = '';
                      }} />
                    </label>
                    {(q.visual || q.image) && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => updateQuestion(i, { visual: '', image: '' })}>×</button>
                    )}
                  </div>
                  {(q.visual || q.image) && (
                    <img src={q.visual || q.image} alt="" style={{ maxWidth: '160px', maxHeight: '120px', marginTop: '4px' }} />
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.qCriterionLabel')}</label>
                    <select value={q.criterion || 'مع1'} onChange={(e) => updateQuestion(i, { criterion: e.target.value, section: e.target.value })}>
                      {criterionOptions().map((c) => (
                        <option key={c.id} value={c.id}>{c.label ? c.id + ' - ' + c.label : c.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group grow">
                    <label>{t('teacherSpace.officialExams.qSymbolLabel')}</label>
                    <div>
                      {SYMBOLS.map((sym) => (
                        <button key={sym} type="button" className="btn btn-sm" style={{ margin: '2px' }} onClick={() => insertSymbol(i, sym)}>{sym}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('teacherSpace.officialExams.qInstructionLabel')}</label>
                  <input value={q.instruction || ''} onChange={(e) => updateQuestion(i, { instruction: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{t('teacherSpace.officialExams.qPromptLabel')}</label>
                  <textarea data-qprompt={i} ref={(el) => { promptRefs.current[i] = el; }} value={q.prompt || q.text || ''} rows="2" onChange={(e) => updateQuestion(i, { prompt: e.target.value })} />
                </div>
                {(q.type === 'MCQ' || q.type === 'EXTRACT') && (
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.qOptionsLabel')}</label>
                    <textarea
                      value={(q.options || []).join('\n')}
                      rows="3"
                      onChange={(e) => updateQuestion(i, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })}
                      placeholder="خيار 1&#10;خيار 2&#10;خيار 3"
                    />
                  </div>
                )}
                {(q.type === 'OPEN') && (
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.qLinesLabel')}</label>
                    <input type="number" min="1" max="12" value={q.answerLines ?? 4} onChange={(e) => updateQuestion(i, { answerLines: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addQuestion}>+ {t('teacherSpace.officialExams.addQuestion')}</button>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.officialExams.critSectionLabel')}</label>
            {(draft.content.criteria || []).map((c, i) => (
              <div key={c.id || i} className="card-item">
                <div className="form-row">
                  <div className="form-group">
                    <label>ID</label>
                    <input value={c.id || ''} onChange={(e) => updateCriterion(i, { id: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>{t('teacherSpace.officialExams.critExcLabel')}</label>
                    <input type="checkbox" checked={!!c.excellence} onChange={(e) => updateCriterion(i, { excellence: e.target.checked })} />
                  </div>
                  <div className="form-group grow">
                    <label>{t('teacherSpace.officialExams.criteriaCol')}</label>
                    <input value={c.label || ''} onChange={(e) => updateCriterion(i, { label: e.target.value })} placeholder={t('teacherSpace.officialExams.critLabelPh')} />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeCriterion(i)}>×</button>
                </div>
                <div className="form-row">
                  {[['none', 'critNoneLabel'], ['below', 'critBelowLabel'], ['min', 'critMinLabel'], ['max', 'critMaxLabel']].map(([k, lk]) => (
                    <div key={k} className="form-group">
                      <label>{t('teacherSpace.officialExams.' + lk)}</label>
                      <input type="number" min="0" step="0.5" value={c.mastery?.[k] ?? 0} onChange={(e) => updateCriterionMastery(i, k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addCriterion}>+ {t('teacherSpace.officialExams.addCriterion')}</button>
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
          <div className="btn-group">
            <button className="btn btn-primary" onClick={() => downloadDocx(active, false)}>
              {t('teacherSpace.officialExams.downloadWord')}
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              {t('teacherSpace.officialExams.printOfficial')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
