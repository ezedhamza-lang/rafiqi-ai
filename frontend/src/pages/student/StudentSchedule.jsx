import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { subjectLabel } from '../../utils/labels';

const DAYS = [
  { n: 1, key: 'mon' }, { n: 2, key: 'tue' }, { n: 3, key: 'wed' },
  { n: 4, key: 'thu' }, { n: 5, key: 'fri' }, { n: 6, key: 'sat' }
];
const DAY_FALLBACK = ['', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function StudentSchedule() {
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/teacher/schedules/student/my').then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;
  if (!data.class) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>{t('studentSpace.schedule.title')}</h3></div>
        <div className="empty">{t('studentSpace.schedule.noClass')}</div>
      </div>
    );
  }

  const dayName = (n) => {
    const key = DAYS.find((d) => d.n === n)?.key;
    return (key ? t(`studentSpace.schedule.days.${key}`) : '') || DAY_FALLBACK[n];
  };

  const grid = data.grid || [];
  const slots = data.slots || [];
  const legacy = data.distribution?.subjects;

  if (!grid.length) {
    if (legacy && legacy.length) {
      return (
        <div className="panel">
          <div className="panel-head"><h3>{t('studentSpace.schedule.title')}</h3></div>
          <div className="empty">{t('studentSpace.schedule.empty')}</div>
          <div className="badges-row">
            {legacy.map((s, i) => (
              <span key={i} className="badge-chip">{s.name} — {s.hours} س</span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="panel">
        <div className="panel-head"><h3>{t('studentSpace.schedule.title')}</h3></div>
        <div className="empty">{t('studentSpace.schedule.empty')}</div>
      </div>
    );
  }

  const cell = (d, p) => grid.find((g) => g.day === d && g.period === p);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.schedule.titleWithClass', { className: data.class.name })}</h3>
      </div>
      <div className="table-wrap">
        <table className="data-table schedule-grid">
          <thead>
            <tr>
              <th style={{ width: '110px' }}>{t('studentSpace.schedule.day')}</th>
              {slots.map((s) => (
                <th key={s.n}>{t('studentSpace.schedule.periodN', { n: s.n })}<br /><span className="muted">{s.from} — {s.to}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.n}>
                <th>{dayName(d.n)}</th>
                {slots.map((s) => {
                  const g = cell(d.n, s.n);
                  return (
                    <td key={s.n} style={g ? { background: '#eef6fb' } : {}}>
                      {g ? (
                        <div className="schedule-cell-print">
                          <b>{g.subjectLabel || subjectLabel(g.subject)}</b>
                          {g.teacher ? <div className="muted">{g.teacher.firstName} {g.teacher.lastName}</div> : null}
                        </div>
                      ) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
