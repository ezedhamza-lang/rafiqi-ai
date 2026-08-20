import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECTS = ['الرياضيات', 'القراءة', 'الإيقاظ العلمي', 'العربية', 'الفرنسية', 'التنشيط', 'التربية المدنية'];

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState(Array.from({ length: 6 }, () => Array(6).fill({ filled: false, subject: '' })));
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/teacher/schedules')
      .then((list) => {
        if (list.length > 0) {
          const first = list[0].class;
          setClassId(String(first.id));
          const g = Array.from({ length: 6 }, () => Array(6).fill({ filled: false, subject: '' }));
          list.forEach((s) => {
            g[s.day][s.period] = { filled: true, subject: s.subject };
          });
          setGrid(g);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadClass = async (id) => {
    const list = await api.get('/teacher/schedules');
    const g = Array.from({ length: 6 }, () => Array(6).fill({ filled: false, subject: '' }));
    list.filter((s) => s.class.id === Number(id)).forEach((s) => {
      g[s.day][s.period] = { filled: true, subject: s.subject };
    });
    setGrid(g);
    setSaved(null);
  };

  const updateCell = (day, period, patch) => {
    setGrid((g) => g.map((d, di) => (di === day ? d.map((c, pi) => (pi === period ? { ...c, ...patch } : c)) : d)));
    setSaved(null);
  };

  const toggleCell = (day, period) => {
    const cell = grid[day][period];
    if (cell.filled) {
      updateCell(day, period, { filled: false, subject: '' });
    } else {
      updateCell(day, period, { filled: true, subject: SUBJECTS[0] });
    }
  };

  const save = async () => {
    setError('');
    try {
      const res = await api.put(`/teacher/schedules/${classId}`, { grid });
      setSaved(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const days = t('time.days');

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.schedules.title')}</h3>
        <div className="btn-group">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); loadClass(e.target.value); }}>
            <option value="">{t('teacherSpace.schedules.selectClass')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={save} disabled={!classId}>{t('teacherSpace.schedules.saveSchedule')}</button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {saved && <div className="form-success">{t('teacherSpace.schedules.savedMsg', { n: saved.count })}</div>}

      <div className="schedule-grid">
        <div className="schedule-row head">
          <div className="schedule-cell">{t('teacherSpace.schedules.dayHeader')}</div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="schedule-cell">{t('time.period', { n: i + 1 })}</div>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((di) => (
          <div key={di} className="schedule-row">
            <div className="schedule-cell day">{Array.isArray(days) ? days[di] : t(`time.days.${di}`)}</div>
            {[0, 1, 2, 3, 4, 5].map((pi) => {
              const cell = grid[di][pi];
              return (
                <div
                  key={pi}
                  className={`schedule-cell slot ${cell.filled ? 'filled' : ''}`}
                  onClick={() => toggleCell(di, pi)}
                >
                  {cell.filled && (
                    <select
                      value={cell.subject}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCell(di, pi, { subject: e.target.value })}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {!cell.filled && <span className="add-hint">+</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="muted note">{t('teacherSpace.schedules.note')}</p>
    </div>
  );
}
