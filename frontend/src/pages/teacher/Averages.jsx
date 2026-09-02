import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Averages() {
  const { t } = useI18n();
  const [averages, setAverages] = useState([]);

  const load = useCallback(() => {
    api
      .get('/teacher/averages')
      .then(setAverages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.averages.title')}</h3>
      </div>
      {averages.length === 0 ? (
        <div className="empty">{t('teacherSpace.averages.empty')}</div>
      ) : (
        <div className="cards-grid">
          {averages.map((a) => (
            <div key={a.id} className="card-item avg-card">
              <h4>{a.title}</h4>
              <p className="sub">{a.className}</p>
              <div className="avg-big">{a.avgPercent}%</div>
              <p className="muted">{t('teacherSpace.averages.attemptsCount', { n: a.attempts })}</p>
              <div className="progress">
                <div className={`progress-bar ${a.avgPercent >= 70 ? 'good' : a.avgPercent >= 45 ? 'warn' : 'bad'}`} style={{ width: `${a.avgPercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
