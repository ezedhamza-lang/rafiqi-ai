import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ClassSubjects({ classes }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ classId: '', subject: 'MATH', coefficient: '' });

  const load = useCallback(() => {
    api
      .get('/teacher/class-subjects')
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!draft.classId) {
      setError(t('teacherSpace.classSubjects.selectClassError'));
      return;
    }
    try {
      await api.post('/teacher/class-subjects', { classId: Number(draft.classId), subject: draft.subject, ...(draft.coefficient ? { coefficient: Number(draft.coefficient) } : {}) });
      setDraft({ classId: '', subject: 'MATH', coefficient: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/teacher/class-subjects/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setCoef = async (s, v) => {
    const c = Math.min(6, Math.max(1, Number(v) || 1));
    try {
      await api.put(`/teacher/class-subjects/${s.id}`, { coefficient: c });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;

  const subjectsByClass = {};
  for (const s of data.subjects) {
    const key = s.class.id;
    if (!subjectsByClass[key]) subjectsByClass[key] = { className: s.class.name, level: s.class.level, items: [] };
    subjectsByClass[key].items.push(s);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.classSubjects.title')}</h3>
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>
        {t('teacherSpace.classSubjects.intro')}
      </p>

      {error && <div className="form-error">{error}</div>}

      <form className="card-form" onSubmit={add}>
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('teacherSpace.classSubjects.classLabel')}</label>
            <select value={draft.classId} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
              <option value="">{t('teacherSpace.classSubjects.selectClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.level})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.classSubjects.subjectLabel')}</label>
            <select value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
              {data.subjectCatalog.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.classSubjects.coefficientLabel')}</label>
            <input type="number" min="1" max="6" style={{ width: 90 }} value={draft.coefficient} placeholder="4"
              onChange={(e) => setDraft({ ...draft, coefficient: e.target.value })} />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" type="submit">{t('teacherSpace.classSubjects.addSubject')}</button>
          </div>
        </div>
      </form>

      {Object.keys(subjectsByClass).length === 0 ? (
        <div className="empty">{t('teacherSpace.classSubjects.empty')}</div>
      ) : (
        Object.entries(subjectsByClass).map(([classId, group]) => (
          <div key={classId} className="card-item" style={{ marginTop: 16 }}>
            <h4>{group.className} <span className="muted">({group.level})</span></h4>
            {group.items.length === 0 ? (
              <p className="muted">{t('teacherSpace.classSubjects.noSubjects')}</p>
            ) : (
              <div className="badges-row">
                {group.items.map((s) => (
                  <span key={s.id} className="badge-chip">
                    {s.subjectLabel} ×<input type="number" className="coef-input" min="1" max="6" value={s.coefficient ?? 1} onChange={(e) => setCoef(s, e.target.value)} />
                    {s.teacher && <em> — {s.teacher.firstName}</em>}
                    <button className="chip-remove" onClick={() => remove(s.id)} title={t('teacherSpace.classSubjects.removeTitle')}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
