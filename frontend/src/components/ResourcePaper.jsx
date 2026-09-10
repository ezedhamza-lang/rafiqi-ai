import { useState } from 'react';
import SvgArt from './SvgArt.jsx';
import { useI18n } from '../i18n/index.jsx';
import { subjectLabel } from '../utils/labels';

// عرض الموارد المولّدة آليًا في ورقة رسمية بأسلوب أوراق الاختبار التونسية
// (ترويسة بالجمهورية والمادة، أسئلة مرقمة بخانات اختيار، سطور إجابة منقّطة،
// شبكة مراحل/بطاقات). يعمل للطباعة وللمعاينة على الشاشة.

const ROMAN = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

function DottedLines({ n = 2 }) {
  const count = Math.max(1, Math.min(Number(n) || 2, 12));
  return (
    <div className="answer-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="answer-line" />)}
    </div>
  );
}

function WorksheetExercise({ ex, i }) {
  return (
    <div className="paper-q">
      <div className="paper-q-side">
        <span className="paper-q-num">{i + 1}</span>
      </div>
      <div className="paper-q-main">
        <div className="paper-q-head">
          <p className="paper-q-prompt">{ex.prompt}</p>
        </div>
        {ex.type === 'MCQ' && (
          <div className="print-options">
            {(ex.options || []).map((opt, oi) => (
              <div key={oi} className="print-option"><span className="box" />{opt}</div>
            ))}
          </div>
        )}
        {ex.type === 'FILL' && (
          <p className="rp-fill">أكملي الفراغ: <span className="rp-blank">………………</span></p>
        )}
        {ex.type !== 'MCQ' && <DottedLines n={ex.type === 'OPEN' ? 4 : 2} />}
      </div>
    </div>
  );
}

export default function ResourcePaper({ resource }) {
  const { t } = useI18n();
  const [showKey, setShowKey] = useState(false);
  const kind = resource?.kind;
  const c = resource?.content || {};

  return (
    <div className="exam-paper" dir="rtl">
      <div className="paper-head">
        <div className="paper-id">
          <div>الاسم: ............................</div>
          <div>الفريق: ............................</div>
        </div>
        <div className="paper-title">
          <div className="paper-republic">الجمهورية التونسية — وزارة التربية</div>
          <h3>{c.title || resource?.title || resource?.lessonTitle}</h3>
          <div className="paper-sub">{t('teacherSpace.common.resourceKinds.' + kind) || kind}</div>
        </div>
        <div className="paper-meta">
          <div>المادة: {subjectLabel(t, resource?.subject || c.subject)}</div>
          <div>المستوى: {resource?.level || c.level || ''}</div>
          {kind === 'LESSON_PLAN' && c.duration ? <div>المدة: {c.duration} دقيقة</div> : null}
          {kind === 'HOMEWORK' && c.dueDays ? <div>الإنجاز خلال: {c.dueDays} أيام</div> : null}
        </div>
      </div>

      {/* ===== ورقة عمل ===== */}
      {kind === 'WORKSHEET' && (
        <>
          {c.instructions && (
            <div className="sanad-box" style={{ background: '#e8f1ff' }}>
              <span className="sanad-tag">تعليمات</span>
              <p>{c.instructions}</p>
            </div>
          )}
          <div className="paper-questions">
            {(c.exercises || []).map((ex, i) => <WorksheetExercise key={i} ex={ex} i={i} />)}
          </div>
          {(c.exercises || []).some((e) => e.answer) && (
            <div className="rp-key">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'إخفاء سلّم التصحيح' : 'إظهار سلّم التصحيح'}
              </button>
              {showKey && (
                <table className="paper-table">
                  <thead><tr><th>السؤال</th><th>الجواب</th></tr></thead>
                  <tbody>
                    {(c.exercises || []).map((ex, i) => (
                      <tr key={i}><td>{i + 1}. {String(ex.prompt || '').slice(0, 60)}</td><td>{String(ex.answer ?? '—')}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== واجب منزلي ===== */}
      {kind === 'HOMEWORK' && (
        <div className="paper-questions">
          <div className="rp-section-title">الواجب المنزلي</div>
          {(c.tasks || []).map((task, i) => (
            <div key={i} className="print-option rp-task"><span className="box" />{String(i + 1)}. {task}</div>
          ))}
          <DottedLines n={6} />
        </div>
      )}

      {/* ===== بطاقات ===== */}
      {kind === 'FLASHCARDS' && (
        <div className="paper-criteria">
          <h4>بطاقات المراجعة</h4>
          <table className="paper-table">
            <thead><tr><th>وجه البطاقة</th><th>القفا</th></tr></thead>
            <tbody>
              {(c.cards || []).map((cd, i) => (
                <tr key={i}><td>{cd.front}</td><td>{cd.back}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== شرائح عرض ===== */}
      {kind === 'PRESENTATION' && (
        <div className="paper-questions">
          {(c.slides || []).map((s, i) => (
            <div key={i} className="rp-slide">
              <div className="rp-slide-head"><span className="paper-q-num">{i + 1}</span> الشريحة {ROMAN[i] || i + 1}: {s.title}</div>
              <p className="rp-slide-body">{s.body}</p>
              {s.art && <SvgArt id={s.art} size={140} />}
            </div>
          ))}
        </div>
      )}

      {/* ===== خطة درس ===== */}
      {kind === 'LESSON_PLAN' && (
        <div className="paper-questions">
          {(c.objectives || []).length > 0 && (
            <div className="rp-block">
              <div className="rp-section-title">الأهداف والكفاءات المستهدفة</div>
              <ul className="rp-ul">{(c.objectives || []).map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
          )}
          {(c.materials || []).length > 0 && (
            <div className="rp-block">
              <div className="rp-section-title">الوسائل المعينة</div>
              <p>{(c.materials || []).join(' — ')}</p>
            </div>
          )}
          {(c.stages || []).length > 0 && (
            <div className="paper-criteria">
              <h4>سندات سير الحصة</h4>
              <table className="paper-table">
                <thead><tr><th>الوقت</th><th>المرحلة</th><th>الهدف البيداغوجي</th><th>نشاط الأستاذ والمتعلمين</th></tr></thead>
                <tbody>
                  {(c.stages || []).map((s, i) => (
                    <tr key={i}><td>{s.time}</td><td>{s.name}</td><td>{s.goal}</td><td>{s.activity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {c.evaluation && (
            <div className="rp-block">
              <div className="rp-section-title">التقويم</div>
              <p>{c.evaluation}</p>
            </div>
          )}
          {c.homework && (
            <div className="rp-block">
              <div className="rp-section-title">الواجب المنزلي</div>
              <p>{c.homework}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
