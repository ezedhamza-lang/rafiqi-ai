import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import VideoPlayer from './VideoPlayer.jsx';
import VideoCard from './VideoCard.jsx';
import SvgArt from './SvgArt.jsx';
import AssessmentPaper from './AssessmentPaper.jsx';
import { bidiNodes } from '../utils/bidi';

const BLOCK_ICONS = {
  objective: 'track_changes',
  concept: 'lightbulb',
  definition: 'menu_book',
  example: 'fact_check',
  note: 'info',
  keyword: 'translate',
  vocabulary: 'lightbulb',
  question: 'quiz',
  experiment: 'science',
  activity: 'edit_note',
  summary: 'checklist',
  reward: 'emoji_events',
  textarea: 'edit',
  'math-input': 'functions',
  drawing: 'brush',
  'file-upload': 'cloud_upload'
};

const MATH_SYMBOLS = ['×', '÷', '−', '+', '=', '²', '³', '½', '¼', '(', ')'];

// Max attached file payload per block (base64) — keeps the submit JSON
// well below the server body limit.
const MAX_ATTACH_BYTES = 2500000;

function ListenBtn() {
  return null; // معطّل حسب معيار المحتوى: لا صوت في الدروس
}

// Minimal rich text: **bold** → <strong>. Lesson content uses ** for
// emphasis but blocks render plain text, so parse it here.
function rich(text) {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split('**');
  if (parts.length < 3) return bidiNodes(text);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{bidiNodes(p)}</strong> : <span key={i}>{bidiNodes(p)}</span>));
}

