import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ExamPaper from './components/ExamPaper.jsx';
import papers from './trial-papers.json';
import './index.css';

// معاينة ورقات التجربة الأربع بعين المستخدمين (طالب/معلّم/مبرمج) — ملف تجريبي يُحذف
// بعد التحقق البصري. كل ورقة مولَّدة عبر خطّ التوليد الحقيقي ومدقّقة (approved).

const STATUS_ICON = { pass: '✓', warn: '⚠', fail: '✗' };

function contentOf(p) {
  const b = p.blueprintSummary;
  return {
    // بلا header رسمي (§5): عنوان اختبار مولَّد/معلّم لا يحمل ترويسة الوزارة
    school: 'مدرسة ..................',
    date: '2025 / 2026',
    teacher: 'أ. ..................',
    title: p.title,
    subjectLabel: b.subjectLabel,
    gradeLabel: b.gradeLabel,
    trimester: b.trimester,
    assessmentType: b.assessmentType,
    totalPoints: b.targetPoints,
    durationMinutes: b.durationMinutes,
    stimuli: p.stimuli,
    questions: p.questions,
    criteria: p.criteria || [], // §B2: جدول إسناد الأعداد بالرمز الرسمي + المصدر
    instructions: 'اقرأ التعلّمية جيّدًا قبل الإجابة. أجب بلغة عربية سليمة وخطّ واضح.'
  };
}

function Report({ paper }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>
        تقرير التديق — {paper.title}{' '}
        <span style={{ color: paper.approved ? '#1a7f37' : '#c62828' }}>
          {paper.approved ? '✓ معتمد للمراجعة' : '✗ مرفوض'}
        </span>
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
        {paper.audit.map((a) => (
          <li key={a.id}>
            <bdi>{STATUS_ICON[a.status]} {a.label}</bdi>
            {a.detail ? <span className="muted"> — {a.detail}</span> : null}
          </li>
        ))}
      </ul>
      {paper.issues.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {paper.issues.map((i, n) => (
            <p key={n} style={{ margin: '4px 0', color: i.severity === 'error' ? '#c62828' : '#b26a00' }}>
              {i.severity === 'error' ? '✗' : '⚠'} [{i.code}] {i.message}
            </p>
          ))}
        </div>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        الحالة: {paper.status} — التوليد الآلي لا يُنشر مباشرة؛ المعلّم هو المعتمد النهائي (§61).
      </p>
    </section>
  );
}

function App() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState('print');
  const paper = papers[active];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>معاينة ورقات التجربة (4)</h2>
        <span className="muted">خطّ التوليد الحقيقي — مخطّط ← برومبت ← تطبيع ← تدقيق</span>
      </header>

      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {papers.map((p, i) => (
          <button
            key={p.key}
            type="button"
            className={`btn btn-sm${i === active ? ' btn-primary' : ''}`}
            onClick={() => setActive(i)}
          >
            {p.blueprintSummary.subjectLabel} — {p.blueprintSummary.gradeLabel}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm" onClick={() => setMode(mode === 'print' ? 'solve' : 'print')}>
          {mode === 'print' ? 'عرض وضع التلميذ' : 'عرض وضع الطباعة'}
        </button>
      </nav>

      <div className="paper-shell" style={{ background: '#fff', border: '1px solid #bbb', padding: 12 }}>
        <ExamPaper content={contentOf(paper)} meta={{ subject: paper.blueprintSummary.subject }} mode={mode} />
      </div>

      <Report paper={paper} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
