import { useState, useRef } from 'react';

const EMPTY_WORKSHEET = {
  schoolName: '',
  teacherName: '',
  subject: 'الرياضيات',
  className: '',
  date: '',
  period: 'الفترة الأولى',
  lessonTitle: '',
  objectives: [''],
  activities: [
    { title: 'نشاط الاستكشاف', duration: '15 دقيقة', description: '' },
    { title: 'نشاط التعلّم', duration: '20 دقيقة', description: '' },
    { title: 'نشاط التثبيت', duration: '10 دقائق', description: '' }
  ],
  evaluation: [''],
  notes: '',
  materials: ''
};

const SUBJECTS = ['الرياضيات', 'القراءة', 'الإنتاج الكتابي', 'الخط والإملاء', 'اللغة العربية', 'اللغة الفرنسية', 'التربية الإسلامية', 'التربية المدنية', 'الإيقاظ العلمي', 'التنشيط'];

const PERIODS = ['الفترة الأولى', 'الفترة الثانية', 'الفترة الثالثة', 'الفترة الرابعة', 'الفترة الخامسة', 'الفترة السادسة'];

function MinistryLogo() {
  return (
    <svg width="70" height="80" viewBox="0 0 70 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="66" height="76" rx="4" fill="#fff" stroke="#1a237e" strokeWidth="3"/>
      <path d="M35 8 L55 20 L55 35 L35 45 L15 35 L15 20 Z" fill="#1a237e" opacity="0.1"/>
      <path d="M35 12 L50 22 L50 33 L35 41 L20 33 L20 22 Z" fill="none" stroke="#c62828" strokeWidth="1.5"/>
      <circle cx="35" cy="28" r="6" fill="none" stroke="#1a237e" strokeWidth="1.5"/>
      <path d="M32 26 L35 22 L38 26 L35 30 Z" fill="#c62828"/>
      <text x="35" y="55" textAnchor="middle" fill="#1a237e" fontSize="7" fontWeight="bold" fontFamily="Arial">جمهورية</text>
      <text x="35" y="63" textAnchor="middle" fill="#1a237e" fontSize="7" fontWeight="bold" fontFamily="Arial">تونس</text>
      <text x="35" y="72" textAnchor="middle" fill="#666" fontSize="5.5" fontFamily="Arial">الوزارة</text>
    </svg>
  );
}

function WorksheetHeader({ data, onChange }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)', borderRadius: '12px', padding: '1.2rem', marginBottom: '1rem', border: '2px solid #c5cae9' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <MinistryLogo />
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1a237e' }}>جمهورية تونس</div>
            <div style={{ fontSize: '0.78rem', color: '#333' }}>وزارة التربية</div>
            <div style={{ fontSize: '0.72rem', color: '#666' }}>المندوبية الجهوية للتربية</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input placeholder="Ø§Ù„Ù…Ø¯Ø±Ø³Ø©..." value={data.schoolName} onChange={(e) => onChange({ schoolName: e.target.value })}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }} />
            <input placeholder="Ø§Ù„Ù…Ø¹Ù„Ù…(Ø©)..." value={data.teacherName} onChange={(e) => onChange({ teacherName: e.target.value })}
              style={{ padding: '0.4rem 0.6rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }} />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem' }}>
        <select value={data.subject} onChange={(e) => onChange({ subject: e.target.value })}
          style={{ padding: '0.4rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }}>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Ø§Ù„Ù‚Ø³Ù…..." value={data.className} onChange={(e) => onChange({ className: e.target.value })}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }} />
        <input type="date" value={data.date} onChange={(e) => onChange({ date: e.target.value })}
          style={{ padding: '0.4rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }} />
        <select value={data.period} onChange={(e) => onChange({ period: e.target.value })}
          style={{ padding: '0.4rem', border: '1px solid #c5cae9', borderRadius: '6px', fontSize: '0.82rem', background: '#fff' }}>
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder, color }) {
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, val) => onChange(items.map((item, idx) => idx === i ? val : item));

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem', alignItems: 'center' }}>
          <span style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: color || '#1a237e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
          <input value={item} onChange={(e) => update(i, e.target.value)} placeholder={placeholder}
            style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '0.82rem' }} />
          {items.length > 1 && (
            <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}>âœ•</button>
          )}
        </div>
      ))}
      <button onClick={add} style={{ background: 'none', border: `1px dashed ${color || '#1a237e'}`, color: color || '#1a237e', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, marginTop: '0.3rem' }}>+ إضافة</button>
    </div>
  );
}