function QuestionBlock({ block }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const icon = BLOCK_ICONS.question;
  const isMCQ = block.options && block.options.length > 0;
  const hasAnswer = block.answer !== undefined && block.answer !== null;
  const answerIndex = hasAnswer && typeof block.answer === 'number'
    ? Number(block.answer)
    : (block.options || []).findIndex((o) => String(o) === String(block.answer));
  const correct = sel != null && hasAnswer && sel === answerIndex;
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{rich(block.title) || 'سؤال'}</strong>
        {block.text && <p>{rich(block.text)}</p>}
      </div>
      {isMCQ ? (
        <>
          <div className="lesson-mcq">
            {block.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className={`exercise-option ${sel === i ? 'selected' : ''} ${checked && hasAnswer && (i === sel ? (correct ? 'ok' : 'no') : i === answerIndex ? 'ok' : '')}`}
                onClick={() => { setSel(i); setChecked(false); }}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="exercise-check-row">
            {hasAnswer && (
              <button type="button" className="btn btn-sm" onClick={() => setChecked(true)}>تحقّق</button>
            )}
            {checked && hasAnswer && (
              <span className={`exercise-feedback ${correct ? 'ok' : 'no'}`}>
                {correct ? '✓ صحيح' : '✗ خاطئ'}
              </span>
            )}
            {checked && hasAnswer && answerIndex >= 0 && <span className="exercise-answer">الإجابة: {block.options[answerIndex]}</span>}
          </div>
        </>
      ) : (
        <div className="lesson-answer-toggle">
          <button type="button" className="btn btn-sm" onClick={() => setShowAnswer((v) => !v)}>
            {showAnswer ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
          </button>
          {showAnswer && <span className="exercise-answer">الإجابة: {block.answer || block.text}</span>}
        </div>
      )}
    </div>
  );
}

function ExperimentBlock({ block }) {
  const icon = BLOCK_ICONS.experiment;
  return (
    <div className="lesson-block lesson-block-experiment">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'جرّب بنفسك'}</strong>
      </div>
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      {block.materials?.length > 0 && (
        <div className="lesson-experiment-materials">
          <strong>الأدوات:</strong>
          <ul>{block.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      {block.steps?.length > 0 && (
        <div className="lesson-experiment-steps">
          <strong>الخطوات:</strong>
          <ol>{block.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ block }) {
  const icon = BLOCK_ICONS.summary;
  return (
    <div className="lesson-block lesson-block-summary">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'خلاصة الوحدة'}</strong>
      </div>
      <ul className="lesson-summary-list">
        {(block.points || []).map((pt, i) => <li key={i}>{rich(pt)}</li>)}
      </ul>
    </div>
  );
}

function RewardBlock({ block }) {
  const icon = BLOCK_ICONS.reward;
  return (
    <div className="lesson-block lesson-block-reward">
      <span className="material-icons">{icon}</span>
      <p className="lesson-block-text">{rich(block.text) || 'أحسنت!'}</p>
    </div>
  );
}

function DefaultBlock({ block, kind, icon }) {
  const [imgErr, setImgErr] = useState(false);
  const showImg = block.image && !imgErr;
  return (
    <div className={`lesson-block lesson-block-${kind}`}>
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{rich(block.title) || (kind === 'objective' ? 'الأهداف' : '')}</strong>
      </div>
      {showImg ? (
        <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
          <img src={block.image} alt={block.title || ''} onError={() => setImgErr(true)} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 14, border: '2px solid #dbead2' }} />
        </div>
      ) : block.art && <SvgArt id={block.art} />}
      <p className="lesson-block-text">{rich(block.text)}</p>
    </div>
  );
}

function VocabularyBlock({ block }) {
  const words = block.words || [];
  return (
    <div className="lesson-block lesson-block-vocabulary">
      <div className="lesson-block-head">
        <span className="material-icons">{BLOCK_ICONS.vocabulary}</span>
        <strong>{block.title || 'مفردات النص'}</strong>
      </div>
      <div className="vocab-chips">
        {words.map((w, i) => (
          <span key={i} className="vocab-chip" title={w.meaning || ''}>
            <b>{w.word}</b>
            {w.meaning && <em> — {w.meaning}</em>}
          </span>
        ))}
      </div>
    </div>
  );
}

function PictureChoiceBlock({ block, onAnswer, blockId }) {
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const icon = BLOCK_ICONS.question;
  const correct = sel !== null && sel === block.answer;
  const verify = () => {
    setChecked(true);
    onAnswer(blockId, { type: 'picture', picked: sel, correct: sel === block.answer });
  };
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'اختر الصورة'}</strong>
        <ListenBtn text={`${block.title || ''}. ${block.text || ''}`} />
      </div>
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      <div className="pic-grid">
        {(block.options || []).map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`pic-card ${sel === i ? 'selected' : ''} ${checked && (i === sel ? (correct ? 'ok' : 'no') : i === block.answer ? 'ok' : '')}`}
            onClick={() => { setSel(i); setChecked(false); }}
          >
            {opt.image ? (
              <img src={opt.image} alt={opt.label || ''} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ maxWidth: 150, maxHeight: 110, borderRadius: 10, objectFit: 'contain' }} />
            ) : opt.art && <SvgArt id={opt.art} size={96} />}
            <span>{opt.label || ''}</span>
          </button>
        ))}
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" onClick={verify} disabled={sel === null}>تحقّق</button>
        {checked && (
          <span className={`exercise-feedback ${correct ? 'ok' : 'no'}`}>
            {correct ? '✓ أحسنت' : '✗ حاول مجددًا'}
          </span>
        )}
      </div>
      {block.hint && <p className="lesson-hint">{block.hint}</p>}
    </div>
  );
}

