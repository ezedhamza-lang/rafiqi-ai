import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function DirectorClasses() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get('/director/stats')
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <div className="loading-wrap"><span className="spinner" /></div>;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorClasses.title')}</h3>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('directorClasses.classColumn')}</th>
              <th>{t('directorClasses.levelColumn')}</th>
              <th>{t('directorClasses.studentsColumn')}</th>
              <th>{t('directorClasses.attemptsColumn')}</th>
              <th>{t('directorClasses.avgColumn')}</th>
              <th>{t('directorClasses.passColumn', 'ناجح')}</th>
              <th>{t('directorClasses.failColumn', 'راسب')}</th>
              <th>{t('directorClasses.statusColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.perClass.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.level}</td>
                <td>{c.students}</td>
                <td>{c.attempts}</td>
                <td>{c.avgPercent}%</td>
                <td>
                  <span className="badge good">{c.pass ?? 0}</span>
                </td>
                <td>
                  <span className="badge bad">{c.fail ?? 0}</span>
                </td>
                <td>
                  <span className={`badge ${c.avgPercent >= 70 ? 'good' : c.avgPercent >= 45 ? 'warn' : c.attempts === 0 ? '' : 'bad'}`}>
                    {c.attempts === 0
                      ? t('directorClasses.noActivity')
                      : c.avgPercent >= 70
                        ? t('directorClasses.active')
                        : c.avgPercent >= 45
                          ? t('directorClasses.lowActivity')
                          : t('directorClasses.weak')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
