import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const COLORS = ['#ef4444','#06b6d4','#8b5cf6','#3b82f6','#f97316','#ec4899','#10b981','#14b8a6','#78716c','#a16207','#f59e0b','#64748b','#0ea5e9','#6366f1','#a855f7','#e11d48','#22c55e','#d946ef','#0891b2','#7c3aed'];

// الدرجة الأولى = سنة 1 + 2 — الدرجة الثانية = سنة 3 + 4 — الدرجة الثالثة = سنة 5 + 6
// كل درجة لها توزيع مواد واحد (السنتان متماثلتان)

const DEGREES = [
  { name: 'الدرجة الأولى', years: [1, 2], yearLabels: ['السنة الأولى', 'السنة الثانية'], required: 9 },
  { name: 'الدرجة الثانية', years: [3, 4], yearLabels: ['السنة الثالثة', 'السنة الرابعة'], required: 6 },
  { name: 'الدرجة الثالثة', years: [5, 6], yearLabels: ['السنة الخامسة', 'السنة السادسة'], required: 6 }
];

// توزيع المواد لكل درجة
const DEGREE_SUBJECTS = {
  1: [
    { name: 'تواصل شفوي', color: '#ef4444', hours: 1.5, group: 'اللغة العربية' },
    { name: 'قراءة', color: '#dc2626', hours: 4, group: 'اللغة العربية' },
    { name: 'حفظات', color: '#991b1b', hours: 0.5, group: 'اللغة العربية' },
    { name: 'حوار منظّم', color: '#b91c1c', hours: 0.5, group: 'اللغة العربية' },
    { name: 'كتابة', color: '#7f1d1d', hours: 1, group: 'اللغة العربية' },
    { name: 'استيعاب قواعد اللغة', color: '#f87171', hours: 0, group: 'اللغة العربية' },
    { name: 'إنتاج كتابي', color: '#450a0a', hours: 1.5, group: 'اللغة العربية' },
    { name: 'التربية الإسلامية', color: '#f59e0b', hours: 1, group: 'التربية الإسلامية' },
    { name: 'الرياضيات', color: '#10b981', hours: 5, group: 'الرياضيات' },
    { name: 'إيقاظ علمي', color: '#14b8a6', hours: 1, group: 'العلوم والتكنولوجيا' },
    { name: 'التربية التكنولوجية', color: '#6366f1', hours: 1, group: 'التربية والرياضة' },
    { name: 'التربية الموسيقية', color: '#a855f7', hours: 1, group: 'التربية والرياضة' },
    { name: 'التربية التشكيلية', color: '#e11d48', hours: 1, group: 'التربية والرياضة' },
    { name: 'التربية البدنية', color: '#22c55e', hours: 1, group: 'التربية والرياضة' }
  ],
  2: [
    { name: 'تواصل شفوي', color: '#ef4444', hours: 0.5, group: 'اللغة العربية' },
    { name: 'قراءة', color: '#dc2626', hours: 1.5, group: 'اللغة العربية' },
    { name: 'حفظات', color: '#991b1b', hours: 0.5, group: 'اللغة العربية' },
    { name: 'حوار منظّم', color: '#b91c1c', hours: 0.5, group: 'اللغة العربية' },
    { name: 'كتابة', color: '#7f1d1d', hours: 0, group: 'اللغة العربية' },
    { name: 'استيعاب قواعد اللغة', color: '#f87171', hours: 2, group: 'اللغة العربية' },
    { name: 'إنتاج كتابي', color: '#450a0a', hours: 1, group: 'اللغة العربية' },
    { name: 'اللغة الفرنسية', color: '#0ea5e9', hours: 8, group: 'اللغات الأجنبية' },
    { name: 'التربية الإسلامية', color: '#f59e0b', hours: 1, group: 'التربية الإسلامية' },
    { name: 'التاريخ', color: '#78716c', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'الجغرافيا', color: '#a16207', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'التربية مدنية', color: '#64748b', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'الرياضيات', color: '#10b981', hours: 5, group: 'الرياضيات' },
    { name: 'إيقاظ علمي', color: '#14b8a6', hours: 1, group: 'العلوم والتكنولوجيا' },
    { name: 'التربية التكنولوجية', color: '#6366f1', hours: 1, group: 'التربية والرياضة' },
    { name: 'التربية الموسيقية', color: '#a855f7', hours: 0.5, group: 'التربية والرياضة' },
    { name: 'التربية التشكيلية', color: '#e11d48', hours: 0.5, group: 'التربية والرياضة' },
    { name: 'التربية البدنية', color: '#22c55e', hours: 1, group: 'التربية والرياضة' }
  ],
  3: [
    { name: 'تواصل شفوي', color: '#ef4444', hours: 0.5, group: 'اللغة العربية' },
    { name: 'قراءة', color: '#dc2626', hours: 1.5, group: 'اللغة العربية' },
    { name: 'حفظات', color: '#991b1b', hours: 0.33, group: 'اللغة العربية' },
    { name: 'حوار منظّم', color: '#b91c1c', hours: 0.5, group: 'اللغة العربية' },
    { name: 'كتابة', color: '#7f1d1d', hours: 0, group: 'اللغة العربية' },
    { name: 'استيعاب قواعد اللغة', color: '#f87171', hours: 2, group: 'اللغة العربية' },
    { name: 'إنتاج كتابي', color: '#450a0a', hours: 1.67, group: 'اللغة العربية' },
    { name: 'اللغة الفرنسية', color: '#0ea5e9', hours: 8, group: 'اللغات الأجنبية' },
    { name: 'اللغة الإنجليزية', color: '#6366f1', hours: 2, group: 'اللغات الأجنبية' },
    { name: 'التربية الإسلامية', color: '#f59e0b', hours: 1, group: 'التربية الإسلامية' },
    { name: 'التاريخ', color: '#78716c', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'الجغرافيا', color: '#a16207', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'التربية مدنية', color: '#64748b', hours: 0.67, group: 'التربية الاجتماعية' },
    { name: 'الرياضيات', color: '#10b981', hours: 5, group: 'الرياضيات' },
    { name: 'إيقاظ علمي', color: '#14b8a6', hours: 1, group: 'العلوم والتكنولوجيا' },
    { name: 'التربية التكنولوجية', color: '#6366f1', hours: 1, group: 'التربية والرياضة' },
    { name: 'التربية الموسيقية', color: '#a855f7', hours: 0.5, group: 'التربية والرياضة' },
    { name: 'التربية التشكيلية', color: '#e11d48', hours: 0.5, group: 'التربية والرياضة' },
    { name: 'التربية البدنية', color: '#22c55e', hours: 1, group: 'التربية والرياضة' }
  ]
};

