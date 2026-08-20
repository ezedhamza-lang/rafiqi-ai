import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const DAY_KEYS = [0, 1, 2, 3, 4, 5];
const PERIOD_KEYS = [1, 2, 3, 4, 5, 6];

export default function StudentSchedule() {
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/teacher/schedules/student/my')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;

  const days = t('time.days');

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{data.class ? t('studentSpace.schedule.titleWithClass', { className: data.class.name }) : t('studentSpace.schedule.title')}</h3>
      </div>
      {!data.class ? (
        <div className="empty">{t('studentSpace.schedule.noClass')}</div>
      ) : (
        <div className="schedule-grid">
          <div className="schedule-row head">
            <div className="schedule-cell">{t('studentSpace.schedule.dayHeader')}</div>
            {PERIOD_KEYS.map((p, i) => (
              <div key={i} className="schedule-cell">{t('time.period', { n: p })}</div>
            ))}
          </div>
          {DAY_KEYS.map((di) => (
            <div key={di} className="schedule-row">
              <div className="schedule-cell day">{Array.isArray(days) ? days[di] : t(`time.days.${di}`)}</div>
              {PERIOD_KEYS.map((_, pi) => {
                const cell = data.grid[di][pi];
                return (
                  <div key={pi} className={`schedule-cell slot ${cell ? 'filled' : ''}`}>
                    {cell ? cell.subject : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
