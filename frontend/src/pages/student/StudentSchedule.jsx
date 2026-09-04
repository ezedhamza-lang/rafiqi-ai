import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';

function formatHours(h) {
  if (h === 0) return '—';
  if (h === 0.33) return '20 دقيقة';
  if (h === 0.5) return '30 دقيقة';
  if (h === 0.67) return '40 دقيقة';
  if (h === 1.5) return '1 ساعة و 30 دق';
  if (h === 1.67) return '1 ساعة و 40 دق';
  return `${h} س`;
}

export default function StudentSchedule() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/teacher/schedules/student/my')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="loading-wrap"><span className="spinner" /></div>;

  const distribution = data.distribution?.subjects || [];
  const totalHours = distribution.reduce((sum, s) => sum + (s.hours || 0), 0);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{data.class ? `جدول المواد السنوي - ${data.class.name}` : 'جدول المواد السنوي'}</h3>
      </div>
      {!data.class ? (
        <div className="empty">لم يتم تعيينك لأي قسم بعد</div>
      ) : distribution.length === 0 ? (
        <div className="empty">لم يُحدد الأستاذ جدول المواد بعد</div>
      ) : (
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
                  <th style={{ background: '#1a237e', color: '#fff', padding: '12px 8px', fontSize: '0.85rem', fontWeight: 800, border: '2px solid #1a237e', width: '130px' }}>الساعات الأسبوعية</th>
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
    </div>
  );
}
