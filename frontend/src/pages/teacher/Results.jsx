import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Results() {
  const { t } = useI18n();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/teacher/results')
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.results.title')}</h3>
      </div>
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
                <th>{t('teacherSpace.results.avgCol')}</th>
                <th>{t('teacherSpace.results.ratingCol')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.student.id}>
                  <td>{r.student.firstName} {r.student.lastName}</td>
                  <td>{r.attempts.length}</td>
                  <td>{r.avgPercent}%</td>
                  <td>
                    <span className={`badge ${r.avgPercent >= 70 ? 'good' : r.avgPercent >= 45 ? 'warn' : 'bad'}`}>
                      {r.avgPercent >= 70 ? t('teacherSpace.results.good') : r.avgPercent >= 45 ? t('teacherSpace.results.medium') : t('teacherSpace.results.needsSupport')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