function ActivityEditor({ activities, onChange }) {
  const colors = ['#3b82f6', '#10b981', '#E8A317', '#ef4444', '#8b5cf6'];
  const update = (i, patch) => onChange(activities.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const add = () => onChange([...activities, { title: '', duration: '', description: '' }]);
  const remove = (i) => onChange(activities.filter((_, idx) => idx !== i));

  return (
    <div>
      {activities.map((act, i) => (
        <div key={i} style={{ background: (colors[i] || '#666') + '08', border: `1px solid ${colors[i] || '#666'}25`, borderRadius: '8px', padding: '0.7rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <input value={act.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ù†Ø´Ø§Ø·"
              style={{ flex: 1, padding: '0.35rem 0.5rem', border: `1px solid ${colors[i] || '#666'}40`, borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, color: colors[i] || '#666' }} />
            <input value={act.duration} onChange={(e) => update(i, { duration: e.target.value })} placeholder="Ø§Ù„Ù…Ø¯Ø©"
              style={{ width: '100px', padding: '0.35rem 0.5rem', border: `1px solid ${colors[i] || '#666'}40`, borderRadius: '6px', fontSize: '0.78rem', textAlign: 'center' }} />
            {activities.length > 1 && (
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}>âœ•</button>
            )}
          </div>
          <textarea value={act.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="ÙˆØµÙ Ø§Ù„Ù†Ø´Ø§Ø· ÙˆØ§Ù„ØªØ¹Ù„ÙŠÙ…Ø§Øª..."
            rows={2} style={{ width: '100%', padding: '0.4rem 0.5rem', border: `1px solid ${colors[i] || '#666'}30`, borderRadius: '6px', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      ))}
      <button onClick={add} style={{ background: 'none', border: '1px dashed #1a237e', color: '#1a237e', padding: '0.3rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>+ إضافة نشاط</button>
    </div>
  );
}

function PrintWorksheet({ data }) {
  const objectives = data.objectives.filter(Boolean);
  const evalItems = data.evaluation.filter(Boolean);

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Tajawal', 'Cairo', Arial, sans-serif" }}>
      <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '3px double #1a237e', paddingBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: '#1a237e' }}>جمهورية تونس</div>
        <div style={{ fontSize: '12px', color: '#333' }}>وزارة التربية</div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>المعلقة الرسمية للمعلم(ة)</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '12px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6', width: '25%' }}>المدرسة</td>
            <td style={{ border: '1px solid #333', padding: '6px', width: '25%' }}>{data.schoolName || '...'}</td>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6', width: '25%' }}>المعلم(ة)</td>
            <td style={{ border: '1px solid #333', padding: '6px', width: '25%' }}>{data.teacherName || '...'}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6' }}>المادة</td>
            <td style={{ border: '1px solid #333', padding: '6px' }}>{data.subject}</td>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6' }}>القسم</td>
            <td style={{ border: '1px solid #333', padding: '6px' }}>{data.className || '...'}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6' }}>التاريخ</td>
            <td style={{ border: '1px solid #333', padding: '6px' }}>{data.date || '...'}</td>
            <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6' }}>الفترة</td>
            <td style={{ border: '1px solid #333', padding: '6px' }}>{data.period}</td>
          </tr>
          {data.lessonTitle && (
            <tr>
              <td style={{ border: '1px solid #333', padding: '6px', fontWeight: 700, background: '#e8eaf6' }}>عنوان الدرس</td>
              <td colSpan={3} style={{ border: '1px solid #333', padding: '6px' }}>{data.lessonTitle}</td>
            </tr>
          )}
        </tbody>
      </table>
      {objectives.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a237e', marginBottom: '5px', borderBottom: '2px solid #c5cae9', paddingBottom: '3px' }}>🎯 الأهداف التعليمية</div>
          {objectives.map((obj, i) => (
            <div key={i} style={{ fontSize: '12px', marginBottom: '3px', paddingRight: '15px' }}>• {obj}</div>
          ))}
        </div>
      )}
      {data.activities.filter(a => a.title || a.description).length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a237e', marginBottom: '5px', borderBottom: '2px solid #c5cae9', paddingBottom: '3px' }}>📋 الأنشطة التعليمية</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #333', padding: '5px', background: '#1a237e', color: '#fff', width: '30%' }}>النشاط</th>
                <th style={{ border: '1px solid #333', padding: '5px', background: '#1a237e', color: '#fff', width: '15%' }}>المدة</th>
                <th style={{ border: '1px solid #333', padding: '5px', background: '#1a237e', color: '#fff' }}>الوصف والتعليمات</th>
              </tr>
            </thead>
            <tbody>
              {data.activities.filter(a => a.title || a.description).map((act, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #333', padding: '5px', fontWeight: 700 }}>{act.title}</td>
                  <td style={{ border: '1px solid #333', padding: '5px', textAlign: 'center' }}>{act.duration}</td>
                  <td style={{ border: '1px solid #333', padding: '5px' }}>{act.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {evalItems.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a237e', marginBottom: '5px', borderBottom: '2px solid #c5cae9', paddingBottom: '3px' }}>✅ معايير التقويم</div>
          {evalItems.map((ev, i) => (
            <div key={i} style={{ fontSize: '12px', marginBottom: '3px', paddingRight: '15px' }}>• {ev}</div>
          ))}
        </div>
      )}
      {data.materials && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a237e', marginBottom: '5px', borderBottom: '2px solid #c5cae9', paddingBottom: '3px' }}>📦 المواد المستعملة</div>
          <div style={{ fontSize: '12px' }}>{data.materials}</div>
        </div>
      )}
      {data.notes && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1a237e', marginBottom: '5px', borderBottom: '2px solid #c5cae9', paddingBottom: '3px' }}>📝 ملاحظات</div>
          <div style={{ fontSize: '12px' }}>{data.notes}</div>
        </div>
      )}
    </div>
  );
}

export default function TeacherWorksheets() {
  const [data, setData] = useState({ ...EMPTY_WORKSHEET });
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef(null);

  const onChange = (patch) => setData((d) => ({ ...d, ...patch }));

  const printWorksheet = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html dir="rtl"><head><title>Ù…Ø¹Ù„Ù‚Ø© Ø±Ø³Ù…ÙŠØ© - ${data.subject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 25px; margin: 0; }
        @media print { body { padding: 15mm; } }
      </style></head><body>
      ${previewRef.current?.innerHTML || ''}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>📝 المعلقات الرسمية</h3>
        <div className="btn-group">
          <button className="btn" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? '✏️ تعديل' : '👁️ معاينة'}
          </button>
          <button className="btn btn-primary" onClick={printWorksheet}>🖨️ طباعة PDF</button>
        </div>
      </div>

      {showPreview ? (
        <div ref={previewRef} style={{ background: '#fff', padding: '1.5rem', borderRadius: '10px', border: '2px solid #e2e8f0' }}>
          <PrintWorksheet data={data} />
        </div>
      ) : (
        <div>
          <WorksheetHeader data={data} onChange={onChange} />

          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', marginBottom: '1rem' }}>
            <input value={data.lessonTitle} onChange={(e) => onChange({ lessonTitle: e.target.value })}
              placeholder="Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¯Ø±Ø³ / Ø§Ù„Ø¯Ø±Ø³ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©..."
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '2px solid #c5cae9', borderRadius: '8px', fontSize: '1rem', fontWeight: 700, textAlign: 'center', color: '#1a237e' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', padding: '1rem' }}>
              <div style={{ fontWeight: 800, color: '#166534', marginBottom: '0.6rem', fontSize: '0.9rem' }}>🎯 الأهداف التعليمية</div>
              <EditableList items={data.objectives} onChange={(v) => onChange({ objectives: v })} placeholder="Ø£Ø¶Ù Ù‡Ø¯ÙØ§Ù‹ ØªØ¹Ù„ÙŠÙ…ÙŠØ§Ù‹..." color="#166534" />
            </div>

            <div style={{ background: '#fef3c7', borderRadius: '10px', border: '1px solid #fde68a', padding: '1rem' }}>
              <div style={{ fontWeight: 800, color: '#92400e', marginBottom: '0.6rem', fontSize: '0.9rem' }}>✅ معايير التقويم</div>
              <EditableList items={data.evaluation} onChange={(v) => onChange({ evaluation: v })} placeholder="Ø£Ø¶Ù Ù…Ø¹ÙŠØ§Ø± ØªÙ‚ÙˆÙŠÙ…..." color="#92400e" />
            </div>
          </div>

          <div style={{ background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', padding: '1rem', marginTop: '1rem' }}>
            <div style={{ fontWeight: 800, color: '#1e40af', marginBottom: '0.6rem', fontSize: '0.9rem' }}>📋 الأنشطة التعليمية</div>
            <ActivityEditor activities={data.activities} onChange={(v) => onChange({ activities: v })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>📦 المواد المستعملة</label>
              <textarea value={data.materials} onChange={(e) => onChange({ materials: e.target.value })}
                placeholder="Ø§Ù„Ø³Ø¨ÙˆØ±Ø©ØŒ Ø§Ù„Ø·Ø¨Ø§Ø´ÙŠØ±ØŒ Ø§Ù„ÙƒØªØ¨..." rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#555', display: 'block', marginBottom: '0.3rem' }}>📝 ملاحظات</label>
              <textarea value={data.notes} onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ©..." rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
