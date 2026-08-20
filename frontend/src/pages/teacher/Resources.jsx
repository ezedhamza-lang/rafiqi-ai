import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const RESOURCE_KIND_CODES = ['WORKSHEET', 'HOMEWORK', 'FLASHCARDS', 'PRESENTATION'];

export default function Resources() {
  const { t } = useI18n();
  const [resources, setResources] = useState([]);
  const [kind, setKind] = useState('WORKSHEET');
  const [form, setForm] = useState({ lessonTitle: '' });
  const [view, setView] = useState(null);
  const [error, setError] = useState('');

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
    try {
      const res = await api.post('/teacher/resources', {
        kind,
        subject: 'MATH',
        level: 'السنة الأولى أساسي',
        lessonTitle: form.lessonTitle,
        input: {}
      });
      setView(res);
      load(kind);
    } catch (err) {
      setError(err.message);
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
      await api.put(`/teacher/resources/${r.id}/share`, { shared: !r.isShared });
      load(kind);
    } catch (err) {
      setError(err.message);
    }
  };

  const content = view?.content || {};
  const kindLabel = t(`teacherSpace.common.resourceKinds.${kind}`);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.resources.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
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
              <button className="btn btn-primary" type="submit">
                {t('teacherSpace.resources.generateBtn', { kind: kindLabel })}
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
              <button className="btn" onClick={rebuild}>{t('teacherSpace.resources.rebuild')}</button>
              <button className="btn" onClick={() => setView(null)}>{t('teacherSpace.resources.back')}</button>
            </div>
          </div>

          {kind === 'WORKSHEET' && (
            <div>
              <p><strong>{t('teacherSpace.resources.instructionsLabel')}</strong> {content.instructions}</p>
              {content.exercises?.map((ex, i) => (
                <div key={i} className="stage-item">
                  <p><strong>{i + 1}. </strong>{ex.prompt}</p>
                  {ex.options && <p className="muted">{ex.options.join(' — ')}</p>}
                </div>
              ))}
            </div>
          )}

          {kind === 'HOMEWORK' && (
            <div>
              <p><strong>{t('teacherSpace.resources.durationDaysLabel')}</strong> {content.dueDays} {t('teacherSpace.resources.daysSuffix')}</p>
              <ul>
                {content.tasks?.map((tItem, i) => (
                  <li key={i}>{tItem}</li>
                ))}
              </ul>
            </div>
          )}

          {kind === 'FLASHCARDS' && (
            <div className="cards-grid">
              {content.cards?.map((c, i) => (
                <div key={i} className="card-item">
                  <strong>{c.front}</strong>
                  <p className="muted">{c.back}</p>
                </div>
              ))}
            </div>
          )}

          {kind === 'PRESENTATION' && (
            <div>
              {content.slides?.map((s, i) => (
                <div key={i} className="stage-item slide-card">
                  <h5>{t('teacherSpace.resources.slideLabel', { n: i + 1, title: s.title })}</h5>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
