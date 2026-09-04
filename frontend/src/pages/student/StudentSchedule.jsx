import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';

const DAYS = ['الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

function formatHours(h) {
  if (h === 0.5) return '30 دقيقة';
  if (h === 0.67) return '40 دقيقة';
  return `${h} س`;
}

export default function StudentSchedule() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('distribution');

  useEffect(() => {
    api
      .get('/teacher/schedules/student/my')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;

  const distribution = data.distribution?.subjects || [];
  const timetable = data.distribution?.timetable;
  const totalHours = distribution.reduce((sum, s) => sum + (s.hours || 0), 0);

  const getSubjectColor = (name) => {
    const found = distribution.find((s) => s.name === name);
    return found?.color || '#64748b';
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{data.class ? `جدول المواد - ${data.class.name}` : 'جدول المواد'}</h3>
      </div>
      {!data.class ? (
        <div className="empty">لم يتم تعيينك لأي قسم بعد</div>
      ) : distribution.length === 0 ? (
        <div className="empty">لم يُحدد الأستاذ جدول المواد بعد</div>
      ) : (
        <>
          {timetable && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setActiveTab('distribution')} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', background: activeTab === 'distribution' ? '#1a237e' : '#e0e0e0', color: activeTab === 'distribution' ? '#fff' : '#333', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                📊 توزيع المواد
              </button>
              <button onClick={() => setActiveTab('timetable')} style={{ flex: 1, padding: '0.7rem', borderRadius: '10px', border: 'none', background: activeTab === 'timetable' ? '#1a237e' : '#e0e0e0', color: activeTab === 'timetable' ? '#fff' : '#333', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                🗓️ الجدول الأسبوعي
              </button>
            </div>
          )}

          {activeTab === 'distribution' && (
            <>
              <div style={{ padding: '0.8rem', background: '#e8eaf6', borderRadius: '12px', border: '2px solid #c5cae9', textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#1a237e' }}>المجموع: {formatHours(totalHours)} أسبوعياً</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '3px solid #1a237e', borderRadius: '12px', overflow: 'hidden' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#1a237e', color: '#fff', padding: '12px 6px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '40px' }}>#</th>
                      <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', textAlign: 'right' }}>المادة</th>
                      <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '110px' }}>الساعات الأسبوعية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribution.map((sub, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9ff' }}>
                        <td style={{ padding: '10px 8px', border: '2px solid #c5cae9', textAlign: 'center', fontWeight: 800, color: '#1a237e' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', border: '2px solid #c5cae9', textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: sub.color || '#94a3b8', flexShrink: 0 }} />
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#333' }}>{sub.name}</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', border: '2px solid #c5cae9', textAlign: 'center', fontWeight: 900, fontSize: '0.9rem', color: sub.color || '#1a237e' }}>
                          {formatHours(sub.hours)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#e8eaf6' }}>
                      <td colSpan={2} style={{ padding: '12px', border: '2px solid #1a237e', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: '#1a237e' }}>المجموع</td>
                      <td style={{ padding: '12px', border: '2px solid #1a237e', textAlign: 'center', fontWeight: 900, fontSize: '1.1rem', color: '#1a237e' }}>{formatHours(totalHours)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'timetable' && timetable && (
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
                  {Array.from({ length: timetable.periods || 6 }, (_, periodIdx) => (
                    <tr key={periodIdx} style={{ background: periodIdx % 2 === 0 ? '#fff' : '#f8f9ff' }}>
                      <td style={{ padding: '6px', border: '2px solid #c5cae9', textAlign: 'center', fontWeight: 800, color: '#1a237e', fontSize: '0.8rem', background: '#e8eaf6' }}>
                        <div style={{ fontWeight: 800 }}>حصة {periodIdx + 1}</div>
                      </td>
                      {DAYS.map((_, dayIdx) => {
                        const cell = timetable.grid?.[dayIdx]?.[periodIdx] || { subject: '', duration: 55 };
                        const cellColor = getSubjectColor(cell.subject);
                        return (
                          <td key={dayIdx} style={{ padding: '4px', border: '2px solid #c5cae9', textAlign: 'center' }}>
                            <div style={{ minHeight: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '4px', borderRadius: '6px', border: `2px solid ${cell.subject ? cellColor + '40' : '#e0e0e0'}`, background: cell.subject ? cellColor + '10' : '#fafafa' }}>
                              {cell.subject ? (
                                <>
                                  <span style={{ fontWeight: 800, fontSize: '0.78rem', color: cellColor, lineHeight: 1.2 }}>{cell.subject}</span>
                                  <span style={{ fontSize: '0.68rem', color: '#666', fontWeight: 700 }}>{cell.duration} دقيقة</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#ddd', fontWeight: 700 }}>—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
