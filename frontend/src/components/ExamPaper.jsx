import { useState } from 'react';

// Shared exam-paper renderer (Tunisian official-paper visual language):
// header shafts (name/subject/score), colored sanad boxes, numbered
// questions with points beside each one, dotted answer space below,
// margin score boxes, criteria table. Used in print mode (teacher) and
// solve mode (student on device). Content shapes: bank template or
// instantiated exam content { header, school, date, durationMinutes,
// totalPoints, criteria[], passages[], questions[], instructions }.
const SANAD_TINTS = ['#e8f1ff', '#e9f7ef', '#fdf1e7', '#f3ecfd'];

export function criterionMax(criteria, criterionId) {
  const c = (criteria || []).find((x) => x.id === criterionId);
  return c?.mastery?.max ?? null;
}

function DottedLines({ n }) {
  const count = Math.max(1, Math.min(Number(n) || 2, 12));
  return (
    <div className="answer-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="answer-line" />
      ))}
    </div>
  );
}

function QuestionPoints({ q, criteria }) {
  const max = criterionMax(criteria, q.criterion);
  return (
    <span className="q-points">
      <span className="q-crit">{q.criterion}</span>
      {max !== null && <span className="q-max">{max} ن</span>}
    </span>
  );
}

function SolveInput({ q, answers, onAnswer }) {
  const val = answers[q.id] ?? '';
  if (q.type === 'MCQ') {
    return (
      <div className="quiz-options">
        {(q.options || []).map((opt, oi) => (
          <label key={oi} className="quiz-option">
            <input
              type="radio"
              name={q.id}
              value={opt}
              checked={val === opt}
              onChange={(e) => onAnswer(q.id, e.target.value)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  if (q.type === 'TRUE_FALSE') {
    return (
      <div className="quiz-options">
        <label className="quiz-option">
          <input
            type="radio"
            name={q.id}
            value="صواب"
            checked={val === 'صواب'}
            onChange={(e) => onAnswer(q.id, e.target.value)}
          />
          صواب
        </label>
        <label className="quiz-option">
          <input
            type="radio"
            name={q.id}
            value="خطأ"
            checked={val === 'خطأ'}
            onChange={(e) => onAnswer(q.id, e.target.value)}
          />
          خطأ
        </label>
      </div>
    );
  }
  if (q.type === 'ORDER') {
    const arr = Array.isArray(val) ? val : [];
    return (
      <div className="form-group">
        <div className="order-pick">
          {(q.orderItems || []).map((item) => {
            const pos = arr.indexOf(item);
            return (
              <button
                key={item}
                type="button"
                className={`order-chip${pos >= 0 ? ' picked' : ''}`}
                onClick={() => {
                  if (pos >= 0) onAnswer(q.id, arr.filter((x) => x !== item));
                  else onAnswer(q.id, [...arr, item]);
                }}
              >
                {pos >= 0 ? `${pos + 1}. ` : ''}{item}
              </button>
            );
          })}
        </div>
        <p className="muted">رتّب بالضغط على البطاقات بالترتيب الصحيح.</p>
      </div>
    );
  }
  if (q.type === 'OPEN') {
    return (
      <div className="cahier-paper">
        <textarea
          className="lesson-textarea kid-write"
          rows={Math.min(Math.max(Number(q.answerLines) || 4, 3), 10)}
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => onAnswer(q.id, e.target.value)}
          dir="rtl"
          aria-label={q.prompt}
        />
      </div>
    );
  }
  return (
    <div className="form-group">
      <input
        value={typeof val === 'string' ? val : ''}
        onChange={(e) => onAnswer(q.id, e.target.value)}
        placeholder="اكتب إجابتك هنا"
        aria-label={q.prompt}
      />
    </div>
  );
}

function PrintAnswerSpace({ q }) {
  if (q.type === 'MCQ') {
    return (
      <div className="print-options">
        {(q.options || []).map((opt, i) => (
          <div key={i} className="print-option"><span className="box" />{opt}</div>
        ))}
      </div>
    );
  }
  if (q.type === 'TRUE_FALSE') {
    return (
      <div className="print-options">
        <div className="print-option"><span className="box" />صواب</div>
        <div className="print-option"><span className="box" />خطأ</div>
      </div>
    );
  }
  if (q.type === 'ORDER') {
    return (
      <div>
        {(q.orderItems || []).map((item, i) => (
          <div key={i} className="print-order-row">
            <span className="order-slot" />
            <span>{item}</span>
          </div>
        ))}
        <DottedLines n={1} />
      </div>
    );
  }
  if (q.type === 'OPEN') return <DottedLines n={q.answerLines || 5} />;
  return <DottedLines n={2} />;
}

export default function ExamPaper({ content, meta, mode, answers, onAnswer }) {
  const solve = mode === 'solve';
  const questions = content?.questions || [];
  const passages = content?.passages || [];
  const criteria = content?.criteria || [];
  const totalMax = criteria.reduce((s, c) => s + (Number(c.mastery?.max) || 0), 0) || content?.totalPoints || 20;
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="exam-paper" dir="rtl">
      {/* Header shafts */}
      <div className="paper-head">
        <div className="paper-id">
          <div>الاسم: ............................</div>
          <div>اللقب: ............................</div>
        </div>
        <div className="paper-title">
          <div className="paper-republic">الجمهورية التونسية — وزارة التربية</div>
          <h3>{meta?.title || content?.title || 'اختبار'}</h3>
          {(content?.school || content?.date) && (
            <div className="paper-sub">{content?.school || ''} {content?.date || ''}</div>
          )}
        </div>
        <div className="paper-meta">
          <div>المادة: {meta?.subject || ''}</div>
          <div>الثلاثي: {meta?.trimester || ''}</div>
          <div className="paper-score">العدد: .... / {totalMax}</div>
        </div>
      </div>

      {/* Sanads */}
      {passages.length > 0 && passages.map((p, i) => (
        <div key={p.id || i} className="sanad-box" style={{ background: SANAD_TINTS[i % SANAD_TINTS.length] }}>
          <span className="sanad-tag">{p.title || `السند ${i + 1}`}</span>
          <p>{p.text}</p>
        </div>
      ))}

      {/* Questions: prompt + points beside, ruled answer space below */}
      <div className="paper-questions">
        {questions.map((q, i) => (
          <div key={q.id || i} className="paper-q">
            <div className="paper-q-side">
              <span className="paper-q-num">{i + 1}</span>
              <span className="paper-q-crit">{q.criterion}</span>
            </div>
            <div className="paper-q-main">
              <div className="paper-q-head">
                <p className="paper-q-prompt">{q.prompt}</p>
                <QuestionPoints q={q} criteria={criteria} />
              </div>
              {solve
                ? <SolveInput q={q} answers={answers || {}} onAnswer={onAnswer || (() => {})} />
                : <PrintAnswerSpace q={q} />}
            </div>
          </div>
        ))}
      </div>

      {/* Grading table */}
      {criteria.length > 0 && (
        <div className="paper-criteria">
          <h4>جدول إسناد الأعداد</h4>
          <table className="paper-table">
            <thead>
              <tr>
                <th>المعيار</th>
                <th>انعدام التملك</th>
                <th>دون الأدنى</th>
                <th>الأدنى</th>
                <th>الأقصى</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id}>
                  <td>{c.label || c.id}</td>
                  <td>{c.mastery?.none ?? '—'}</td>
                  <td>{c.mastery?.below ?? '—'}</td>
                  <td>{c.mastery?.min ?? '—'}</td>
                  <td><strong>{c.mastery?.max ?? '—'}</strong></td>
                </tr>
              ))}
              <tr className="paper-total">
                <td>المجموع</td>
                <td colSpan={3} />
                <td><strong>{totalMax} / 20</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {content?.instructions && <p className="paper-instructions">{content.instructions}</p>}

      {!solve && (
        <div className="paper-key-toggle no-print">
          <button type="button" className="btn btn-sm" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'إخفاء مفاتيح الإجابة' : 'عرض مفاتيح الإجابة (للمعلم فقط)'}
          </button>
        </div>
      )}
      {!solve && showKey && (
        <div className="paper-key">
          <h4>مفاتيح الإجابة — للمعلم فقط (لا تُطبع)</h4>
          <ol>
            {questions.map((q) => (
              <li key={q.id}>
                {q.type === 'MCQ' && String(q.correct ?? '')}
                {q.type === 'TRUE_FALSE' && String(q.correctAnswer ?? '')}
                {(q.type === 'FILL_BLANK' || q.type === 'EXTRACT') && String(q.correctAnswer ?? '')}
                {q.type === 'ORDER' && (q.orderItems || []).join(' ← ')}
                {q.type === 'OPEN' && 'تصحيح يدوي'}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
