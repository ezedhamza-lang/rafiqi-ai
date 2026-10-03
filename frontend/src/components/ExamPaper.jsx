import { useState } from 'react';
import SvgArt from './SvgArt.jsx';
import { subjectLabel as subjectName } from '../utils/subjectLabels.js';

// ورقة الاختبار بالشكل الرسمي التونسي (S6a-e):
//   ترويسة ثلاثية الخلايا المسطّرة (مدرسة/سنة/معلّم · عنوان+مادة+ثلاثي+العدد · الاسم واللقب/المدة)
//   إطار الصفحة المزدوج · «السند n:» ثم تعليمياته «التعلمية n:» مرقّمة متصلة عبر الورقة
//   عمود هامشي محاذي لكل تعليمة يحمل وسم «مع n» + مربّع فارغ للمعلّم
//   وجدول إسناد الأعداد بالصيغة الرسمية: صفوف = مستويات التملك، أعمدة = «مع n»، + عمود «الحد •/20»
// يُستعمل في طباعة المعلّم وفي وضع حلّ التلميذ. أشكال المحتوى: بنك/مختبر/معلّم
// { header, school, date, durationMinutes, totalPoints, criteria[], stimuli[]|passages[], questions[] }.
// الترويسة الرسمية (§4) تُعرض فقط إن كان content.header مضبوطًا — لا ندّعي
// رسمية اختبار مُولَّد أو مُلَّف من المدرس.
// مستويات التملك الأربعة في جدول الإسناد (مفاتيح objectiv في criteria-grids).
const MASTERY_LEVELS = [
  ['none', 'انعدام التملك'],
  ['below', 'دون الأدنى'],
  ['min', 'الأدنى'],
  ['max', 'الأقصى']
];

export function criterionMax(criteria, criterionId) {
  const c = (criteria || []).find((x) => x.id === criterionId);
  return c?.mastery?.max ?? null;
}