const DURATION_OPTIONS = [15, 20, 25, 30, 40, 55];

function formatHours(h) {
  if (h === 0) return '—';
  if (h === 0.33) return '20 دقيقة';
  if (h === 0.5) return '30 دقيقة';
  if (h === 0.67) return '40 دقيقة';
  if (h === 1.5) return '1 ساعة و 30 دق';
  if (h === 1.67) return '1 ساعة و 40 دق';
  return `${h} س`;
}

function makeDefaultGrid(numPeriods) {
  return DAYS.map(() => Array.from({ length: numPeriods }, () => ({ subject: '', duration: 55 })));
}

export default function Schedules({ classes }) {
  const { t } = useI18n();
  const [grade, setGrade] = useState(1);
  const [degreeIdx, setDegreeIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);
  const [classId, setClassId] = useState('');
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [subjects, setSubjects] = useState(() => JSON.parse(JSON.stringify(DEGREE_SUBJECTS[1])));
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const [numPeriods, setNumPeriods] = useState(6);
  const [timetable, setTimetable] = useState(() => makeDefaultGrid(6));
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [activeTab, setActiveTab] = useState('distribution');

  const currentDegree = DEGREES[degreeIdx];

  useEffect(() => {
    if (!classId) return;
    api.get('/teacher/schedules').then((data) => {
      const match = data.find((s) => s.classId === Number(classId));
      if (match?.class) {
        const foundGrade = match.grade || 1;
        setGrade(foundGrade);
        const degIdx = DEGREES.findIndex((d) => d.years.includes(foundGrade));
        if (degIdx >= 0) {
          setDegreeIdx(degIdx);
          setYearIdx(DEGREES[degIdx].years.indexOf(foundGrade));
          setSubjects(match.subjects || JSON.parse(JSON.stringify(DEGREE_SUBJECTS[degIdx + 1])));
        }
      }
      if (match?.timetable) {
        setTimetable(match.timetable.grid || makeDefaultGrid(match.timetable.periods || 6));
        setNumPeriods(match.timetable.periods || 6);
      }
    }).catch(() => {});
  }, [classId]);

  const changeDegree = (idx) => {
    setDegreeIdx(idx);
    setYearIdx(0);
    const g = DEGREES[idx].years[0];
    setGrade(g);
    setSubjects(JSON.parse(JSON.stringify(DEGREE_SUBJECTS[idx + 1])));
    setSaved(null);
    setEditingCell(null);
  };

  const changeYear = (idx) => {
    setYearIdx(idx);
    const g = currentDegree.years[idx];
    setGrade(g);
    setSubjects(JSON.parse(JSON.stringify(DEGREE_SUBJECTS[degreeIdx + 1])));
    setSaved(null);
    setEditingCell(null);
  };

  const totalHours = subjects.reduce((sum, s) => sum + s.hours, 0);
  const required = currentDegree.required;
  const isValid = Math.abs(totalHours - required) < 0.1;

  const startEdit = (idx, field) => {
    const val = field === 'name' ? subjects[idx].name : subjects[idx].hours;
    setEditValue(val);
    setEditingCell({ idx, field });
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { idx, field } = editingCell;
    setSubjects((prev) => {
      const next = [...prev];
      if (field === 'name') {
        next[idx] = { ...next[idx], name: editValue };
      } else if (field === 'hours') {
        next[idx] = { ...next[idx], hours: Number(editValue) || 0 };
      } else if (field === 'color') {
        next[idx] = { ...next[idx], color: editValue };
      }
      return next;
    });
    setEditingCell(null);
  };

  const addSubject = () => {
    const color = COLORS[subjects.length % COLORS.length];
    setSubjects((prev) => [...prev, { name: 'مادة جديدة', color, hours: 1, group: 'أخرى' }]);
    setTimeout(() => startEdit(subjects.length, 'name'), 100);
  };

  const removeSubject = (idx) => {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSubject = (idx, dir) => {
    setSubjects((prev) => {
      const next = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return prev;
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const changeNumPeriods = (n) => {
    setNumPeriods(n);
    setTimetable((prev) => {
      const newGrid = DAYS.map((_, dayIdx) => {
        const oldRow = prev[dayIdx] || [];
        return Array.from({ length: n }, (_, i) => oldRow[i] || { subject: '', duration: 55 });
      });
      return newGrid;
    });
  };

  const setTimetableCell = (dayIdx, periodIdx, field, value) => {
    setTimetable((prev) => {
      const newGrid = prev.map((row) => [...row]);
      newGrid[dayIdx][periodIdx] = { ...newGrid[dayIdx][periodIdx], [field]: value };
      return newGrid;
    });
  };

  const save = async () => {
    setError('');
    if (!isValid) { setError(`يجب أن يكون المجموع ${required} ساعة حسب القرار الوزاري`); return; }
    try {
      const timetableData = { periods: numPeriods, grid: timetable };
      const res = await api.put(`/teacher/schedules/${classId}`, { grade, subjects, timetable: timetableData });
      setSaved(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const getSubjectColor = (name) => {
    const found = subjects.find((s) => s.name === name);
    return found?.color || '#64748b';
  };

  const timetableSubjects = (() => {
    const seen = new Set();
    return subjects.filter((s) => {
      if (seen.has(s.group)) return false;
      seen.add(s.group);
      return true;
    }).map((s) => ({ name: s.group, color: s.color }));
  })();

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>📋 توزيع المواد حسب الدرجة</h3>
        <div className="btn-group" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          <select value={degreeIdx} onChange={(e) => changeDegree(Number(e.target.value))}>
            {DEGREES.map((d, i) => (
              <option key={i} value={i}>{d.name}</option>
            ))}
          </select>
          <select value={yearIdx} onChange={(e) => changeYear(Number(e.target.value))}>
            {currentDegree.yearLabels.map((label, i) => (
              <option key={i} value={i}>{label}</option>
            ))}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('teacherSpace.schedules.selectClass')}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={save} disabled={!classId}>{t('teacherSpace.schedules.saveSchedule')}</button>
        </div>
      </div>

      {error && <div style={{ padding: '0.8rem', background: '#ffebee', border: '2px solid #ef5350', borderRadius: '10px', color: '#c62828', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center', marginBottom: '0.8rem' }}>⚠️ {error}</div>}
      {saved && <div className="form-success">{t('teacherSpace.schedules.savedMsg', { n: saved.count })}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={() => setActiveTab('distribution')} style={{ flex: 1, padding: '0.7rem', borderRadius: activeTab === 'distribution' ? '10px' : '10px', border: 'none', background: activeTab === 'distribution' ? '#1a237e' : '#e0e0e0', color: activeTab === 'distribution' ? '#fff' : '#333', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
          📊 توزيع المواد
        </button>
        <button onClick={() => setActiveTab('timetable')} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', background: activeTab === 'timetable' ? '#1a237e' : '#e0e0e0', color: activeTab === 'timetable' ? '#fff' : '#333', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
          🗓️ الجدول الأسبوعي
        </button>
      </div>

      {activeTab === 'distribution' && (
        <>
          <div style={{ padding: '1rem', borderRadius: '12px', border: `3px solid ${isValid ? '#4caf50' : '#ef5350'}`, background: isValid ? '#e8f5e9' : '#ffebee', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: isValid ? '#2e7d32' : '#c62828', fontWeight: 700, marginBottom: '0.3rem' }}>
              {isValid ? '✅ عدد الساعات صحيح' : '⚠️ عدد الساعات غير مطابق للقرار الوزاري'}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: isValid ? '#1b5e20' : '#b71c1c' }}>
              {totalHours} / {required} ساعة
            </div>
            {!isValid && (
              <div style={{ fontSize: '0.82rem', color: '#c62828', marginTop: '0.3rem', fontWeight: 700 }}>
                اصلح الجدول! يجب أن يكون المجموع {required} ساعة
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #1a237e', borderRadius: '12px', overflow: 'hidden' }}>
              <thead>
                <tr>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 6px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '40px' }}>#</th>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '40px' }}>اللون</th>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', textAlign: 'right' }}>المادة</th>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '110px' }}>الساعات</th>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '80px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9ff' }}>
                    <td style={{ padding: '8px 6px', border: '2px solid #c5cae9', textAlign: 'center', fontWeight: 800, color: '#1a237e', fontSize: '0.85rem' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 6px', border: '2px solid #c5cae9', textAlign: 'center' }}>
                      {editingCell?.idx === idx && editingCell?.field === 'color' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <input type="color" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            style={{ width: '30px', height: '28px', border: 'none', cursor: 'pointer', padding: 0 }} />
                          <button onClick={saveEdit} style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.7rem' }}>✓</button>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(idx, 'color')} style={{ cursor: 'pointer', display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', background: sub.color, border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', border: '2px solid #c5cae9', textAlign: 'right' }}>
                      {editingCell?.idx === idx && editingCell?.field === 'name' ? (
                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={saveEdit}
                          autoFocus style={{ width: '100%', padding: '4px 8px', border: '2px solid #3b82f6', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 700 }} />
                      ) : (
                        <span onClick={() => startEdit(idx, 'name')} style={{ cursor: 'pointer', fontWeight: 800, fontSize: '0.92rem', color: '#333', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                          {sub.name}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', border: '2px solid #c5cae9', textAlign: 'center' }}>
                      {editingCell?.idx === idx && editingCell?.field === 'hours' ? (
                        <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={saveEdit} min={0} max={40} step={0.33}
                          autoFocus style={{ width: '70px', padding: '4px', border: '2px solid #3b82f6', borderRadius: '6px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }} />
                      ) : (
                        <span onClick={() => startEdit(idx, 'hours')} style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: '8px', background: sub.color + '15', border: `1px solid ${sub.color}30`, fontWeight: 900, fontSize: '0.9rem', color: sub.color, display: 'inline-block' }}>
                          {formatHours(sub.hours)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 4px', border: '2px solid #c5cae9', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        <button onClick={() => moveSubject(idx, -1)} disabled={idx === 0} style={{ background: idx === 0 ? '#e0e0e0' : '#1a237e', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.7rem', opacity: idx === 0 ? 0.4 : 1 }}>▲</button>
                        <button onClick={() => moveSubject(idx, 1)} disabled={idx === subjects.length - 1} style={{ background: idx === subjects.length - 1 ? '#e0e0e0' : '#1a237e', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: idx === subjects.length - 1 ? 'default' : 'pointer', fontSize: '0.7rem', opacity: idx === subjects.length - 1 ? 0.4 : 1 }}>▼</button>
                        <button onClick={() => removeSubject(idx)} style={{ background: '#ef5350', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: isValid ? '#e8eaf6' : '#ffebee' }}>
                  <td colSpan={3} style={{ padding: '12px', border: '2px solid #1a237e', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: '#1a237e' }}>المجموع</td>
                  <td style={{ padding: '12px', border: '2px solid #1a237e', textAlign: 'center', fontWeight: 900, fontSize: '1.1rem', color: isValid ? '#1a237e' : '#ef5350' }}>
                    {totalHours} / {required}
                  </td>
                  <td style={{ border: '2px solid #1a237e' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button onClick={addSubject} style={{ marginTop: '0.8rem', width: '100%', padding: '0.6rem', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>
            + إضافة مادة جديدة
          </button>

          <p className="muted note" style={{ marginTop: '0.8rem', fontSize: '0.82rem' }}>
            💡 انقر على اسم المادة أو عدد الساعات أو اللون لتعديله. استخدم ▲▼ للترتيب و ✕ للحذف.
          </p>
        </>
      )}

      {activeTab === 'timetable' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1a237e' }}>عدد الحصص في اليوم:</label>
            {[4,5,6,7,8].map((n) => (
              <button key={n} onClick={() => changeNumPeriods(n)} style={{ padding: '6px 14px', borderRadius: '8px', border: numPeriods === n ? '2px solid #1a237e' : '2px solid #ccc', background: numPeriods === n ? '#1a237e' : '#fff', color: numPeriods === n ? '#fff' : '#333', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                {n} حصص
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #1a237e', borderRadius: '12px', overflow: 'hidden', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#1a237e', color: '#fff', padding: '10px 6px', fontSize: '0.8rem', fontWeight: 800, border: '2px solid #1a237e', width: '35px' }}>الحصة</th>
                  {DAYS.map((day) => (
                    <th key={day} style={{ background: '#1a237e', color: '#fff', padding: '10px 6px', fontSize: '0.8rem', fontWeight: 800, border: '2px solid #1a237e', textAlign: 'center' }}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: numPeriods }, (_, periodIdx) => (
                  <tr key={periodIdx} style={{ background: periodIdx % 2 === 0 ? '#fff' : '#f8f9ff' }}>
                    <td style={{ padding: '6px', border: '2px solid #c5cae9', textAlign: 'center', fontWeight: 800, color: '#1a237e', fontSize: '0.8rem', background: '#e8eaf6' }}>
                      <div style={{ fontWeight: 800 }}>حصة {periodIdx + 1}</div>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const cell = timetable[dayIdx]?.[periodIdx] || { subject: '', duration: 55 };
                      const isEdit = editingTimetable?.day === dayIdx && editingTimetable?.period === periodIdx;
                      const cellColor = getSubjectColor(cell.subject);

                      return (
                        <td key={dayIdx} style={{ padding: '4px', border: '2px solid #c5cae9', textAlign: 'center', position: 'relative' }}>
                          {isEdit ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                              <select
                                value={cell.subject}
                                onChange={(e) => setTimetableCell(dayIdx, periodIdx, 'subject', e.target.value)}
                                style={{ width: '100%', padding: '3px', border: '2px solid #3b82f6', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}
                              >
                                <option value="">—</option>
                                {timetableSubjects.map((s) => (
                                  <option key={s.name} value={s.name}>{s.name}</option>
                                ))}
                              </select>
                              <select
                                value={cell.duration}
                                onChange={(e) => setTimetableCell(dayIdx, periodIdx, 'duration', Number(e.target.value))}
                                style={{ width: '100%', padding: '3px', border: '2px solid #3b82f6', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}
                              >
                                {DURATION_OPTIONS.map((d) => (
                                  <option key={d} value={d}>{d} دقيقة</option>
                                ))}
                              </select>
                              <button onClick={() => setEditingTimetable(null)} style={{ background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>✓</button>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingTimetable({ day: dayIdx, period: periodIdx })}
                              style={{ cursor: 'pointer', minHeight: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '4px', borderRadius: '6px', border: `2px solid ${cell.subject ? cellColor + '40' : '#e0e0e0'}`, background: cell.subject ? cellColor + '10' : '#fafafa', transition: 'all 0.2s' }}
                            >
                              {cell.subject ? (
                                <>
                                  <span style={{ fontWeight: 800, fontSize: '0.78rem', color: cellColor, lineHeight: 1.2 }}>{cell.subject}</span>
                                  <span style={{ fontSize: '0.68rem', color: '#666', fontWeight: 700 }}>{cell.duration} دقيقة</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#bbb', fontWeight: 700 }}>+ أضف</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted note" style={{ marginTop: '0.8rem', fontSize: '0.82rem' }}>
            💡 انقر على أي خلية لتعديل المادة والمدة. اضغط ✓ للحفظ.
          </p>
        </>
      )}
    </div>
  );
}
