import { useState } from 'react';
import { api } from '../api/client.js';

export const LEVEL_COLORS = {
  1: '#6b7280',
  2: '#2e9e5b',
  3: '#F5B942',
  4: '#e07a00',
  5: '#d64545'
};

export function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .replace(/[Ø£Ø¥Ø¢]/g, 'Ø§')
    .replace(/Ø©/g, 'Ù‡')
    .replace(/Ù‰/g, 'ÙŠ')
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
  if (d <= 0) return 'Ø§Ù„ÙŠÙˆÙ…';
  if (d === 1) return 'ØºØ¯Ø§Ù‹';
  if (d < 30) return `Ø¨Ø¹Ø¯ ${d} Ø£ÙŠØ§Ù…`;
  return `Ø¨Ø¹Ø¯ ${Math.round(d / 30)} Ø´Ù‡Ø±Ø§Ù‹`;
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
          Ù…Ø³ØªÙˆÙ‰ {item.state.difficulty}
        </span>
        <Stars level={item.state.difficulty} />
        <span className="adaptive-level-label-text">{item.state.difficultyLabel}</span>
        {item.state.repetitions > 0 && (
          <span className="badge">Ù…Ø±Ø§Ø¬Ø¹Ø© {item.state.repetitions}</span>
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
            placeholder="Ø§ÙƒØªØ¨ Ø¥Ø¬Ø§Ø¨ØªÙƒ Ù‡Ù†Ø§"
            disabled={checked}
          />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!checked && (
        <button type="button" className="btn btn-primary" onClick={submit} disabled={reviewing || (isMCQ ? sel == null : !text.trim())}>
          {reviewing ? 'Ø¬Ø§Ø±Ù Ø§Ù„ØªÙ‚ÙŠÙŠÙ…...' : 'ØªØ­Ù‚Ù‘Ù‚ ÙˆØ£Ø±Ø³Ù„'}
        </button>
      )}

      {checked && result && (
        <div className={`adaptive-feedback ${result.correct ? 'ok' : 'no'}`}>
          <span className="material-icons">{result.correct ? 'check_circle' : 'cancel'}</span>
          <div>
            <strong>{result.correct ? 'Ø¥Ø¬Ø§Ø¨Ø© ØµØ­ÙŠØ­Ø©' : 'Ø¥Ø¬Ø§Ø¨Ø© Ø®Ø§Ø·Ø¦Ø©'}</strong>
            {!result.correct && q.answer !== undefined && q.answer !== null && (
              <p>Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ø§Ù„ØµØ­ÙŠØ­Ø©: {isMCQ ? q.options[answerIndex] : q.answer}</p>
            )}
            <p className="adaptive-feedback-meta">
              <Stars level={result.state.difficulty} /> Ø§Ù„Ù…Ø³ØªÙˆÙ‰ Ø§Ù„Ø¬Ø¯ÙŠØ¯: {result.state.difficultyLabel}
              <span className="adaptive-due"> â€” Ù…Ø±Ø§Ø¬Ø¹Ø© {dueInLabel(result.next.dueInDays)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
