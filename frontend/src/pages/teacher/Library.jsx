import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const RESOURCE_KIND_CODES = ['WORKSHEET', 'HOMEWORK', 'FLASHCARDS', 'PRESENTATION', 'LESSON_PLAN'];

export default function Library() {
  const { t } = useI18n();
  const [resources, setResources] = useState([]);
  const [filters, setFilters] = useState({ subject: '', level: '', kind: '' });
  const [view, setView] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && q.set(k, v));
    api
      .get(`/teacher/library${q.toString() ? `?${q}` : ''}`)
      .then(setResources)
      .catch((e) => setError(e.message));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const content = view?.content || {};

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.library.title')}</h3>
        <p className="muted">{t('teacherSpace.library.subtitle')}</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}

      <div className="form-row" style={{ marginBottom: '0.8rem' }}>
        <div className="form-group">
          <label>{t('teacherSpace.library.subjectLabel')}</label>
          <select value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })}>
            <option value="">{t('teacherSpace.library.allSubjects')}</option>
            {['MATH', 'READING', 'SCIENCE', 'STORIES'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.library.levelLabel')}</label>
          <input value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })} placeholder={t('teacherSpace.library.levelPlaceholder')} />
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.library.kindLabel')}</label>
          <select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
            <option value="">{t('teacherSpace.library.allKinds')}</option>
            {RESOURCE_KIND_CODES.map((code) => (
              <option key={code} value={code}>{t(`teacherSpace.common.resourceKinds.${code}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {!view ? (
        resources.length === 0 ? (
          <div className="empty">{t('teacherSpace.library.empty')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('teacherSpace.library.titleCol')}</th>
                  <th>{t('teacherSpace.library.subjectCol')}</th>
                  <th>{t('teacherSpace.library.levelCol')}</th>
                  <th>{t('teacherSpace.library.kindCol')}</th>
                  <th>{t('teacherSpace.library.publisherCol')}</th>
                  <th>{t('teacherSpace.library.actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.subject}</td>
                    <td>{r.level}</td>
                    <td>{t(`teacherSpace.common.resourceKinds.${r.kind}`) || r.kind}</td>
                    <td>{r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName}` : '—'}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setView(r)}>{t('teacherSpace.library.view')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="memo-view">
          <div className="panel-head">
            <h4>{view.title} <span className="muted">— {view.teacher ? `${view.teacher.firstName} ${view.teacher.lastName}` : '—'}</span></h4>
            <div className="btn-group">
              <button className="btn" onClick={() => window.print()}>{t('teacherSpace.library.print')}</button>
              <button className="btn" onClick={() => setView(null)}>{t('teacherSpace.library.back')}</button>
            </div>
          </div>

          {view.kind === 'WORKSHEET' && (
            <div>
              <p><strong>{t('teacherSpace.library.instructionsLabel')}</strong> {content.instructions}</p>
              {content.exercises?.map((ex, i) => (
                <div key={i} className="stage-item">
                  <p><strong>{i + 1}. </strong>{ex.prompt}</p>
                  {ex.options && <p className="muted">{ex.options.join(' — ')}</p>}
                </div>
              ))}
            </div>
          )}
          {view.kind === 'HOMEWORK' && (
            <div>
              <p><strong>{t('teacherSpace.library.durationDaysLabel')}</strong> {content.dueDays} {t('teacherSpace.library.daysSuffix')}</p>
              <ul>{content.tasks?.map((tItem, i) => <li key={i}>{tItem}</li>)}</ul>
            </div>
          )}
          {view.kind === 'FLASHCARDS' && (
            <div className="cards-grid">
              {content.cards?.map((c, i) => (
                <div key={i} className="card-item"><strong>{c.front}</strong><p className="muted">{c.back}</p></div>
              ))}
            </div>
          )}
          {view.kind === 'PRESENTATION' && (
            <div>
              {content.slides?.map((s, i) => (
                <div key={i} className="stage-item slide-card">
                  <h5>{t('teacherSpace.library.slideLabel', { n: i + 1, title: s.title })}</h5>
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