function seededOrder(n, seedStr) {
  const a = Array.from({ length: n }, (_, i) => i);
  let h = 0;
  for (const c of String(seedStr)) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  for (let i = n - 1; i > 0; i -= 1) {
    h = ((h * 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MatchPairsBlock({ block, onAnswer, blockId }) {
  const pairs = block.pairs || [];
  const [left, setLeft] = useState(null);
  const [done, setDone] = useState([]);
  const [wrong, setWrong] = useState(null);
  const order = useMemoShuffled(pairs.length, blockId);
  const icon = BLOCK_ICONS.question;
  const pickRight = (pairIdx) => {
    if (left === null || done.includes(pairIdx)) return;
    if (left === pairIdx) {
      const nd = [...done, pairIdx];
      setDone(nd);
      setLeft(null);
      if (nd.length === pairs.length) onAnswer(blockId, { type: 'match', done: true });
    } else {
      setWrong(pairIdx);
      setTimeout(() => setWrong(null), 600);
    }
  };
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'اربط'}</strong>
        <ListenBtn text={`${block.title || ''}. ${block.text || ''}`} />
      </div>
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      <div className="match-cols">
        <div className="match-col">
          {pairs.map((p, i) => (
            <button
              key={`l${i}`}
              type="button"
              className={`match-item ${left === i ? 'selected' : ''} ${done.includes(i) ? 'done' : ''}`}
              onClick={() => { if (!done.includes(i)) setLeft(i); }}
              disabled={done.includes(i)}
            >
              {p.left?.art && <SvgArt id={p.left.art} size={64} />}
              <span>{p.left?.text || ''}</span>
            </button>
          ))}
        </div>
        <div className="match-col">
          {order.map((pi) => (
            <button
              key={`r${pi}`}
              type="button"
              className={`match-item ${wrong === pi ? 'wrong' : ''} ${done.includes(pi) ? 'done' : ''}`}
              onClick={() => pickRight(pi)}
              disabled={done.includes(pi)}
            >
              {pairs[pi].right?.art && <SvgArt id={pairs[pi].right.art} size={64} />}
              <span>{pairs[pi].right?.text || ''}</span>
            </button>
          ))}
        </div>
      </div>
      {done.length === pairs.length && pairs.length > 0 && (
        <p className="match-done-msg">✓ أحسنت! أكملت كل المطابقة.</p>
      )}
      {block.hint && <p className="lesson-hint">{block.hint}</p>}
    </div>
  );
}

function useMemoShuffled(n, seed) {
  const [order] = useState(() => seededOrder(n, seed));
  return order;
}

// Normalization mirrors backend gradingService (Arabic letters, tashkeel,
// Arabic-Indic digits, whitespace) so instant checking matches server rules.
function normAns(s) {
  return String(s ?? '').trim()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[ً-ٟ]/g, '')
    .replace(/[٠-٩]/g, (dd) => '٠١٢٣٤٥٦٧٨٩'.indexOf(dd))
    .replace(/\s+/g, ' ');
}

function TextareaBlock({ block, onAnswer, blockId }) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  useEffect(() => { onAnswerRef.current(blockId, value); }, [value, blockId]);
  const icon = BLOCK_ICONS.textarea;
  const verifiable = block.answer !== undefined && block.answer !== null;
  const check = () => { setChecked(true); setOk(normAns(value) === normAns(block.answer)); };
  return (
    <div className="lesson-block lesson-block-textarea">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'إجابة حرة'}</strong>
        <ListenBtn text={`${block.title || ''}. ${block.text || ''}`} />
      </div>
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      <span className="write-here"><span className="material-icons" style={{ fontSize: 20 }}>edit</span> اكتب إجابتك هنا</span>
      <div className="cahier-paper">
        <textarea
          className="lesson-textarea kid-write"
          placeholder={block.placeholder || 'اكتب إجابتك هنا...'}
          rows={block.rows || 5}
          value={value}
          onChange={(e) => { setValue(e.target.value); setChecked(false); }}
          dir="rtl"
          aria-label={block.title || 'مكان الإجابة'}
        />
      </div>
      {verifiable && (
        <div className="exercise-check-row">
          <button type="button" className="btn btn-sm" onClick={check}>تحقّق</button>
          {checked && (
            <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>
              {ok ? '✓ صحيح' : '✗ حاول مجددًا'}
            </span>
          )}
        </div>
      )}
      {block.hint && <p className="lesson-hint">{block.hint}</p>}
    </div>
  );
}

function MathInputBlock({ block, onAnswer, blockId }) {
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(null);
  const inputRef = useRef(null);
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  useEffect(() => { onAnswerRef.current(blockId, value); }, [value, blockId]);
  const icon = BLOCK_ICONS['math-input'];
  const verifiable = block.answer !== undefined && block.answer !== null;
  const check = () => { setChecked(true); setOk(normAns(value) === normAns(block.answer)); };
  const insertSymbol = (sym) => {
    const el = inputRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + sym + value.slice(end);
      setValue(next);
      requestAnimationFrame(() => {
        try { el.focus(); el.setSelectionRange(start + sym.length, start + sym.length); } catch { /* ignore */ }
      });
    } else {
      setValue(value + sym);
    }
  };
  return (
    <div className="lesson-block lesson-block-math">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'عملية رياضية'}</strong>
        <ListenBtn text={`${block.title || ''}. ${block.text || ''}`} />
      </div>
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      <span className="write-here"><span className="material-icons" style={{ fontSize: 20 }}>functions</span> اكتب العملية هنا</span>
      <div className="math-input-wrapper">
        <div className="cahier-paper">
          <textarea
            ref={inputRef}
            className="lesson-math-input kid-write"
            placeholder={block.placeholder || 'اكتب العملية الحسابية...'}
            rows={block.rows || 6}
            value={value}
            onChange={(e) => { setValue(e.target.value); setChecked(false); }}
            dir="rtl"
            spellCheck={false}
            aria-label={block.title || 'مكان العملية'}
          />
        </div>
        <div className="math-symbols">
          {MATH_SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              className="math-symbol-btn"
              onClick={() => insertSymbol(sym)}
            >
              {sym}
            </button>
          ))}
          </div>
        </div>
        {verifiable && (
          <div className="exercise-check-row">
            <button type="button" className="btn btn-sm" onClick={check}>تحقّق</button>
            {checked && (
              <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>
                {ok ? '✓ صحيح' : '✗ حاول مجددًا'}
              </span>
            )}
          </div>
        )}
        {block.hint && <p className="lesson-hint">{block.hint}</p>}
      </div>
    );
}

