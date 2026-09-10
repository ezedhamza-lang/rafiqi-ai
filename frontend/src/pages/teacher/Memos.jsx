import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const LEVELS = [
  'السنة الأولى أساسي',
  'السنة الثانية أساسي',
  'السنة الثالثة أساسي',
  'السنة الرابعة أساسي',
  'السنة الخامسة أساسي',
  'السنة السادسة أساسي'
];

function yearOf(level) {
  const m = String(level || '').match(/السنة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة)/);
  if (!m) return '';
  return { الأولى: '1', الثانية: '2', الثالثة: '3', الرابعة: '4', الخامسة: '5', السادسة: '6' }[m[1]] || '';
}

function matchesLevel(book, level) {
  if (!book || !book.grade) return false;
  return yearOf(book.grade) === yearOf(level);
}

export default function Memos({ onChanged }) {
  const { t } = useI18n();
  const [methodologies, setMethodologies] = useState([]);
  const [memos, setMemos] = useState([]);
  const [books, setBooks] = useState([]);
  const [lessonOptions, setLessonOptions] = useState([]);
  const [form, setForm] = useState({ subject: '', level: LEVELS[0], lessonTitle: '', lessonType: '', unit: '' });
  const [view, setView] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(() => {
    api
      .get('/memos')
      .then(setMemos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    api
      .get('/memos/methodologies')
      .then(setMethodologies)
      .catch(() => {});
    api
      .get('/public/curriculum/books')
      .then(setBooks)
      .catch(() => {});
  }, [load]);

  const subjects = useMemo(() => {
    const fromBooks = (books || []).map((b) => b.subject).filter(Boolean);
    const fromMeth = (methodologies || []).map((m) => m.appliesTo?.subject).filter(Boolean);
    return [...new Set([...fromBooks, ...fromMeth])].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [books, methodologies]);

  const year = useMemo(() => yearOf(form.level), [form.level]);

  const lessonTypes = useMemo(() => {
    return (methodologies || [])
      .filter(
        (m) =>
          m.appliesTo?.subject === form.subject &&
          (!m.appliesTo.year || m.appliesTo.year === year)
      )
      .map((m) => m.appliesTo?.lessonType)
      .filter(Boolean);
  }, [methodologies, form.subject, year]);

  const hasContentBook = useMemo(
    () => (books || []).some((b) => matchesLevel(b, form.level) && b.subject === form.subject),
    [books, form.level, form.subject]
  );

  useEffect(() => {
    if (!form.subject || !form.level) {
      setLessonOptions([]);
      return;
    }
    const book = (books || []).find((b) => matchesLevel(b, form.level) && b.subject === form.subject);
    if (!book) {
      setLessonOptions([]);
      return;
    }
    api
      .get(`/public/curriculum/books/${book.gradeId}/${book.subjectId}/lessons`)
      .then((lessons) => setLessonOptions((lessons || []).map((l) => l.title).filter(Boolean)))
      .catch(() => setLessonOptions([]));
  }, [form.subject, form.level, books]);

  const generate = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setGenerating(true);
    try {
      const body = { subject: form.subject, level: form.level, lessonTitle: form.lessonTitle, unit: form.unit };
      if (form.lessonType) body.lessonType = form.lessonType;
      const res = await api.post('/memos/generate', body);
      setView(res.memo);
      setInfo(res.cached ? t('teacherSpace.memos.cachedInfo') : t('teacherSpace.memos.builtInfo'));
      load();
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const rebuild = async () => {
    setError('');
    setInfo('');
    try {
      const body = { subject: form.subject, level: form.level, lessonTitle: form.lessonTitle, unit: form.unit };
      if (form.lessonType) body.lessonType = form.lessonType;
      const res = await api.post('/memos/rebuild', body);
      setView(res.memo);
      setInfo(t('teacherSpace.memos.rebuiltInfo'));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api.del(`/memos/${id}`);
    setView(null);
    load();
    onChanged && onChanged();
  };

  const printPdf = async () => {
    try {
      await api.download(`/teacher/memos/${view.id}/pdf`, `memo-${view.lessonTitle || view.id}.pdf`);
    } catch (err) {
      setError(err.message);
    }
  };

  const openSaved = (m) => {
    setForm({ subject: m.subject, level: m.level, lessonTitle: m.lessonTitle, lessonType: m.lessonType || '', unit: m.unit || '' });
    setView(m);
  };

  const c = view?.content || {};
  const headerVals = c.header?.values || {};

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.memos.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}
      {info && <div className="form-info">{info}</div>}

      {!view ? (
        <>
          <form className="card-form" onSubmit={generate}>
            <div className="form-row">
              <div className="form-group">
                <label>{t('teacherSpace.memos.levelLabel')}</label>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('teacherSpace.memos.subjectLabel')}</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option value="">{t('teacherSpace.memos.chooseSubject')}</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group grow">
                <label>{t('teacherSpace.memos.lessonTitleLabel')}</label>
                <input
                  required
                  list="memo-lessons"
                  value={form.lessonTitle}
                  onChange={(e) => setForm({ ...form, lessonTitle: e.target.value })}
                  placeholder={t('teacherSpace.memos.lessonTitlePlaceholder')}
                />
                <datalist id="memo-lessons">
                  {lessonOptions.map((tOpt) => (
                    <option key={tOpt} value={tOpt} />
                  ))}
                </datalist>
              </div>
            </div>
            {lessonTypes.length > 0 && (
              <div className="form-row">
                <div className="form-group">
                  <label>{t('teacherSpace.memos.lessonTypeLabel')}</label>
                  <select value={form.lessonType} onChange={(e) => setForm({ ...form, lessonType: e.target.value })}>
                    <option value="">{t('teacherSpace.memos.autoOption')}</option>
                    {lessonTypes.map((tType) => (
                      <option key={tType} value={tType}>{tType}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group grow">
                  <label>{t('teacherSpace.memos.unitLabel')}</label>
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('teacherSpace.memos.unitPlaceholder')} />
                </div>
              </div>
            )}
            <button className="btn btn-primary" disabled={generating || !form.subject}>
              {generating ? t('teacherSpace.memos.generating') : t('teacherSpace.memos.generateBtn')}
            </button>
            {!hasContentBook && form.subject && (
              <p className="muted note">
                {t('teacherSpace.memos.noContentBookNote')}
              </p>
            )}
            <p className="muted note">
              {t('teacherSpace.memos.aiFreeNote')}
            </p>
          </form>

          <h4 style={{ margin: '24px 0 12px' }}>{t('teacherSpace.memos.generatedListTitle')}</h4>
          {memos.length === 0 ? (
            <div className="empty">{t('teacherSpace.memos.empty')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.memos.lessonCol')}</th>
                    <th>{t('teacherSpace.memos.subjectCol')}</th>
                    <th>{t('teacherSpace.memos.levelCol')}</th>
                    <th>{t('teacherSpace.memos.methodologyCol')}</th>
                    <th>{t('teacherSpace.memos.actionsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {memos.map((m) => (
                    <tr key={m.id}>
                      <td>{m.lessonTitle}</td>
                      <td>{m.subject}</td>
                      <td>{m.level}</td>
                      <td>
                        <span className="badge good">{m.methodologyTitle || t('teacherSpace.memos.defaultMethodology')}</span>
                      </td>
                      <td className="actions">
                        <button className="btn btn-sm" onClick={() => openSaved(m)}>{t('teacherSpace.memos.preview')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>{t('teacherSpace.memos.delete')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="memo-view">
          <div className="panel-head">
            <h4>{t('teacherSpace.memos.memoLabel', { title: view.lessonTitle })}</h4>
            <div className="btn-group">
              <button className="btn" onClick={printPdf}>{t('teacherSpace.memos.print')}</button>
              <button className="btn" onClick={rebuild}>{t('teacherSpace.memos.rebuild')}</button>
              <button className="btn" onClick={() => setView(null)}>{t('teacherSpace.memos.back')}</button>
            </div>
          </div>

          {c.methodologyTitle && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.methodologyUsed')}</h5>
              <p><strong>{c.methodologyTitle}</strong></p>
              {c.principle && <p className="muted">{c.principle}</p>}
            </div>
          )}

          {c.header?.columns?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.sessionData')}</h5>
              <div className="table-wrap">
                <table className="data-table memo-header-table">
                  <tbody>
                    {c.header.columns.map((col, i) => (
                      <tr key={i}>
                        <th className="memo-header-label">{col}</th>
                        <td>{headerVals[col] || t('teacherSpace.memos.noValue')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {c.warmup?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.warmup')}</h5>
              <ul>
                {c.warmup.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {c.table?.columns?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.sessionTable')}</h5>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {c.table.columns.map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(c.table.rows || []).map((row, i) => (
                      <tr key={i}>
                        {c.table.columns.map((col, j) => (
                          <td key={j}>{row[col] || t('teacherSpace.memos.noValue')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(c.phases || []).length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.sessionPhases')}</h5>
              {(c.phases || []).map((p, i) => (
                <div key={i} className="stage-item">
                  <div className="stage-head">
                    <strong>{i + 1}. {p.name}</strong>
                  </div>
                  {p.goal && <p className="muted">{p.goal}</p>}
                  {p.activities?.length > 0 && (
                    <ul>
                      {p.activities.map((a, j) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {p.notes?.length > 0 && (
                    <div className="memo-notes">
                      {p.notes.map((n, j) => (
                        <div key={j}>{t('teacherSpace.memos.noteLabel', { text: n })}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {c.keywords?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.keywords')}</h5>
              <div className="chips">
                {c.keywords.map((k, i) => (
                  <span key={i} className="chip">{k}</span>
                ))}
              </div>
            </div>
          )}

          {c.definitions?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.concepts')}</h5>
              {c.definitions.map((d, i) => (
                <p key={i}><strong>{d}</strong></p>
              ))}
            </div>
          )}

          {c.domainNotes?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.domainNotes')}</h5>
              {c.domainNotes.map((dn, i) => (
                <div key={i} className="flashcard">
                  <strong>{dn.domain}:</strong> {dn.note}
                </div>
              ))}
            </div>
          )}

          {c.closing?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.closing')}</h5>
              {c.closing.map((cf, i) => (
                <p key={i}>{cf}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
