import React, { useState, useCallback, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const GRADE_DISTRIBUTION = {
  1: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'حوار منظم', color: '#06b6d4', sessions: [{ day: 0, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 30 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 30 }, { day: 0, dur: 30 }, { day: 1, dur: 30 }, { day: 1, dur: 30 }, { day: 2, dur: 30 }, { day: 2, dur: 30 }, { day: 3, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'كتابة', color: '#f97316', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 0, dur: 30 }, { day: 3, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 30 }, { day: 0, dur: 30 }, { day: 1, dur: 30 }, { day: 1, dur: 30 }, { day: 2, dur: 30 }, { day: 2, dur: 30 }, { day: 3, dur: 30 }, { day: 3, dur: 30 }, { day: 4, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'إيقاظ علمي', color: '#14b8a6', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 1, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تكنولوجية', color: '#6366f1', sessions: [{ day: 3, dur: 60 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 5, dur: 60 }] }
  ],
  2: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }] },
    { name: 'حوار منظم', color: '#06b6d4', sessions: [{ day: 4, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 30 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'قواعد اللغة', color: '#f97316', sessions: [{ day: 0, dur: 30 }, { day: 1, dur: 30 }, { day: 2, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 1, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 60 }, { day: 1, dur: 60 }, { day: 2, dur: 60 }, { day: 3, dur: 60 }, { day: 4, dur: 60 }] },
    { name: 'إيقاظ علمي', color: '#14b8a6', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 0, dur: 30 }, { day: 4, dur: 30 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تكنولوجية', color: '#6366f1', sessions: [{ day: 1, dur: 60 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 4, dur: 60 }] }
  ],
  3: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 20 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 45 }, { day: 2, dur: 45 }] },
    { name: 'قواعد اللغة', color: '#f97316', sessions: [{ day: 0, dur: 40 }, { day: 2, dur: 40 }, { day: 4, dur: 40 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 40 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 60 }, { day: 1, dur: 60 }, { day: 2, dur: 60 }, { day: 3, dur: 60 }, { day: 4, dur: 60 }] },
    { name: 'إيقاظ علمي', color: '#14b8a6', sessions: [{ day: 1, dur: 60 }] },
    { name: 'تاريخ', color: '#78716c', sessions: [{ day: 1, dur: 40 }] },
    { name: 'جغرافيا', color: '#a16207', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية مدنية', color: '#64748b', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تكنولوجية', color: '#6366f1', sessions: [{ day: 3, dur: 60 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 5, dur: 60 }] }
  ],
  4: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 20 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 45 }, { day: 2, dur: 45 }] },
    { name: 'قواعد اللغة', color: '#f97316', sessions: [{ day: 0, dur: 40 }, { day: 2, dur: 40 }, { day: 4, dur: 40 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 40 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 60 }, { day: 1, dur: 60 }, { day: 2, dur: 60 }, { day: 3, dur: 60 }, { day: 4, dur: 60 }] },
    { name: 'علوم', color: '#14b8a6', sessions: [{ day: 1, dur: 60 }] },
    { name: 'تاريخ', color: '#78716c', sessions: [{ day: 1, dur: 40 }] },
    { name: 'جغرافيا', color: '#a16207', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية مدنية', color: '#64748b', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'لغة فرنسية', color: '#0ea5e9', sessions: [{ day: 4, dur: 60 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تكنولوجيا المعلومات', color: '#8b5cf6', sessions: [{ day: 3, dur: 30 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 5, dur: 60 }] }
  ],
  5: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 20 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 45 }, { day: 2, dur: 45 }] },
    { name: 'قواعد اللغة', color: '#f97316', sessions: [{ day: 0, dur: 40 }, { day: 2, dur: 40 }, { day: 4, dur: 40 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 40 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 60 }, { day: 1, dur: 60 }, { day: 2, dur: 60 }, { day: 3, dur: 60 }, { day: 4, dur: 60 }] },
    { name: 'علوم', color: '#14b8a6', sessions: [{ day: 1, dur: 60 }] },
    { name: 'تاريخ', color: '#78716c', sessions: [{ day: 1, dur: 40 }] },
    { name: 'جغرافيا', color: '#a16207', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية مدنية', color: '#64748b', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'لغة فرنسية', color: '#0ea5e9', sessions: [{ day: 4, dur: 60 }] },
    { name: 'لغة إنجليزية', color: '#6366f1', sessions: [{ day: 3, dur: 60 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تكنولوجيا المعلومات', color: '#8b5cf6', sessions: [{ day: 3, dur: 30 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 5, dur: 60 }] }
  ],
  6: [
    { name: 'تواصل شفوي', color: '#ef4444', sessions: [{ day: 0, dur: 30 }] },
    { name: 'محفوظات', color: '#8b5cf6', sessions: [{ day: 2, dur: 20 }] },
    { name: 'قراءة', color: '#3b82f6', sessions: [{ day: 0, dur: 45 }, { day: 2, dur: 45 }] },
    { name: 'قواعد اللغة', color: '#f97316', sessions: [{ day: 0, dur: 40 }, { day: 2, dur: 40 }, { day: 4, dur: 40 }] },
    { name: 'إنتاج كتابي', color: '#ec4899', sessions: [{ day: 0, dur: 30 }, { day: 2, dur: 30 }, { day: 4, dur: 40 }] },
    { name: 'رياضيات', color: '#10b981', sessions: [{ day: 0, dur: 60 }, { day: 1, dur: 60 }, { day: 2, dur: 60 }, { day: 3, dur: 60 }, { day: 4, dur: 60 }] },
    { name: 'علوم', color: '#14b8a6', sessions: [{ day: 1, dur: 60 }] },
    { name: 'تاريخ', color: '#78716c', sessions: [{ day: 1, dur: 40 }] },
    { name: 'جغرافيا', color: '#a16207', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية مدنية', color: '#64748b', sessions: [{ day: 3, dur: 40 }] },
    { name: 'تربية إسلامية', color: '#f59e0b', sessions: [{ day: 1, dur: 30 }, { day: 3, dur: 30 }] },
    { name: 'لغة فرنسية', color: '#0ea5e9', sessions: [{ day: 4, dur: 60 }] },
    { name: 'لغة إنجليزية', color: '#6366f1', sessions: [{ day: 3, dur: 60 }] },
    { name: 'تربية موسيقية', color: '#a855f7', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تربية تشكيلية', color: '#e11d48', sessions: [{ day: 5, dur: 30 }] },
    { name: 'تكنولوجيا المعلومات', color: '#8b5cf6', sessions: [{ day: 3, dur: 30 }] },
    { name: 'تربية بدنية', color: '#22c55e', sessions: [{ day: 5, dur: 60 }] }
  ]
};

const SESSIONS = [
  { name: 'الصباحية الأولى', time: '08:00 - 09:55', dur: 115 },
  { name: 'الصباحية الثانية', time: '10:05 - 12:00', dur: 115 },
  { name: 'الصباحية الثالثة', time: '12:05 - 13:00', dur: 55 }
];

const DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function buildGrid(grade) {
  const dist = GRADE_DISTRIBUTION[grade] || GRADE_DISTRIBUTION[1];
  const grid = Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => []));
  const sessionLimits = [115, 115, 55];
  const sessionUsed = [0, 0, 0];

  dist.forEach((sub) => {
    sub.sessions.forEach((s) => {
      let placed = false;
      for (let si = 0; si < 3 && !placed; si++) {
        if (sessionUsed[si] + s.dur <= sessionLimits[si]) {
          grid[si][s.day].push({ subject: sub.name, duration: s.dur, color: sub.color });
          sessionUsed[si] += s.dur;
          placed = true;
        }
      }
    });
  });

  return grid;
}

function getSubjectColor(name) {
  for (const grade of Object.values(GRADE_DISTRIBUTION)) {
    const found = grade.find((s) => s.name === name);
    if (found) return found.color;
  }
  return '#94a3b8';
}

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [classId, setClassId] = useState('');
  const [grade, setGrade] = useState(1);
  const [grid, setGrid] = useState(() => buildGrid(1));
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const scheduleRef = useRef(null);

  const changeGrade = (g) => {
    setGrade(g);
    setGrid(buildGrid(g));
    setSaved(null);
  };

  const save = async () => {
    setError('');
    try {
      const flat = [];
      grid.forEach((session, si) => {
        session.forEach((dayItems, di) => {
          dayItems.forEach((item) => {
            flat.push({ session: si, day: di, subject: item.subject, duration: item.duration, grade });
          });
        });
      });
      const res = await api.put(`/teacher/schedules/${classId}`, { grid: flat, grade });
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
      <html dir="rtl"><head><title>جدول توزيع المواد - السنة ${grade}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 15px; }
        h2 { text-align: center; color: #1a237e; font-size: 18px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 2px solid #1a237e; padding: 8px 6px; text-align: center; font-size: 12px; vertical-align: top; }
        th { background: #e8eaf6; color: #1a237e; font-weight: 800; }
        .break td { background: #e8f5e9; color: #2e7d32; font-weight: 700; }
        @media print { body { padding: 8mm; } }
      </style></head><body>
      <h2>جدول توزيع المواد - السنة ${grade}</h2>
      ${content.innerHTML}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  };

  const getSessionTotal = (si) => grid[si].reduce((t, d) => t + d.reduce((s, i) => s + i.duration, 0), 0);

  const gradeSubjects = GRADE_DISTRIBUTION[grade] || [];

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>📋 جدول توزيع المواد</h3>
        <div className="btn-group">
          <select value={grade} onChange={(e) => changeGrade(Number(e.target.value))}>
            {[1,2,3,4,5,6].map((g) => (
              <option key={g} value={g}>السنة {['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة'][g-1]}</option>
            ))}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
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
          width: '100%', borderCollapse: 'collapse', minWidth: '800px',
          border: '3px solid #1a237e', borderRadius: '12px', overflow: 'hidden'
        }}>
          <thead>
            <tr>
              <th style={{
                background: '#1a237e', color: '#fff', padding: '12px 8px',
                fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '100px'
              }}>الحصة / اليوم</th>
              {DAYS.map((day, i) => (
                <th key={i} style={{
                  background: '#1a237e', color: '#fff', padding: '12px 6px',
                  fontSize: '0.9rem', fontWeight: 800, border: '2px solid #1a237e', minWidth: '110px'
                }}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((session, si) => (
              <React.Fragment key={si}>
                <tr>
                  <td style={{
                    background: '#e8eaf6', color: '#1a237e', fontWeight: 800,
                    padding: '10px 6px', fontSize: '0.82rem', border: '2px solid #c5cae9', textAlign: 'center'
                  }}>
                    <div>{session.name}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{session.time}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>{getSessionTotal(si)} دقيقة</div>
                  </td>
                  {DAYS.map((_, di) => {
                    const items = grid[si][di];
                    return (
                      <td key={di} style={{
                        border: '2px solid #c5cae9', padding: '6px 4px', textAlign: 'center',
                        background: items.length > 0 ? '#fff' : '#fafafa', verticalAlign: 'top', minHeight: '80px'
                      }}>
                        {items.map((item, idx) => (
                          <div key={idx} style={{
                            margin: '2px 0', padding: '3px 4px', borderRadius: '6px',
                            background: item.color + '15', border: `1px solid ${item.color}30`
                          }}>
                            <span style={{ fontWeight: 800, fontSize: '0.78rem', color: item.color }}>{item.subject}</span>
                            <span style={{ fontSize: '0.68rem', color: '#1a237e', fontWeight: 800 }}> {item.duration}د</span>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
                {si < 2 && (
                  <tr key={`break-${si}`}>
                    <td colSpan={7} style={{
                      background: '#e8f5e9', color: '#2e7d32', fontWeight: 700,
                      fontSize: '0.8rem', padding: '4px', border: '2px solid #c5cae9', textAlign: 'center'
                    }}>
                      استراحة {si === 0 ? '10 دقائق' : '5 دقائق'}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#e8eaf6', borderRadius: '12px', border: '2px solid #c5cae9' }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1a237e', marginBottom: '0.5rem' }}>
          📦 المواد - السنة {['الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة'][grade-1]}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {gradeSubjects.map((s) => (
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
        💡 اختر السنة من القائمة لإظهار التوزيع الرسمي للمواد حسب القرار الوزاري.
      </p>
    </div>
  );
}
