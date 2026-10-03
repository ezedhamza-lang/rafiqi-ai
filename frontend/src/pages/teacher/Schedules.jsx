import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { subjectLabel, levelLabel } from '../../utils/labels';

const DAYS = [
  { n: 1, key: 'mon' }, { n: 2, key: 'tue' }, { n: 3, key: 'wed' },
  { n: 4, key: 'thu' }, { n: 5, key: 'fri' }, { n: 6, key: 'sat' }
];
const DAY_LABELS_FALLBACK = ['', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function Schedules() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/teacher/schedules').then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => (data?.classes || []).find((c) => String(c.class.id) === String(classId)), [data, classId]);
  const slots = data?.slots || [];

  useEffect(() => {
    const g = {};
    for (const cell of current?.grid || []) g[`${cell.day}-${cell.period}`] = cell.subject;
    setGrid(g);
    setError('');
    setInfo('');
  }, [current]);

  const dayName = (n) => {
    const key = DAYS.find((d) => d.n === n)?.key;
    const tr = key ? t(`teacherSpace.schedules.days.${key}`) : '';
    return tr || DAY_LABELS_FALLBACK[n];
  };

  const programmed = (current?.subjects || []);
  const setCell = (day, period, subject) => setGrid((g) => ({ ...g, [`${day}-${period}`]: subject }));

  const counts = useMemo(() => {
    const c = {};
    Object.values(grid).forEach((s) => { if (s) c[s] = (c[s] || 0) + 1; });
    return c;
  }, [grid]);

  const save = async () => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const cells = Object.entries(grid)
        .filter(([, s]) => !!s)
        .map(([k, s]) => { const [d, p] = k.split('-').map(Number); return { day: d, period: p, subject: s }; });
      await api.put(`/teacher/schedules/${current.class.id}`, { grid: cells });
      setInfo(t('teacherSpace.schedules.savedOk'));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const clearGrid = () => setGrid({});

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;

  const cellSubject = (s) => {
    const p = programmed.find((x) => x.subject === s);
    return p;
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.schedules.title')}</h3>
        <div className="btn-group no-print">
          <button className="btn" onClick={() => window.print()}>{t('teacherSpace.schedules.print')}</button>
          {classId && (
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? t('common.loading') : t('teacherSpace.schedules.saveSchedule')}
            </button>
          )}
        </div>
      </div>
      <p className="sub">{t('teacherSpace.schedules.intro')}</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      {info && <div className="form-success" role="status">{info}</div>}

      <div className="form-row no-print" style={{ marginBottom: '0.8rem' }}>
        <div className="form-group grow">
          <label>{t('teacherSpace.schedules.selectClass')}</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('teacherSpace.schedules.pickClass')}</option>
            {data.classes.map(({ class: c }) => (
              <option key={c.id} value={c.id}>{c.name} — {levelLabel(c.level, lang)}</option>
            ))}
          </select>
        </div>
      </div>

      {classId && programmed.length === 0 && (
        <div className="form-error no-print">{t('teacherSpace.schedules.noneProgrammed')}</div>
      )}

      {classId && (
        <>
          <div className="table-wrap schedule-wrap">
            <table className="data-table schedule-grid">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>{t('teacherSpace.schedules.dayHeader')}</th>
                  {slots.map((s) => (
                    <th key={s.n}>{t('teacherSpace.schedules.periodN', { n: s.n })}<br /><span className="muted">{s.from} — {s.to}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d.n}>
                    <th>{dayName(d.n)}</th>
                    {slots.map((s) => {
                      const cellKey = `${d.n}-${s.n}`;
                      const val = grid[cellKey] || '';
                      const cs = cellSubject(val);
                      return (
                        <td key={s.n} style={cs ? { background: '#eef6fb' } : {}}>
                          <select className="schedule-cell-select no-print" value={val} onChange={(e) => setCell(d.n, s.n, e.target.value)}>
                            <option value="">—</option>
                            {programmed.map((p) => (
                              <option key={p.subject} value={p.subject}>
                                {subjectLabel(p.subject)}{p.teacher ? ` (${p.teacher.firstName})` : ''}
                              </option>
                            ))}
                          </select>
                          {val && <div className="schedule-cell-print"><b>{subjectLabel(val)}</b>{cs?.teacher ? <div className="muted">{cs.teacher.firstName} {cs.teacher.lastName}</div> : null}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-item" style={{ marginTop: '0.9rem' }}>
            <h4>{t('teacherSpace.schedules.weeklyLoad')}</h4>
            <div className="badges-row">
              {programmed.map((p) => (
                <span key={p.subject} className="badge-chip">
                  {subjectLabel(p.subject)} — {(counts[p.subject] || 0) * 45} {t('teacherSpace.schedules.minutesUnit')} · ×{p.coefficient}
                </span>
              ))}
              <button className="btn btn-outline btn-sm no-print" onClick={clearGrid}>{t('teacherSpace.schedules.clear')}</button>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>{t('teacherSpace.schedules.note')}</p>
          </div>
        </>
      )}
    </div>
  );
}
