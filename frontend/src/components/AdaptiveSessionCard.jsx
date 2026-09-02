import { useState } from 'react';
import { api } from '../api/client.js';

export const LEVEL_COLORS = {
  1: '#6b7280',
  2: '#2e9e5b',
  3: '#f4ab2c',
  4: '#e07a00',
  5: '#d64545'
};

export function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function Stars({ level }) {
  const n = Math.max(1, Math.min(5, Number(level) || 1));
  return (
    <span className="adaptive-stars" style={{ color: LEVEL_COLORS[n] }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`material-icons adaptive-star ${i < n ? 'filled' : 'empty'}`} style={{ fontSize: 20 }}>
          {i < n ? 'star' : 'star_border'}
        </span>
      ))}
    </span>
  );
}

export function dueInLabel(days) {
  const d = Number(days) || 0;
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'غداً';
  if (d < 30) return `بعد ${d} أيام`;
  return `بعد ${Math.round(d / 30)} شهراً`;
}

export default function AdaptiveSessionCard({ item, onReviewed, gradeId, subjectId }) {
  const [sel, setSel] = useState(null);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const q = item.question;
  const isMCQ = Array.isArray(q.options) && q.options.length > 0;
  const answerIndex = typeof q.answer === 'number'
    ? Number(q.answer)
    : isMCQ
      ? q.options.findIndex((o) => String(o) === String(q.answer))
      : -1;
  const correct = isMCQ ? sel != null && sel === answerIndex : normalizeText(text) === normalizeText(q.answer);

  const submit = async () => {
    setReviewing(true);
    setError('');
    try {
      const res = await api.post('/student/adaptive/review', {
        itemKey: item.itemKey,
        gradeId,
        subjectId,
        correct
      });
      setResult(res);
      setChecked(true);
      onReviewed && onReviewed(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="adaptive-card">
      <div className="adaptive-card-head">
        <span className="adaptive-level-badge" style={{ background: LEVEL_COLORS[item.state.difficulty] }}>
          مستوى {item.state.difficulty}
        </span>
        <Stars level={item.state.difficulty} />
        <span className="adaptive-level-label-text">{item.state.difficultyLabel}</span>
        {item.state.repetitions > 0 && (
          <span className="badge">مراجعة {item.state.repetitions}</span>
        )}
      </div>

      <p className="adaptive-question">{q.text}</p>

      {isMCQ ? (
        <div className="lesson-mcq">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`exercise-option ${sel === i ? 'selected' : ''} ${checked ? (i === answerIndex ? 'ok' : sel === i ? 'no' : '') : ''}`}
              onClick={() => { setSel(i); setChecked(false); }}
              disabled={checked}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="form-group">
          <input
            value={text}
            onChange={(e) => { setText(e.target.value); setChecked(false); }}
            placeholder="اكتب إجابتك هنا"
            disabled={checked}
          />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!checked && (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={reviewing || (isMCQ ? sel == null : !text.trim())}>
          {reviewing ? 'جارٍ التقييم...' : 'تحقّق وأرسل'}
        </button>
      )}

      {checked && result && (
        <div className={`adaptive-feedback ${result.correct ? 'ok' : 'no'}`}>
          <span className="material-icons">{result.correct ? 'check_circle' : 'cancel'}</span>
          <div>
            <strong>{result.correct ? 'إجابة صحيحة' : 'إجابة خاطئة'}</strong>
            {!result.correct && q.answer !== undefined && q.answer !== null && (
              <p>الإجابة الصحيحة: {isMCQ ? q.options[answerIndex] : q.answer}</p>
            )}
            <p className="adaptive-feedback-meta">
              <Stars level={result.state.difficulty} /> المستوى الجديد: {result.state.difficultyLabel}
              <span className="adaptive-due"> — مراجعة {dueInLabel(result.next.dueInDays)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