function DrawingBlock({ block, onAnswer, blockId }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [saved, setSaved] = useState(false);
  const icon = BLOCK_ICONS.drawing;

  const capture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      onAnswer(blockId, { type: 'drawing', dataUrl: canvas.toDataURL('image/png') });
      setSaved(true);
    } catch { /* canvas export unavailable */ }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let drawing = false;
    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const strokeTo = (x, y) => {
      const ctx = canvas.getContext('2d');
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
      }
      ctx.lineCap = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const onDown = (e) => {
      drawing = true;
      setSaved(false);
      const { x, y } = pos(e);
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const onMove = (e) => { if (drawing) { const { x, y } = pos(e); strokeTo(x, y); } };
    const onUp = () => { drawing = false; };
    const onTouchStart = (e) => { if (e.touches[0]) onDown(e.touches[0]); };
    const onTouchMove = (e) => { if (e.touches[0]) { e.preventDefault(); onMove(e.touches[0]); } };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('mouseleave', onUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onUp);
    };
  }, [tool, color, lineWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && block.backgroundGrid) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const size = 20;
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      if (block.startPoint && block.endPoint) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(block.startPoint.x * 20, block.startPoint.y * 20);
        ctx.lineTo(block.endPoint.x * 20, block.endPoint.y * 20);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [block.backgroundGrid, block.endPoint, block.startPoint]);

  const tools = block.tools || ['pen', 'eraser'];

  return (
    <div className="lesson-block lesson-block-drawing">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || 'رسم حر'}</strong>
        <ListenBtn text={`${block.title || ''}. ${block.prompt || ''}`} />
      </div>
      {block.prompt && <p className="lesson-block-text">{rich(block.prompt)}</p>}
      <span className="write-here"><span className="material-icons" style={{ fontSize: 20 }}>brush</span> ارسم هنا بإصبعك</span>
      <div className="drawing-toolbar">
        {tools.map((t) => (
          <button
            key={t}
            type="button"
            className={`tool-btn ${tool === t ? 'active' : ''}`}
            onClick={() => setTool(t)}
            title={t === 'pen' ? 'قلم' : 'ممحاة'}
          >
            <span className="material-icons">{t === 'pen' ? 'brush' : 'backspace'}</span>
          </button>
        ))}
        {['#000000', '#ff0000', '#0000ff', '#00aa00', '#ff8800', '#aa00aa'].map((c) => (
          <button
            key={c}
            type="button"
            className={`color-btn ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
        <label>عرض الخط: <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} /></label>
      </div>
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        width={block.canvasWidth || 500}
        height={block.canvasHeight || 300}
        style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', touchAction: 'none' }}
      />
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" onClick={capture}>
          {saved ? '✓ تم حفظ الرسم' : 'حفظ الرسم في إجابتي'}
        </button>
      </div>
      {block.hint && <p className="lesson-hint">{block.hint}</p>}
    </div>
  );
}

function FileUploadBlock({ block, onAnswer, blockId }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tooBig, setTooBig] = useState(false);
  const icon = BLOCK_ICONS['file-upload'];
  const inputId = `upload-${blockId}`.replace(/[^a-zA-Z0-9-_]/g, '-');

  const handleFile = (f) => {
    if (!f) return;
    if (block.maxSizeMB && f.size > block.maxSizeMB * 1024 * 1024) {
      alert(`الملف كبير جداً. الحد الأقصى ${block.maxSizeMB} MB`);
      return;
    }
    setFile(f);
    setTooBig(false);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setPreview(dataUrl);
        if (typeof dataUrl === 'string' && dataUrl.length <= MAX_ATTACH_BYTES) {
          onAnswer(blockId, { kind: 'file', name: f.name, size: f.size, mimeType: f.type, dataUrl });
        } else {
          setTooBig(true);
          onAnswer(blockId, { kind: 'file', name: f.name, size: f.size, mimeType: f.type });
        }
      };
      reader.readAsDataURL(f);
    } else {
      onAnswer(blockId, { kind: 'file', name: f.name, size: f.size, mimeType: f.type });
    }
  };

  return (
    <div className="lesson-block lesson-block-upload">
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{rich(block.title) || 'سؤال'}</strong>
        {block.text && <p>{rich(block.text)}</p>}
      </div>
      {block.art && <SvgArt id={block.art} />}
      {block.text && <p className="lesson-block-text">{rich(block.text)}</p>}
      <div className="upload-area">
        <input
          type="file"
          accept={block.accept || 'image/*,application/pdf'}
          onChange={(e) => handleFile(e.target.files[0])}
          className="file-input"
          id={inputId}
        />
        <label className="upload-label" htmlFor={inputId}>
          <span className="material-icons">cloud_upload</span>
          {file ? `تم اختيار: ${file.name}` : 'اضغط لاختيار ملف (صورة أو PDF)'}
        </label>
      </div>
      {preview && (
        <div className="upload-preview">
          <img src={preview} alt="معاينة" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 8 }} />
        </div>
      )}
      {file && (
        <p className="lesson-hint">
          {tooBig
            ? 'الصورة كبيرة — سيُرفق اسمها فقط. التقط صورة أصغر لإرفاق محتواها.'
            : 'سيُرفق هذا الملف مع زر «أرسل للمعلم» أسفل الدرس.'}
        </p>
      )}
      {block.hint && <p className="lesson-hint">{block.hint}</p>}
    </div>
  );
}

// Dispatcher without hooks — safe to reuse across lessons with different
// block kinds at the same list positions (React hooks rules).
const TASK_KINDS = ['question','math-input','textarea','drawing','picture-choice','match-pairs','activity','experiment'];

function Block({ block, onAnswer = () => {}, blockId = '' }) {
  const kind = block?.kind || 'concept';
  const icon = BLOCK_ICONS[kind] || 'article';
  const inner = () => {
    switch (kind) {
      case 'question': return <QuestionBlock block={block} />;
      case 'experiment': return <ExperimentBlock block={block} />;
      case 'summary': return <SummaryBlock block={block} />;
      case 'vocabulary': return <VocabularyBlock block={block} />;
      case 'reward': return <RewardBlock block={block} />;
      case 'textarea': return <TextareaBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      case 'math-input': return <MathInputBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      case 'drawing': return <DrawingBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      case 'picture-choice': return <PictureChoiceBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      case 'match-pairs': return <MatchPairsBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      case 'file-upload': return <FileUploadBlock block={block} onAnswer={onAnswer} blockId={blockId} />;
      default: return <DefaultBlock block={block} kind={kind} icon={icon} />;
    }
  };
  const el = inner();
  if (block.points != null && TASK_KINDS.includes(kind)) {
    return (<> {el} <span className="block-points">+{block.points} ن.ن</span> </>);
  }
  return el;
}

export { Block };

function fileAnswerToAttachment(blockId, value) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'file') {
    return {
      name: value.name || `file-${blockId}`,
      size: value.size || 0,
      type: value.mimeType || 'application/octet-stream',
      ...(value.dataUrl ? { dataUrl: value.dataUrl } : {})
    };
  }
  if (value.type === 'drawing' && value.dataUrl) {
    return {
      name: `drawing-${String(blockId).replace(/[^a-zA-Z0-9-_]/g, '-')}.png`,
      size: value.dataUrl.length,
      type: 'image/png',
      dataUrl: value.dataUrl
    };
  }
  return null;
}

function LessonPage({ lesson, index, total, onNav, lessonVideos, completed, onComplete, book }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const handleAnswer = (blockId, answer) => {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
  };

  const handleSubmit = async () => {
    const lessonId = lesson.id;
    const isAssessment = lesson.isAssessment || /^y\d+a\d+$/.test(lessonId);

    const keptAnswers = Object.fromEntries(
      Object.entries(answers).filter(([, val]) => val !== '' && val !== null && val !== undefined)
    );

    if (Object.keys(keptAnswers).length === 0) {
      setSubmitResult({ success: false, message: 'الرجاء الإجابة على تمرين واحد على الأقل قبل الإرسال' });
      return;
    }

    const files = Object.entries(keptAnswers)
      .map(([id, val]) => fileAnswerToAttachment(id, val))
      .filter(Boolean);

    const submission = {
      lessonId,
      lessonTitle: lesson.title,
      answers: keptAnswers,
      ...(isAssessment ? { isAssessment: true } : {}),
      ...(files.length ? { files } : {}),
      submittedAt: new Date().toISOString()
    };

    setSubmitting(true);
    try {
      const res = await api.post('/student/lesson/submit', submission);
      setSubmitResult({ success: true, message: 'تم إرسال إجاباتك للمعلم بنجاح!', data: res });
      if (!completed) {
        await api.post('/student/progress/lessons', {
          gradeId: book?.gradeId,
          subjectId: book?.subjectId,
          lessonId,
          lessonTitle: lesson.title
        });
      }
    } catch (e) {
      setSubmitResult({ success: false, message: e.message || 'فشل الإرسال، حاول مرة أخرى' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lesson-page">
      <div className="lesson-page-head">
        <div className="lesson-page-meta">
          <span className="lesson-page-num">{index + 1} / {total}</span>
          {lesson.domain && <span className="badge">{lesson.domain}</span>}
          {lesson.letter && <span className="badge accent">حرف {lesson.letter}</span>}
          {completed && <span className="badge ok">مُنجز ✓</span>}
          {(() => {
            const tp = (lesson.blocks || []).reduce((s, b) => s + ((b.points && TASK_KINDS.includes(b.kind)) ? b.points : 0), 0);
            return tp > 0 ? <span className="badge accent">المجموع: {tp} ن.ن</span> : null;
          })()}
        </div>
        <div className="lesson-page-actions">
          {!completed && (
            <button type="button" className="btn btn-success btn-sm" onClick={onComplete}>
              <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
              أنهيت الدرس
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={submitting}
            title="أرسل إجاباتك للمعلم"
          >
            <span className="material-icons" style={{ fontSize: 18 }}>send</span>
            {submitting ? 'جاري الإرسال...' : 'أرسل للمعلم'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNav(index - 1)} disabled={index <= 0}>
            <span className="material-icons" style={{ fontSize: 18 }}>chevron_right</span>
            السابق
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNav(index + 1)} disabled={index >= total - 1}>
            التالي
            <span className="material-icons" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
        </div>
      </div>

      <h2 className="lesson-page-title">{lesson.title}</h2>
      {lesson.image && (
        <div className="lesson-page-image">
          <img src={lesson.image} alt={lesson.title} loading="lazy" />
        </div>
      )}

      {lessonVideos.length > 0 && (
        <div className="lesson-linked-videos">
          <h4>
            <span className="material-icons" style={{ fontSize: 18 }}>smart_display</span>
            فيديو قصير لهذا الدرس
          </h4>
          <VideoCard video={lessonVideos[0]} />
        </div>
      )}

      {/* Assessment Paper View vs Normal Lesson View */}
      {((lesson.isAssessment) || /^y\d+a\d+$/.test(lesson.id)) ? (
        <AssessmentPaper
          lesson={lesson}
          answers={answers}
          onAnswer={handleAnswer}
          submitting={submitting}
          submitResult={submitResult}
          onSubmit={handleSubmit}
        />
      ) : (
        <>
          <div className="lesson-blocks lesson-sheet">
            {(() => {
              const blocks = lesson.blocks || [];
              const SOURCE = ['objective','concept','vocabulary','experiment'];
              const RULE = ['summary'];
              const isSrc = (b) => SOURCE.includes(b.kind);
              const isRule = (b) => RULE.includes(b.kind);
              const isEx = (b) => !isSrc(b) && !isRule(b);
              const src = blocks.filter(isSrc);
              const ex = blocks.filter(isEx);
              const rule = blocks.filter(isRule);
              return (<>
                {src.length > 0 && (
                  <div className="lesson-source">
                    {src.map((b, i) => <Block key={'s' + i} block={b} onAnswer={handleAnswer} blockId={`${lesson.id}-s${i}`} />)}
                  </div>
                )}
                {ex.map((b, i) => (
                  <div key={i} className="lesson-sheet-item">
                    <span className="lesson-sheet-num">{i + 1}</span>
                    <div className="lesson-sheet-body">
                      <Block block={b} onAnswer={handleAnswer} blockId={`${lesson.id}-${i}`} />
                    </div>
                  </div>
                ))}
                {rule.length > 0 && (
                  <div className="lesson-rule">
                    {rule.map((b, i) => <Block key={'r' + i} block={b} onAnswer={handleAnswer} blockId={`${lesson.id}-r${i}`} />)}
                  </div>
                )}
              </>);
            })()}
          </div>

          {/* Submit to Teacher Section */}
          <div className="lesson-submit-section">
            <div className="submit-divider">
              <span className="material-icons">assignment_turned_in</span>
              <span>إرسال الواجب للمعلم</span>
            </div>
            <p className="submit-hint">سيتم إرسال جميع إجاباتك (النصوص، العمليات الحسابية، الرسومات، والملفات) للمعلم للتصحيح.</p>
            <button
              type="button"
              className="btn btn-success btn-lg submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ fontSize: 18, marginLeft: 8 }}></span>
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <span className="material-icons" style={{ fontSize: 20, marginLeft: 8 }}>send</span>
                  أرسل للمعلم
                </>
              )}
            </button>
            {submitResult && (
              <div className={`submit-result ${submitResult.success ? 'success' : 'error'}`}>
                <span className="material-icons">{submitResult.success ? 'check_circle' : 'error'}</span>
                {submitResult.message}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LessonViewer({ book, onClose }) {
  const [tab, setTab] = useState('lessons');
  const [full, setFull] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [videos, setVideos] = useState([]);
  const [active, setActive] = useState(0);
  const [playVideo, setPlayVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doneIds, setDoneIds] = useState(new Set());
  const [completion, setCompletion] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/student/progress/lessons')
      .then((data) => {
        if (!alive) return;
        const ids = new Set(
          (data.lessons || []).filter((l) => l.lessonId).map((l) => l.lessonId)
        );
        setDoneIds(ids);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const base = `/public/curriculum/books/${book.gradeId}/${book.subjectId}`;
    const url = tab === 'lessons'
      ? `${base}/lessons`
      : tab === 'exercises'
        ? `${base}/exercises`
        : `${base}/videos`;
    api
      .get(url)
      .then((data) => {
        if (!alive) return;
        if (tab === 'lessons') {
          setLessons(Array.isArray(data) ? data : []);
          setActive(0);
        } else if (tab === 'exercises') {
          setExercises(Array.isArray(data) ? data : []);
        } else {
          setVideos(Array.isArray(data) ? data : []);
        }
      })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [book.gradeId, book.subjectId, tab]);

  const go = (i) => setActive(Math.max(0, Math.min(lessons.length - 1, i)));

  const completeCurrent = async () => {
    const lesson = lessons[active];
    if (!lesson) return;
    setCompletion(null);
    try {
      const res = await api.post('/student/progress/lessons', {
        gradeId: book.gradeId,
        subjectId: book.subjectId,
        lessonId: lesson.id,
        lessonTitle: lesson.title
      });
      setDoneIds((ids) => new Set(ids).add(lesson.id));
      if (!res.alreadyDone) {
        setCompletion({
          title: lesson.title,
          xp: res.xpAwarded,
          badges: res.newBadges || []
        });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const currentLesson = lessons[active];
  const lessonVideos = videos.filter(
    (v) => v.lessonId === currentLesson?.id || v.unitId === currentLesson?.unitId
  );

  return (
    <div className={`modal-overlay${full ? ' cahier-overlay' : ''}`} onClick={onClose}>
      <div className={`modal lesson-viewer-modal${full ? ' cahier-full' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>الدروس التفاعلية — {book.title}</h3>
            <p className="viewer-sub">{book.grade} — {book.subject}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFull((v) => !v)}
              title={full ? 'تصغير' : 'ملء الشاشة'}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>{full ? 'fullscreen_exit' : 'fullscreen'}</span>
              {full ? 'تصغير' : 'ملء الشاشة'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>إغلاق</button>
          </div>
        </div>

        <div className="lesson-viewer-tabs">
          <button type="button" className={tab === 'lessons' ? 'active' : ''} onClick={() => setTab('lessons')}>
            <span className="material-icons" style={{ fontSize: 16 }}>menu_book</span>
            {book.paperOnly ? 'المواقف' : 'الدروس'}
          </button>
          {!book.paperOnly && (
            <button type="button" className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
              <span className="material-icons" style={{ fontSize: 16 }}>edit_note</span>
              تمارين تفاعلية
              {!loading && tab !== 'lessons' && <span className="subject-count">{exercises.length} تمرين</span>}
            </button>
          )}
          {!book.paperOnly && (
            <button type="button" className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>
              <span className="material-icons" style={{ fontSize: 16 }}>smart_display</span>
              فيديوهات
              {!loading && tab !== 'lessons' && <span className="subject-count">{videos.length} فيديو</span>}
            </button>
          )}
        </div>

        {error && <div className="form-error" style={{ margin: '1rem' }}>{error}</div>}

        {loading ? (
          <div className="loading-wrap"><span className="spinner" /></div>
        ) : tab === 'lessons' && lessons.length === 0 ? (
          <div className="viewer-noimg">
            <span className="material-icons" style={{ fontSize: '3rem', color: 'var(--muted)' }}>auto_stories</span>
            <p>لا تتوفّر دروس تفاعلية لهذا الكتاب بعد.</p>
          </div>
        ) : tab === 'lessons' ? (
          <div className="lesson-viewer-body">
            <aside className="lesson-toc">
              <h4>دروس الكتاب</h4>
              <ul>
                {lessons.map((l, i) => (
                  <li key={l.id || i} className={`${i === active ? 'active' : ''} ${l.period ? 'period-' + l.period : ''}`}>
                    <button type="button" onClick={() => go(i)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {l.image && (
                        <img
                          src={l.image}
                          alt=""
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <span className="toc-num">{i + 1}</span>
                      <span className="toc-title">{l.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <section className="lesson-stage">
              <LessonPage lesson={currentLesson} index={active} total={lessons.length} onNav={go} lessonVideos={lessonVideos} completed={doneIds.has(currentLesson?.id)} onComplete={completeCurrent} book={book} />
            </section>
          </div>
        ) : tab === 'exercises' && exercises.length === 0 ? (
          <div className="viewer-noimg">
            <span className="material-icons" style={{ fontSize: '3rem', color: 'var(--muted)' }}>edit_note</span>
            <p>لا تتوفّر تمارين تفاعلية لهذا الكتاب بعد.</p>
          </div>
        ) : tab === 'exercises' ? (
          <div className="lesson-exercise-bank">
            {exercises.map((ex, i) => (
              <ExerciseCard key={ex.id || i} exercise={ex} index={i} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="viewer-noimg">
            <span className="material-icons" style={{ fontSize: '3rem', color: 'var(--muted)' }}>smart_display</span>
            <p>لا تتوفّر فيديوهات قصيرة لهذا الكتاب بعد — ستُضاف قريباً من مصادر رسمية معتمدة.</p>
          </div>
        ) : (
          <div className="lesson-video-bank">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onPlay={() => setPlayVideo(v)} />
            ))}
          </div>
        )}

        {playVideo && (
          <div className="modal-overlay" onClick={() => setPlayVideo(null)}>
            <div className="modal video-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <h3>{playVideo.title}</h3>
                  {playVideo.source && <p className="viewer-sub">{playVideo.source}</p>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setPlayVideo(null)}>إغلاق</button>
              </div>
              <div className="video-modal-body">
                <VideoPlayer video={playVideo} />
              </div>
            </div>
          </div>
        )}

        {completion && (
          <div className="completion-toast">
            <div className="completion-toast-head">
              <span className="material-icons" style={{ fontSize: 22 }}>emoji_events</span>
              <strong>أحسنت! أنهيت درس «{completion.title}»</strong>
            </div>
            <p className="muted">+{completion.xp} نقطة خبرة</p>
            {completion.badges.length > 0 && (
              <div className="new-badges">
                <h4>شارات جديدة!</h4>
                {completion.badges.map((b) => (
                  <span key={b.id} className="badge-chip">{b.icon} {b.name}</span>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setCompletion(null)}>متابعة</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, index }) {
  return (
    <div className="lesson-exercise-card">
      <div className="lesson-exercise-head">
        <span className="toc-num">{index + 1}</span>
        <strong>{exercise.title}</strong>
      </div>
      {exercise.passage && exercise.passage.text && (
        <p className="lesson-exercise-passage">{exercise.passage.text}</p>
      )}
      <div className="lesson-blocks">
        {(exercise.questions || []).map((q, i) => <Block key={i} block={q} />)}
      </div>
    </div>
  );
}

export default LessonViewer;