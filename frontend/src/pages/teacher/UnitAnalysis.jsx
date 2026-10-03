import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { subjectLabel } from '../../utils/labels.js';

export default function UnitAnalysis({ classes }) {
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState('');
  const [averages, setAverages] = useState([]);

  useEffect(() => {
    api
      .get('/teacher/averages')
      .then((data) => setAverages(data))
      .catch(() => {});
  }, []);

  const filtered = selected ? averages.filter((a) => a.className === selected) : averages;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.unitAnalysis.title')}</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">{t('teacherSpace.unitAnalysis.allClasses')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">{t('teacherSpace.unitAnalysis.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('teacherSpace.unitAnalysis.quizCol')}</th>
                <th>{t('teacherSpace.unitAnalysis.subjectCol')}</th>
                <th>{t('teacherSpace.unitAnalysis.classCol')}</th>
                <th>{t('teacherSpace.unitAnalysis.attemptsCol')}</th>
                <th>{t('teacherSpace.unitAnalysis.avgCol')}</th>
                <th>{t('teacherSpace.unitAnalysis.statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const good = a.avgPercent >= 70;
                const mid = a.avgPercent >= 45;
                return (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{subjectLabel(a.subject, lang)}</td>
                    <td>{a.className}</td>
                    <td>{a.attempts}</td>
                    <td>{a.avgPercent}%</td>
                    <td>
                      <span className={`badge ${good ? 'good' : mid ? 'warn' : 'bad'}`}>
                        {good ? t('teacherSpace.unitAnalysis.good') : mid ? t('teacherSpace.unitAnalysis.medium') : t('teacherSpace.unitAnalysis.weak')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
