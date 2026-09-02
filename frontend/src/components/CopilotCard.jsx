import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const PRIORITY_STYLES = {
  HIGH: { bg: '#fdecec', border: '#d64545', label: 'أولوية عالية' },
  MEDIUM: { bg: '#fff7e8', border: '#e8911f', label: 'متوسطة' },
  LOW: { bg: '#f0f4fa', border: '#5b7bd5', label: 'منخفضة' }
};

// بطاقة مساعد المعلّم — بريف يومي قابل للتفسير (المرحلة 1)
export default function CopilotCard() {
  const [briefing, setBriefing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/teacher/copilot')
      .then(setBriefing)
      .catch((e) => setError(e.message || ''));
  }, []);

  if (error) return null;
  if (!briefing) {
    return (
      <div className="copilot-card" style={{ opacity: 0.6 }}>
        <div className="copilot-head">
          <span className="material-icons">auto_awesome</span>
          <strong>مساعدك الذكي</strong>
          <span className="muted">جارٍ تجهيز يومك...</span>
        </div>
      </div>
    );
  }

  const top = briefing.suggestions || [];

  return (
    <div className="copilot-card">
      <div className="copilot-head">
        <span className="material-icons">auto_awesome</span>
        <strong>مساعدك الذكي — ملخص يومك</strong>
        {briefing.corrections?.count > 0 && (
          <span className="copilot-chip warn">{briefing.corrections.count} تصحيح معلق</span>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'إخفاء التفاصيل' : 'التفاصيل'}
        </button>
      </div>

      {top.length === 0 ? (
        <p className="copilot-empty">لا اقتراحات الآن — كل شيء تحت السيطرة ✓</p>
      ) : (
        <ul className="copilot-list">
          {(open ? top : top.slice(0, 3)).map((s, i) => {
            const st = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.MEDIUM;
            return (
              <li key={i} className="copilot-item" style={{ background: st.bg, borderColor: st.border }}>
                <div className="copilot-item-head">
                  <span className={`copilot-priority p-${s.priority}`}>{st.label}</span>
                  <strong>{s.action}</strong>
                  {s.link && (
                    <Link to={s.link} className="copilot-go">
                      افتح
                    </Link>
                  )}
                </div>
                <p className="copilot-why">{s.why}</p>
                {s.evidence?.length > 0 && (
                  <ul className="copilot-evidence">
                    {s.evidence.slice(0, 4).map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                )}
                <span className="copilot-confidence">الثقة: {s.confidence}</span>
              </li>
            );
          })}
        </ul>
      )}

      {open && briefing.classes?.length > 0 && (
        <div className="copilot-classes">
          {briefing.classes.map((c) => (
            <div key={c.classId} className="copilot-class">
              <strong>{c.className}</strong>
              {c.nextLesson && (
                <p>
                  الدرس المقترح: «{c.nextLesson.title}» — إنجاز القسم {c.nextLesson.classCompletionPct}%
                </p>
              )}
              {c.absences?.count > 0 && <p>غيابات اليوم: {c.absences.count}</p>}
              {c.atRisk?.count > 0 && <p>تلاميذ يحتاجون متابعة: {c.atRisk.count}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="copilot-note">{briefing.explainability}</p>
    </div>
  );
}