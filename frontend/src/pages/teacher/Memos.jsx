import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { imgSrc, restoreOriginalImg } from '../../utils/imgSrc.js';

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

  // السنة الواحدة للمادة قد تخدمها عدة كتب (كتابي في الرياضيات، رياضياتي 2، المتميز...)
  const bookMatchesSubject = useCallback(
    (b) => b && matchesLevel(b, form.level) && ((b.subjectKey || b.subject) === form.subject || b.subject === form.subject),
    [form.level, form.subject]
  );

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
    () => (books || []).some(bookMatchesSubject),
    [books, bookMatchesSubject]
  );

  useEffect(() => {
    if (!form.subject || !form.level) {
      setLessonOptions([]);
      return;
    }
    const matched = (books || []).filter(bookMatchesSubject);
    if (!matched.length) {
      setLessonOptions([]);
      return;
    }
    let alive = true;
    Promise.all(
      matched.map((b) =>
        api
          .get(`/public/curriculum/books/${b.gradeId}/${b.subjectId}/lessons`)
          .then((lessons) => (lessons || []).map((l) => ({ title: l.title, book: b.subject })))
          .catch(() => [])
      )
    ).then((lists) => {
      if (!alive) return;
      const flat = lists.flat();
      const seen = new Set();
      setLessonOptions(flat.filter((x) => x.title && !seen.has(x.title) && seen.add(x.title)));
    });
    return () => { alive = false; };
  }, [form.subject, form.level, books, bookMatchesSubject]);

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
      await api.download(`/memos/${view.id}/pdf`, `memo-${view.lessonTitle || view.id}.pdf`);
    } catch (err) {
      setError(err.message);
    }
  };

  const openSaved = (m) => {
    setForm({ subject: m.subject, level: m.level, lessonTitle: m.lessonTitle, lessonType: m.lessonType || '', unit: m.unit || '' });
    setView(m);
  };

  const c = view?.content || {};
  const spec = c.spec && c.spec.specVersion === 2 ? c.spec : null;
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
                  {lessonOptions.map((o) => (
                    <option key={o.title} value={o.title}>{o.book ? `${o.title} — ${o.book}` : o.title}</option>
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


          {spec && (
            <div className="memo-section">
              <div style={{ background: '#5b4636', color: '#fff', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <strong>{spec.mathTemplate ? (spec.banner && spec.banner.title) || 'مذكرة رياضيات' : spec.headerTitle}</strong>
                <span style={{ display: 'flex', gap: 8 }}>
                  {spec.mathTemplate ? (
                    <>
                      <span style={{ background: '#c9a227', color: '#222', borderRadius: 8, padding: '2px 10px' }}>{(spec.banner && spec.banner.duration) || 'التوقيت: 60 دق'}</span>
                      <span style={{ background: '#7a9e7e', color: '#fff', borderRadius: 8, padding: '2px 10px' }}>المستوى: {(spec.banner && spec.banner.level) || ''}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ background: '#c9a227', color: '#222', borderRadius: 8, padding: '2px 10px' }}>الفترة: {spec.period || '…'}</span>
                      <span style={{ background: '#7a9e7e', color: '#fff', borderRadius: 8, padding: '2px 10px' }}>اليوم: {spec.day || '…'}</span>
                    </>
                  )}
                </span>
              </div>
              <div style={{ border: '1.5px solid #cbd5c0', borderRadius: 12, padding: '8px 12px', margin: '10px 0', background: '#f7faf5' }}>
                {spec.mathTemplate && (
                  <>
                    {spec.competencies?.component && <div><b>مكون الكفاية: </b>{spec.competencies.component}</div>}
                    {spec.competencies?.distinctiveObjective && <div><b>الهدف المميز: </b>{spec.competencies.distinctiveObjective}</div>}
                    {spec.content && <div><b>المحتوى: </b>{spec.content}</div>}
                    <div><b>هدف الحصة: </b>{(spec.lessonObjectives || []).join('؛ ')}</div>
                  </>
                )}
                {!spec.mathTemplate && spec.competencies?.domain && <div><b>كفاية المجال: </b>{spec.competencies.domain}</div>}
                {!spec.mathTemplate && spec.competencies?.subject && <div><b>كفاية المادة: </b>{spec.competencies.subject}</div>}
                {!spec.mathTemplate && spec.competencies?.component && <div><b>مكوّن الكفاية: </b>{spec.competencies.component}</div>}
                {!spec.mathTemplate && spec.competencies?.distinctiveObjective && <div><b>الهدف المميّز: </b>{spec.competencies.distinctiveObjective}</div>}
                {!spec.mathTemplate && (spec.lessonObjectives || []).map((o, i) => <div key={'o' + i}><b>{'هدف الحصّة ' + (i + 1) + ': '}</b>{o}</div>)}
                {!spec.mathTemplate && spec.content && <div style={{ background: '#eef4fb', borderRight: '4px solid #4a7fb5', borderRadius: 6, padding: '4px 10px', marginTop: 6 }}><b>المحتوى: </b>{spec.content}</div>}
              </div>
              {!spec.mathTemplate && (
                <div style={{ textAlign: 'center', margin: '12px 0' }}>
                  <strong style={{ color: '#7a4b1f', fontSize: '1.35rem', borderBottom: '3px solid #c9a227', padding: '0 20px 3px' }}>ثانيًا: التمشّي البيداغوجي</strong>
                </div>
              )}
              <div className="table-wrap">
                <table className="data-table" style={{ fontSize: 14.5, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {(spec.mathTemplate
                        ? ['المراحل', 'نشاط المعلّم', 'نشاط المتعلّم', 'الوسائل']
                        : ['المراحل', 'نشاط الأستاذ', 'نشاط المتعلّم', 'المهارة المستهدفة', 'الوسائل']).map((h, i) => (
                        <th key={h} style={{ border: '2.5px solid #222', padding: '8px 10px', fontSize: 15.5, color: '#1d2430', background: ['#d9b45b', '#a8c8e8', '#a9dcb9', '#d3bce8', '#f0c9b0'][i] }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(spec.rows || []).map((r, i) => (
                      <tr key={i}>
                        <th style={{ border: '2px solid #222', borderBottom: '3.5px solid #111', background: ['#f3e2b6', '#c9def3', '#cdeed4', '#e6d4f5', '#f8d4c8', '#d4ecec'][i % 6], padding: 8, fontSize: 15 }}>
                          {r.stage}
                        </th>
                        <td style={{ border: '2px solid #222', borderBottom: '3.5px solid #111', padding: '9px 10px', lineHeight: 1.9 }}>
                          {String(r.teacherActivity || '').split('\n').map((ln, j) => <div key={j}>{ln}</div>)}
                          {(r.images || []).map((im, k) => (
                            <img key={k} src={imgSrc(im.src)} alt={im.caption || ''} loading="lazy" onError={(e) => restoreOriginalImg(e, im.src)} style={{ maxWidth: 200, borderRadius: 6, border: '1px solid #ccc', display: 'block', margin: '6px 0' }} />
                          ))}
                        </td>
                        <td style={{ border: '2px solid #222', borderBottom: '3.5px solid #111', padding: '9px 10px', lineHeight: 1.9 }}>{String(r.learnerActivity || '').split('\n').map((ln, j) => <div key={j}>{ln}</div>)}</td>
                        {!spec.mathTemplate && <td style={{ border: '2px solid #222', borderBottom: '3.5px solid #111', padding: 8, textAlign: 'center', color: '#274d27', fontWeight: 700 }}>{r.skill}</td>}
                        <td style={{ border: '2px solid #222', borderBottom: '3.5px solid #111', padding: 8, textAlign: 'center', fontWeight: 600 }}>{(r.tools || []).join(' + ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ border: '1.5px solid #cbd5c0', borderRadius: 12, padding: '10px 14px', marginTop: 10, background: '#fbf9f4' }}>
                <div>
                  <b>{spec.successRateLine || 'نسبة نجاح الدرس من خلال التمرين التطبيقي:'}</b>
                  <span style={{ borderBottom: '2px dotted #777', display: 'inline-block', minWidth: 200, height: 18, marginInlineStart: 8 }} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <b>{spec.pedagogicalDecision || 'القرار البيداغوجي:'}</b>
                  <span style={{ borderBottom: '2px dotted #777', display: 'inline-block', minWidth: 200, height: 18, marginInlineStart: 8 }} />
                </div>
                {spec.decisionHints && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{spec.decisionHints}</div>}
              </div>
            </div>
          )}

          {!spec && c.header?.columns?.length > 0 && (
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

          {!spec && c.warmup?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.warmup')}</h5>
              <ul>
                {c.warmup.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {!spec && c.table?.columns?.length > 0 && (
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

          {!spec && (c.phases || []).length > 0 && (
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

          {!spec && c.keywords?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.keywords')}</h5>
              <div className="chips">
                {c.keywords.map((k, i) => (
                  <span key={i} className="chip">{k}</span>
                ))}
              </div>
            </div>
          )}

          {!spec && c.definitions?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.concepts')}</h5>
              {c.definitions.map((d, i) => (
                <p key={i}><strong>{d}</strong></p>
              ))}
            </div>
          )}

          {!spec && c.domainNotes?.length > 0 && (
            <div className="memo-section">
              <h5>{t('teacherSpace.memos.domainNotes')}</h5>
              {c.domainNotes.map((dn, i) => (
                <div key={i} className="flashcard">
                  <strong>{dn.domain}:</strong> {dn.note}
                </div>
              ))}
            </div>
          )}

          {!spec && c.closing?.length > 0 && (
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
