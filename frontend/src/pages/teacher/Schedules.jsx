import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECTS = [
  { name: 'تواصل شفوي', color: '#ef4444' },
  { name: 'قراءة', color: '#3b82f6' },
  { name: 'إنتاج كتابي', color: '#ec4899' },
  { name: 'كتابة', color: '#f97316' },
  { name: 'محوظات', color: '#8b5cf6' },
  { name: 'حوار منظم', color: '#06b6d4' },
  { name: 'رياضيات', color: '#10b981' },
  { name: 'إيقاظ علمي', color: '#14b8a6' },
  { name: 'تربية إسلامية', color: '#f59e0b' },
  { name: 'تربية تكنولوجية', color: '#6366f1' },
  { name: 'لغة فرنسية', color: '#0ea5e9' },
  { name: 'تربية بدنية', color: '#22c55e' },
  { name: 'تربية موسيقية', color: '#a855f7' },
  { name: 'تربية تشكيلية', color: '#e11d48' },
  { name: 'تربية مدنية', color: '#64748b' }
];

const SESSIONS = [
  { name: 'الصباحية الأولى', time: '08:00 - 09:55', duration: 115 },
  { name: 'الصباحية الثانية', time: '10:05 - 12:00', duration: 115 },
  { name: 'الصباحية الثالثة', time: '12:05 - 13:00', duration: 55 }
];

const DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function getSubjectColor(name) {
  return SUBJECTS.find((s) => s.name === name)?.color || '#94a3b8';
}

