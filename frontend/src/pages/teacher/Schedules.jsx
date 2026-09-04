import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECTS = [
  { name: 'الرياضيات', color: '#3b82f6' },
  { name: 'القراءة', color: '#10b981' },
  { name: 'الإيقاظ العلمي', color: '#f59e0b' },
  { name: 'الإنتاج الكتابي', color: '#ef4444' },
  { name: 'الخط والإملاء', color: '#8b5cf6' },
  { name: 'اللغة العربية', color: '#ec4899' },
  { name: 'اللغة الفرنسية', color: '#06b6d4' },
  { name: 'التربية الإسلامية', color: '#f97316' },
  { name: 'التربية المدنية', color: '#64748b' },
  { name: 'التنشيط', color: '#14b8a6' }
];

const PERIOD_TIMES = [
  { start: '08:00', end: '08:50' },
  { start: '09:00', end: '09:50' },
  { start: '10:00', end: '10:50' },
  { start: '11:00', end: '11:50' },
  { start: '14:00', end: '14:50' },
  { start: '15:00', end: '15:50' }
];

const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

function getSubjectColor(name) {
  return SUBJECTS.find((s) => s.name === name)?.color || '#94a3b8';
}

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState(Array.from({ length: 6 }, () => Array(6).fill({ filled: false, subject: '' })));
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const scheduleRef = useRef(null);

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
      updateCell(day, period, { filled: true, subject: SUBJECTS[0].name });
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

  const printSchedule = () => {
    const content = scheduleRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html dir="rtl"><head><title>جدول الأوقات</title>
      <style>
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 20px; }
        h2 { text-align: center; color: #1a237e; margin-bottom: 5px; }
        .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 2px solid #1a237e; padding: 10px; text-align: center; font-size: 13px; }
        th { background: #1a237e; color: #fff; font-weight: 800; }
        .day-header { background: #e8eaf6; font-weight: 800; color: #1a237e; }
        .period-time { font-size: 10px; color: #666; display: block; }
        .subject-cell { font-weight: 700; font-size: 13px; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      <h2>جدول الأوقات الأسبوعي</h2>
      <p class="subtitle">السنة الدراسية 2026-2027</p>
      ${content.innerHTML}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  };

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
          <button className="btn" onClick={printSchedule}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={save} disabled={!classId}>{t('teacherSpace.schedules.saveSchedule')}</button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {saved && <div className="form-success">{t('teacherSpace.schedules.savedMsg', { n: saved.count })}</div>}

      <div ref={scheduleRef} style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={{
                background: '#1a237e',
                color: '#fff',
                padding: '12px 10px',
                fontSize: '0.9rem',
                fontWeight: 800,
                border: '2px solid #1a237e',
                width: '100px'
              }}>اليوم / الفترات</th>
              {PERIOD_TIMES.map((pt, i) => (
                <th key={i} style={{
                  background: i < 4 ? '#1a237e' : '#4a148c',
                  color: '#fff',
                  padding: '10px 8px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  border: '2px solid #1a237e',
                  minWidth: '90px'
                }}>
                  <span>الفترة {i + 1}</span>
                  <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
                    {pt.start} - {pt.end}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={di}>
                <td style={{
                  background: '#e8eaf6',
                  color: '#1a237e',
                  fontWeight: 800,
                  padding: '12px 8px',
                  fontSize: '0.9rem',
                  border: '2px solid #c5cae9',
                  textAlign: 'center'
                }}>
                  <span style={{ display: 'block' }}>{day}</span>
                  <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 400 }}>
                    {PERIOD_TIMES[0].start} - {PERIOD_TIMES[5].end}
                  </span>
                </td>
                {[0, 1, 2, 3, 4, 5].map((pi) => {
                  const cell = grid[di][pi];
                  const isBreak = pi === 4 && di !== -1;
                  return (
                    <td
                      key={pi}
                      onClick={() => toggleCell(di, pi)}
                      style={{
                        border: '2px solid #c5cae9',
                        padding: '8px 6px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: cell.filled ? getSubjectColor(cell.subject) + '18' : '#fff',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      {cell.filled ? (
                        <div>
                          <select
                            value={cell.subject}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateCell(di, pi, { subject: e.target.value })}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: getSubjectColor(cell.subject),
                              textAlign: 'center',
                              fontFamily: 'inherit',
                              cursor: 'pointer',
                              width: '100%',
                              padding: '4px'
                            }}
                          >
                            {SUBJECTS.map((s) => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                          <div style={{
                            width: '100%',
                            height: '3px',
                            background: getSubjectColor(cell.subject),
                            borderRadius: '2px',
                            marginTop: '2px'
                          }} />
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '1.2rem' }}>+</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', padding: '0.8rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1a237e', width: '100%', marginBottom: '0.3rem' }}>المواد:</span>
        {SUBJECTS.map((s) => (
          <span key={s.name} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: s.color + '15',
            color: s.color,
            border: `1px solid ${s.color}30`
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <p className="muted note" style={{ marginTop: '0.8rem' }}>
        💡 انقر على خلية فارغة لإضافة مادة. اختر المادة من القائمة. اضغط على طباعة للحصول على نسخة PDF.
      </p>
    </div>
  );
}
