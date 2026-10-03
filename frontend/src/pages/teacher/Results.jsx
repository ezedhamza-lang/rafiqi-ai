import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { kindLabel } from '../../utils/labels.js';

export default function Results() {
  const { t, lang } = useI18n();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/teacher/results')
      .then(setResults)
      // كان catch يستدعي setError غير المعرَّف ⇒ أي فشل في الطلب يبتلع نفسه
      .catch((e) => setError(e.message || t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.results.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}
      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && results.length === 0 ? (
        <div className="empty">{t('teacherSpace.results.empty')}</div>
      ) : !loading ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.results.studentCol')}</th>
                <th>{t('teacherSpace.results.attemptsCol')}</th>
                <th>{t('teacherSpace.results.examsCol')}</th>
                <th>{t('teacherSpace.results.assignmentsCol')}</th>
                <th>{t('teacherSpace.results.pendingCol')}</th>
                <th>{t('teacherSpace.results.avgCol')}</th>
                <th>{t('teacherSpace.results.ratingCol')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const b = r.breakdown || { quizzes: 0, exams: 0, assignments: 0 };
                const isOpen = expanded[r.student.id];
                return (
                  <Fragment key={r.student.id}>
                    <tr>
                      <td>{r.student.firstName} {r.student.lastName}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => setExpanded({ ...expanded, [r.student.id]: !isOpen })}
                        >
                          {r.attempts.length} ▾
                        </button>
                      </td>
                      <td>{b.exams || 0}</td>
                      <td>{b.assignments || 0}</td>
                      <td>
                        {r.pendingManual > 0 ? (
                          <span className="badge warn">{t('teacherSpace.results.pendingBadge', { n: r.pendingManual })}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{r.avgPercent}%</td>
                      <td>
                        <span className={`badge ${r.avgPercent >= 70 ? 'good' : r.avgPercent >= 45 ? 'warn' : 'bad'}`}>
                          {r.avgPercent >= 70 ? t('teacherSpace.results.good') : r.avgPercent >= 45 ? t('teacherSpace.results.medium') : t('teacherSpace.results.needsSupport')}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan="7">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>{t('teacherSpace.results.workCol')}</th>
                                <th>{t('teacherSpace.results.kindCol')}</th>
                                <th>{t('teacherSpace.results.scoreCol')}</th>
                                <th>{t('teacherSpace.results.percentCol')}</th>
                                <th>{t('teacherSpace.results.statusCol')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.attempts.map((a, idx) => (
                                <tr key={`${a.kind}-${idx}`}>
                                  <td>{a.title || '—'}</td>
                                  <td>{kindLabel(a.kind, lang)}</td>
                                  <td>{a.score === null || a.score === undefined ? '—' : `${a.score} / ${a.max}`}</td>
                                  <td>{typeof a.percent === 'number' ? `${a.percent}%` : '—'}</td>
                                  <td>
                                    {a.pendingManualGrading ? (
                                      <span className="badge warn">{t('teacherSpace.results.pendingShort')}</span>
                                    ) : (
                                      a.status || '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}