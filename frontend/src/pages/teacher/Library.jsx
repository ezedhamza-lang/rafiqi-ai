import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { subjectLabel, SUBJECT_CODES } from '../../utils/labels';
import ResourcePaper from '../../components/ResourcePaper.jsx';

const RESOURCE_KIND_CODES = ['WORKSHEET', 'HOMEWORK', 'FLASHCARDS', 'PRESENTATION', 'LESSON_PLAN'];
const LEVELS = [
  'السنة الأولى أساسي',
  'السنة الثانية أساسي',
  'السنة الثالثة أساسي',
  'السنة الرابعة أساسي',
  'السنة الخامسة أساسي',
  'السنة السادسة أساسي'
];
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
            {SUBJECT_CODES.map((s) => (
              <option key={s} value={s}>{subjectLabel(t, s)}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.library.levelLabel')}</label>
          <select value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })}>
            <option value="">{t('teacherSpace.library.allLevels')}</option>
            {LEVELS.map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </select>
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
                    <td>{subjectLabel(t, r.subject)}</td>
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

          <ResourcePaper resource={view} />
        </div>
      )}
    </div>
  );
}