const EMPTY_GRID = () => Array.from({ length: 3 }, () =>
  Array.from({ length: 6 }, () => [])
);

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState(EMPTY_GRID());
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const scheduleRef = useRef(null);

  const load = useCallback(() => {
    api.get('/teacher/schedules')
      .then((list) => {
        if (list.length > 0) {
          const first = list[0].class;
          setClassId(String(first.id));
          const g = EMPTY_GRID();
          list.forEach((s) => {
            if (s.day < 6 && s.session < 3) {
              g[s.session][s.day].push({ subject: s.subject, duration: s.duration || 60 });
            }
          });
          setGrid(g);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadClass = async (id) => {
    const list = await api.get('/teacher/schedules');
    const g = EMPTY_GRID();
    list.filter((s) => s.class.id === Number(id)).forEach((s) => {
      if (s.day < 6 && s.session < 3) {
        g[s.session][s.day].push({ subject: s.subject, duration: s.duration || 60 });
      }
    });
    setGrid(g);
    setSaved(null);
  };

  const addSubject = (session, day) => {
    setGrid((g) => {
      const newG = g.map((r) => r.map((c) => [...c]));
      newG[session][day].push({ subject: SUBJECTS[0].name, duration: 30 });
      return newG;
    });
    setSaved(null);
  };

  const removeSubject = (session, day, idx) => {
    setGrid((g) => {
      const newG = g.map((r) => r.map((c) => [...c]));
      newG[session][day].splice(idx, 1);
      return newG;
    });
    setSaved(null);
  };

  const updateSubject = (session, day, idx, patch) => {
    setGrid((g) => {
      const newG = g.map((r) => r.map((c) => [...c]));
      newG[session][day][idx] = { ...newG[session][day][idx], ...patch };
      return newG;
    });
    setSaved(null);
  };

  const save = async () => {
    setError('');
    try {
      const flat = [];
      grid.forEach((session, si) => {
        session.forEach((dayItems, di) => {
          dayItems.forEach((item) => {
            flat.push({ session: si, day: di, subject: item.subject, duration: item.duration });
          });
        });
      });
      const res = await api.put(`/teacher/schedules/${classId}`, { grid: flat });
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
      <html dir="rtl"><head><title>جدول توزيع المواد</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 15px; }
        h2 { text-align: center; color: #c2185b; font-size: 18px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 2px solid #e91e63; padding: 8px 6px; text-align: center; font-size: 12px; vertical-align: top; }
        th { background: #fce4ec; color: #c2185b; font-weight: 800; }
        .session-header { background: #fce4ec; font-weight: 800; color: #c2185b; writing-mode: horizontal-tb; }
        .break-row td { background: #e8f5e9; color: #2e7d32; font-weight: 700; font-size: 11px; }
        .subject-item { margin: 2px 0; padding: 2px 4px; border-radius: 4px; font-size: 11px; }
        .subject-name { font-weight: 700; }
        .subject-dur { color: #c2185b; font-weight: 800; }
        @media print { body { padding: 8mm; } }
      </style></head><body>
      <h2>جدول توزيع المواد</h2>
      ${content.innerHTML}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  };

  const getSessionTotal = (si) => {
    return grid[si].reduce((total, dayItems) =>
      total + dayItems.reduce((s, item) => s + (item.duration || 0), 0), 0);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>📋 جدول توزيع المواد</h3>
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
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: '800px',
          border: '3px solid #e91e63',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr>
              <th style={{
                background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                color: '#c2185b',
                padding: '12px 8px',
                fontSize: '0.85rem',
                fontWeight: 800,
                border: '2px solid #e91e63',
                width: '100px'
              }}>الحصة / اليوم</th>
              {DAYS.map((day, i) => (
                <th key={i} style={{
                  background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                  color: '#c2185b',
                  padding: '12px 6px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  border: '2px solid #e91e63',
                  minWidth: '110px'
                }}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((session, si) => (
              <>
                <tr key={`session-${si}`}>
                  <td rowSpan={1} style={{
                    background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                    color: '#c2185b',
                    fontWeight: 800,
                    padding: '10px 6px',
                    fontSize: '0.82rem',
                    border: '2px solid #e91e63',
                    textAlign: 'center',
                    verticalAlign: 'middle'
                  }}>
                    <div style={{ fontWeight: 800 }}>{session.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{session.time}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{getSessionTotal(si)} دقيقة</div>
                  </td>
                  {DAYS.map((_, di) => {
                    const items = grid[si][di];
                    return (
                      <td
                        key={di}
                        onClick={() => !editingCell && addSubject(si, di)}
                        style={{
                          border: '2px solid #e91e63',
                          padding: '6px 4px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: items.length > 0 ? '#fff' : '#fafafa',
                          verticalAlign: 'top',
                          minHeight: '80px'
                        }}
                      >
                        {items.map((item, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px',
                            margin: '2px 0',
                            padding: '3px 4px',
                            borderRadius: '6px',
                            background: getSubjectColor(item.subject) + '15',
                            border: `1px solid ${getSubjectColor(item.subject)}30`
                          }}>
                            <span style={{ fontWeight: 800, fontSize: '0.78rem', color: getSubjectColor(item.subject) }}>
                              {item.subject}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#c2185b', fontWeight: 800 }}>
                              {item.duration}د
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeSubject(si, di, idx); }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px' }}
                            >✕</button>
                          </div>
                        ))}
                        {items.length === 0 && (
                          <span style={{ color: '#f48fb1', fontSize: '1.2rem' }}>+</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {si < 2 && (
                  <tr key={`break-${si}`} className="break-row">
                    <td colSpan={7} style={{
                      background: '#e8f5e9',
                      color: '#2e7d32',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      padding: '4px',
                      border: '2px solid #e91e63',
                      textAlign: 'center'
                    }}>
                      استراحة {si === 0 ? '10 دقائق' : '5 دقائق'}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {editingCell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '350px', maxHeight: '80vh', overflow: 'auto' }}>
            <h4 style={{ marginBottom: '1rem', color: '#c2185b' }}>إضافة مادة</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select id="edit-subject" style={{ padding: '0.5rem', border: '2px solid #e91e63', borderRadius: '8px', fontSize: '0.9rem' }}>
                {SUBJECTS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input id="edit-duration" type="number" defaultValue={30} min={5} max={180} step={5}
                style={{ padding: '0.5rem', border: '2px solid #e91e63', borderRadius: '8px', fontSize: '0.9rem' }}
                placeholder="المدة (دقيقة)" />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => {
                  const subject = document.getElementById('edit-subject').value;
                  const duration = parseInt(document.getElementById('edit-duration').value) || 30;
                  const [si, di] = editingCell;
                  setGrid((g) => {
                    const newG = g.map((r) => r.map((c) => [...c]));
                    newG[si][di].push({ subject, duration });
                    return newG;
                  });
                  setEditingCell(null);
                  setSaved(null);
                }}>إضافة</button>
                <button className="btn" onClick={() => setEditingCell(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#fce4ec', borderRadius: '12px', border: '2px solid #f48fb1' }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#c2185b', marginBottom: '0.5rem' }}>📦 المواد الدراسية</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {SUBJECTS.map((s) => (
            <span key={s.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
              background: s.color + '18', color: s.color, border: `1px solid ${s.color}35`
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <p className="muted note" style={{ marginTop: '0.8rem', fontSize: '0.82rem' }}>
        💡 انقر على + لإضافة مادة. اختر المادة والمدة. اضغط على ✕ للحذف.
      </p>
    </div>
  );
}