/** عنوان السند المعروض: «السند n:» + اسمه إن وُجد (title قد يأتي مسبقًا بـ«السند n:»). */
function sanadHeading(sind, gi) {
  const t = String(sind?.title || '').trim();
  if (!t) return `السند ${gi + 1}:`;
  return /^السند\s*\d+\s*[:：]/.test(t) ? t : `السند ${gi + 1}: ${t}`;
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

function QuestionPoints({ q, criteria, hideCriterion }) {
  // نقاط السؤال المفردة (§8): تُفضَّل فوق حصيلة المعيار إن وُجدت
  const qPoints = Number(q.points);
  const critMax = criterionMax(criteria, q.criterion);
  const shown = Number.isFinite(qPoints) && qPoints > 0 ? qPoints : critMax;
  return (
    <span className="q-points">
      {!hideCriterion && <span className="q-crit">{q.criterion}</span>}
      {shown !== null && shown !== undefined && <span className="q-max">{shown} ن</span>}
    </span>
  );
}

/** §D12: في وضع الحل تُغلَّف الإجابة بإطار مساحة مستقلة (عمودي/رسم). */
function SolveInput({ q, answers, onAnswer }) {
  const body = <SolveInputBody q={q} answers={answers} onAnswer={onAnswer} />;
  if (q.layout === 'vertical') {
    return <div className="calc-frame solve-frame">{body}</div>;
  }
  if (q.layout === 'drawing') {
    return <div className="drawing-frame solve-frame">{body}</div>;
  }
  return body;
}

function SolveInputBody({ q, answers, onAnswer }) {
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
  if (q.type === 'ORDER' && (q.orderItems || []).length) {
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
  // §D12: مساحة مستقلة للعملية العمودية / مساحة للرسم — تسبق الشكل النوعي.
  if (q.layout === 'vertical') {
    return (
      <div className="calc-frame" aria-label="مساحة تنفيذ العملية العمودية">
        <span className="frame-hint">أنجز العملية هنا:</span>
      </div>
    );
  }
  if (q.layout === 'drawing') {
    return <div className="drawing-frame" aria-label="مساحة الرسم" />;
  }
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
    const items = q.orderItems || [];
    // مخرَج بلا عناصر: أسطر كافية لكتابة الترتيب بدل فراغ يُفقد التلميذ مكان إجابته
    if (!items.length) return <DottedLines n={4} />;
    return (
      <div>
        {items.map((item, i) => (
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

/** تعليمة واحدة: عمود هامشي «مع n + النقاط + مربّع» ثم متن التعليمة مرقّمًا متصلًا. */
function Instruction({ num, q, criteria, solve, answers, onAnswer }) {
  return (
    <div className="talimia-row">
      <aside className="talimia-margin" aria-hidden="true">
        <span className="crit-tag">{q.criterion || ''}</span>
        <QuestionPoints q={q} criteria={criteria} hideCriterion />
        <span className="tick-box" />
      </aside>
      <div className="talimia-main">
        <p className="talimia-prompt">
          <span className="talimia-num">التعلمية {num}:</span>
          {q.prompt}
        </p>
        {q.art && <SvgArt id={q.art} size={150} />}
        {solve
          ? <SolveInput q={q} answers={answers || {}} onAnswer={onAnswer || (() => {})} />
          : <PrintAnswerSpace q={q} />}
      </div>
    </div>
  );
}

export default function ExamPaper({ content, meta, mode, answers, onAnswer }) {
  const solve = mode === 'solve';
  const criteria = content?.criteria || [];
  // المجموع المعروض: totalPoints المخزَّن (10/15/20 حسب المخطّط) ثم حصيلة المعيار
  const criteriaSum = criteria.reduce((s, c) => s + (Number(c.mastery?.max) || 0), 0);
  const totalMax = Number(content?.totalPoints) || criteriaSum || 20;
  const [showKey, setShowKey] = useState(false);

  // المادة: التسمية لا الرمز (§78) — نفضّل subjectLabel المخزَّن ثم معجم الواجهة
  const subjectText = content?.subjectLabel || subjectName(meta?.subject);
  // الترويسة الرسمية (§4): header فارغ يعني اختبار مدرس/مولَّد
  const republic = content?.header;

  // ── S6c: السند أصل — نجمّع تعليمياته تحته ونرقّمها متصلًا عبر الورقة ──
  const stimuli = (Array.isArray(content?.stimuli) && content.stimuli.length
    ? content.stimuli
    : content?.passages) || [];
  const all = content?.questions || [];
  const groups = [];
  if (stimuli.length) {
    stimuli.forEach((s) => groups.push({ sind: s, items: [] }));
    const loose = { sind: null, items: [] };
    all.forEach((q) => {
      const gi = groups.findIndex((g) => g.sind && g.sind.id === q.sindId);
      if (gi >= 0) groups[gi].items.push(q);
      else if (stimuli.length === 1) groups[0].items.push(q); // سند واحد فقط — الربط محسوس
      else loose.items.push(q); // بلا sindId وسندات متعددة — نعرضه بعد السندات لا نُسقطه
    });
    if (loose.items.length) groups.push(loose);
  } else {
    groups.push({ sind: null, items: all });
  }
  let counter = 0;
  const laid = groups.map((g) => ({
    ...g,
    items: g.items.map((q) => ({ q, num: (counter += 1) }))
  }));

  const title = meta?.title || content?.title || 'اختبار';
  const trimester = meta?.trimester || content?.trimester || '';

  return (
    <div className="exam-paper" dir="rtl">
      {/* ── S6a: ترويسة بثلاث خلايا مسطّرة (مدرسة/سنة/معلّم · عنوان · اسم) ── */}
      <div className="paper-head">
        <div className="ph-cell">
          <div className="ph-line"><b>المدرسة:</b> {content?.school || '......................'}</div>
          <div className="ph-line"><b>السنة الدراسية:</b> {content?.date || '..................'}</div>
          <div className="ph-line"><b>المعلّم(ة):</b> {content?.teacher || '..................'}</div>
        </div>
        <div className="ph-cell ph-center">
          {republic ? <div className="paper-republic">{republic}</div> : null}
          <h3>{title}</h3>
          <div className="ph-sub">المادة: {subjectText}</div>
          <div className="ph-sub">
            {content?.gradeLabel ? `${content.gradeLabel} · ` : ''}
            {trimester ? `الثلاثي ${trimester}` : content?.assessmentType || ''}
          </div>
          <div className="paper-score">العدد: .... / <bdi>{totalMax}</bdi></div>
        </div>
        <div className="ph-cell">
          <div className="ph-line">الاسم واللقب:</div>
          <div className="ph-dots" />
          <div className="ph-line">القسم: ..................</div>
          <div className="ph-line">
            المدة الزمنية: {content?.durationMinutes ? `${content.durationMinutes} د` : '..................'}
          </div>
        </div>
      </div>

      {/* ── السندات وتعليمياتها ── */}
      {laid.map((g, gi) => (
        <section key={g.sind?.id || `g${gi}`} className="sanad-block">
          {g.sind && (
            <>
              <div className="sanad-title">
                {sanadHeading(g.sind, gi)}
                {g.sind.purpose ? <span className="sanad-hint"> — {g.sind.purpose}</span> : null}
              </div>
              <p className="sanad-text">{g.sind.text}</p>
              {g.sind.image && <img className="sanad-img" src={g.sind.image} alt={g.sind.title || ''} />}
            </>
          )}
          <div className="talimia-list">
            {g.items.map(({ q, num }) => (
              <Instruction
                key={q.id || num}
                num={num}
                q={q}
                criteria={criteria}
                solve={solve}
                answers={answers}
                onAnswer={onAnswer}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── S6e: جدول إسناد الأعداد بالصيغة الرسمية ── */}
      {criteria.length > 0 && (
        <div className="paper-criteria">
          <h4>جدول إسناد الأعداد</h4>
          <table className="paper-table official">
            <thead>
              <tr>
                <th className="crit-levels-head" rowSpan={2}>مستويات التملك</th>
                {criteria.map((c) => (
                  <th key={c.id} className="crit-id">
                    {c.officialCode || c.id}
                    {c.officialCode && c.officialCode !== c.id && (
                      <span className="crit-internal" title="الرمز الداخلي للتنقيط">{c.id}</span>
                    )}
                  </th>
                ))}
                <th className="crit-limit-head" rowSpan={2}>الحد</th>
              </tr>
              <tr>
                {criteria.map((c) => (
                  <th key={c.id} className="crit-label">
                    {c.label || ''}
                    {c.source && <span className="crit-source">{c.source}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MASTERY_LEVELS.map(([key, label], li) => (
                <tr key={key}>
                  <th className="crit-level" scope="row">{label}</th>
                  {criteria.map((c) => (
                    <td key={c.id}>{c.mastery?.[key] ?? '—'}</td>
                  ))}
                  {li === 0 && (
                    <td className="crit-limit" rowSpan={MASTERY_LEVELS.length}>
                      • / <bdi>{totalMax}</bdi>
                    </td>
                  )}
                </tr>
              ))}
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
            {all.map((q) => (
              <li key={q.id}>
                {q.type === 'MCQ' && String(q.correct ?? q.correctAnswer ?? '')}
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
