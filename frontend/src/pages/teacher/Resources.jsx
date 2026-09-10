import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { subjectLabel, SUBJECT_CODES } from '../../utils/labels';
import ResourcePaper from '../../components/ResourcePaper.jsx';

const LEVELS = [
  'السنة الأولى أساسي',
  'السنة الثانية أساسي',
  'السنة الثالثة أساسي',
  'السنة الرابعة أساسي',
  'السنة الخامسة أساسي',
  'السنة السادسة أساسي'
];

const RESOURCE_KIND_CODES = ['WORKSHEET', 'HOMEWORK', 'FLASHCARDS', 'PRESENTATION', 'LESSON_PLAN'];

export default function Resources() {
  const { t } = useI18n();
  const [resources, setResources] = useState([]);
  const [kind, setKind] = useState('WORKSHEET');
  const [subject, setSubject] = useState('MATH');
  const [level, setLevel] = useState(LEVELS[0]);
  const [form, setForm] = useState({ lessonTitle: '' });
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback((k) => {
    api
      .get(`/teacher/resources${k ? `?kind=${k}` : ''}`)
      .then(setResources)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(kind);
  }, [load, kind]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const res = await api.post('/teacher/resources', {
        kind,
        subject,
        level,
        lessonTitle: form.lessonTitle,
        input: {}
      });
      setView(res);
      load(kind);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const rebuild = async () => {
    await api.post(`/teacher/resources/${view.id}/rebuild`);
    load(kind);
  };

  const remove = async (id) => {
    await api.del(`/teacher/resources/${id}`);
    setView(null);
    load(kind);
  };

  const toggleShare = async (r) => {
    try {
      const next = !r.isShared;
      await api.put(`/teacher/resources/${r.id}/share`, { shared: next });
      load(kind);
      setView((v) => (v && v.id === r.id ? { ...v, isShared: next } : v));
    } catch (err) {
      setError(err.message);
    }
  };

  const kindLabel = t(`teacherSpace.common.resourceKinds.${kind}`);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.resources.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>{t('teacherSpace.resources.subjectLabel')}</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECT_CODES.map((s) => (
              <option key={s} value={s}>{subjectLabel(t, s)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.resources.levelLabel')}</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.resources.kindLabel')}</label>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setView(null); }}>
            {RESOURCE_KIND_CODES.map((code) => (
              <option key={code} value={code}>{t(`teacherSpace.common.resourceKinds.${code}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {!view ? (
        <>
          <form className="card-form" onSubmit={create}>
            <div className="form-row">
              <div className="form-group grow">
                <label>{t('teacherSpace.resources.lessonTitleLabel')}</label>
                <input required value={form.lessonTitle} onChange={(e) => setForm({ ...form, lessonTitle: e.target.value })} placeholder={t('teacherSpace.resources.lessonTitlePlaceholder')} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={generating}>
                {generating ? t('teacherSpace.resources.generating') : t('teacherSpace.resources.generateBtn', { kind: kindLabel })}
              </button>
            </div>
          </form>

          {resources.length === 0 ? (
            <div className="empty">{t('teacherSpace.resources.empty')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('teacherSpace.resources.titleCol')}</th>
                    <th>{t('teacherSpace.resources.lessonCol')}</th>
                    <th>{t('teacherSpace.resources.actionsCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{r.lessonTitle}</td>
                      <td className="actions">
                        <button className="btn btn-sm" onClick={() => setView(r)}>{t('teacherSpace.resources.view')}</button>
                        <button
                          className={`btn btn-sm ${r.isShared ? '' : 'btn-outline'}`}
                          onClick={() => toggleShare(r)}
                          title={r.isShared ? t('teacherSpace.resources.unshareTitle') : t('teacherSpace.resources.shareTitle')}
                        >
                          {r.isShared ? t('teacherSpace.resources.shared') : t('teacherSpace.resources.share')}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>{t('teacherSpace.resources.delete')}</button>
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
            <h4>{view.title}</h4>
            <div className="btn-group">
              <button className="btn" onClick={() => window.print()}>{t('teacherSpace.resources.print')}</button>
              <button
                className={`btn ${view.isShared ? '' : 'btn-outline'}`}
                onClick={() => toggleShare(view)}
                title={view.isShared ? t('teacherSpace.resources.unshareTitle') : t('teacherSpace.resources.shareTitle')}
              >
                {view.isShared ? t('teacherSpace.resources.shared') : t('teacherSpace.resources.share')}
              </button>
              <button className="btn" onClick={rebuild}>{t('teacherSpace.resources.rebuild')}</button>
              <button className="btn" onClick={() => setView(null)}>{t('teacherSpace.resources.back')}</button>
            </div>
          </div>

          <ResourcePaper resource={view} />
        </div>
      )}
    </div>
  );
}
