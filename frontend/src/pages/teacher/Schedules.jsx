import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECTS = [
  { name: 'اللغة العربية', color: '#ef4444', desc: 'القراءة، الإنتاج الكتابي، قواعد اللغة' },
  { name: 'الرياضيات', color: '#3b82f6', desc: 'لجميع السنوات' },
  { name: 'التربية الإسلامية', color: '#f97316', desc: 'منذ السنة الأولى' },
  { name: 'الإيقاظ العلمي', color: '#10b981', desc: 'علوم وتكنولوجيا مبسطة' },
  { name: 'التنشئة التشكيلية', color: '#ec4899', desc: 'أنشطة فنية' },
  { name: 'التربية الموسيقية', color: '#a855f7', desc: 'أنشطة موسيقية' },
  { name: 'التربية البدنية', color: '#14b8a6', desc: 'الرياضة المدرسية' },
  { name: 'اللغة الفرنسية', color: '#06b6d4', desc: 'من السنة الثانية' },
  { name: 'اللغة الإنجليزية', color: '#6366f1', desc: 'من السنة الرابعة' },
  { name: 'الدراسات الاجتماعية', color: '#8b5cf6', desc: 'التاريخ، الجغرافيا، التربية المدنية - من السنة الخامسة' },
  { name: 'تكنولوجيا المعلومات', color: '#f59e0b', desc: 'الحوسبة' },
  { name: 'المهارات المهنية', color: '#78716c', desc: 'من الصفوف العليا' }
];

const TIME_BLOCKS = [
  { label: '08:00 - 10:00', start: '08:00', end: '10:00' },
  { label: '10:00 - 12:00', start: '10:00', end: '12:00' },
  { label: '12:00 - 13:00', start: '12:00', end: '13:00' },
  { label: '13:00 - 15:00', start: '13:00', end: '15:00' },
  { label: '15:00 - 17:00', start: '15:00', end: '17:00' }
];

const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

function getSubjectColor(name) {
  return SUBJECTS.find((s) => s.name === name)?.color || '#94a3b8';
}

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [grid, setGrid] = useState(Array.from({ length: 6 }, () => Array(5).fill({ filled: false, subject: '' })));
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
          const g = Array.from({ length: 6 }, () => Array(5).fill({ filled: false, subject: '' }));
          list.forEach((s) => {
            if (s.day < 6 && s.period < 5) g[s.day][s.period] = { filled: true, subject: s.subject };
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
    const g = Array.from({ length: 6 }, () => Array(5).fill({ filled: false, subject: '' }));
    list.filter((s) => s.class.id === Number(id)).forEach((s) => {
      if (s.day < 6 && s.period < 5) g[s.day][s.period] = { filled: true, subject: s.subject };
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
      <html dir="rtl"><head><title>جدول توزيع المواد</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 20px; }
        h2 { text-align: center; color: #e91e63; margin-bottom: 5px; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 2px solid #e91e63; padding: 12px 8px; text-align: center; font-size: 14px; }
        th { background: #fce4ec; color: #c2185b; font-weight: 800; }
        td.day-cell { background: #fce4ec; font-weight: 800; color: #c2185b; }
        @media print { body { padding: 10mm; } }
      </style></head><body>
      <h2>جدول توزيع المواد</h2>
      ${content.innerHTML}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
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
          minWidth: '650px',
          border: '3px solid #e91e63',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr>
              <th style={{
                background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                color: '#c2185b',
                padding: '14px 10px',
                fontSize: '1rem',
                fontWeight: 800,
                border: '2px solid #e91e63',
                width: '90px'
              }}></th>
              {TIME_BLOCKS.map((tb, i) => (
                <th key={i} style={{
                  background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                  color: '#c2185b',
                  padding: '12px 8px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  border: '2px solid #e91e63',
                  minWidth: '100px'
                }}>
                  {tb.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={di}>
                <td style={{
                  background: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
                  color: '#c2185b',
                  fontWeight: 800,
                  padding: '14px 8px',
                  fontSize: '0.95rem',
                  border: '2px solid #e91e63',
                  textAlign: 'center'
                }}>
                  {day}
                </td>
                {[0, 1, 2, 3, 4].map((pi) => {
                  const cell = grid[di][pi];
                  return (
                    <td
                      key={pi}
                      onClick={() => toggleCell(di, pi)}
                      style={{
                        border: '2px solid #e91e63',
                        padding: '10px 6px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: cell.filled ? getSubjectColor(cell.subject) + '15' : '#fff',
                        transition: 'all 0.2s ease',
                        minHeight: '50px'
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
                        <span style={{ color: '#f48fb1', fontSize: '1.3rem' }}>+</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#fce4ec', borderRadius: '12px', border: '2px solid #f48fb1' }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#c2185b', marginBottom: '0.6rem' }}>📦 المواد الدراسية</div>

        <div style={{ marginBottom: '0.6rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c2185b', marginBottom: '0.3rem' }}>المواد الأساسية (لجميع المستويات - الأولى إلى السادسة):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {SUBJECTS.slice(0, 7).map((s) => (
              <span key={s.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                background: s.color + '18', color: s.color, border: `1px solid ${s.color}35`
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c2185b', marginBottom: '0.3rem' }}>المواد التدريجية (حسب المستوى):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {SUBJECTS.slice(7).map((s) => (
              <span key={s.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                background: s.color + '18', color: s.color, border: `1px solid ${s.color}35`
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                {s.name}
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({s.desc})</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="muted note" style={{ marginTop: '0.8rem', fontSize: '0.82rem' }}>
        💡 انقر على خلية فارغة لإضافة مادة. اختر المادة من القائمة. اضغط على طباعة للحصول على نسخة PDF.
      </p>
    </div>
  );
}
