import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/client.js';
import VideoPlayer from './VideoPlayer.jsx';
import VideoCard from './VideoCard.jsx';
import LessonIllustration from './LessonIllustration.jsx';
import NotebookPaper from './NotebookPaper.jsx';

function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar';
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

const BLOCK_ICONS = {
  objective: 'track_changes',
  concept: 'lightbulb',
  definition: 'menu_book',
  example: 'fact_check',
  note: 'info',
  keyword: 'translate',
  question: 'quiz',
  experiment: 'science',
  summary: 'checklist',
  reward: 'emoji_events'
};

function MarkQuestion({ block }) {
  const [marks, setMarks] = useState(() => new Set());
  const [checked, setChecked] = useState(false);
  const items = block.items || [];
  const correctIndexes = items.map((it, i) => (it.correct ? i : -1)).filter((i) => i >= 0);
  const allCorrect = correctIndexes.length > 0
    && marks.size === correctIndexes.length
    && correctIndexes.every((i) => marks.has(i));
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">check_box</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <div className="lesson-mark-list">
        {items.map((it, i) => {
          const marked = marks.has(i);
          let cls = 'mark-row';
          if (checked) cls += it.correct ? ' mark-ok' : marked ? ' mark-no' : '';
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={checked}
              onClick={() => {
                setMarks((prev) => {
                  const n = new Set(prev);
                  if (n.has(i)) n.delete(i); else n.add(i);
                  return n;
                });
                setChecked(false);
              }}
            >
              <span className="mark-box">{(marked || (checked && it.correct)) ? '✗' : ''}</span>
              <span className="mark-text">{it.text}</span>
            </button>
          );
        })}
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" disabled={marks.size === 0} onClick={() => setChecked(true)}>
          تحقّق
        </button>
        {checked && (
          <span className={`exercise-feedback ${allCorrect ? 'ok' : 'no'}`}>
            {allCorrect ? '✓ صحيح' : '✗ حاول مرة أخرى'}
          </span>
        )}
        {checked && !allCorrect && (
          <span className="exercise-answer">الإجابة: {correctIndexes.map((i) => items[i].text).join(' — ')}</span>
        )}
      </div>
    </div>
  );
}

function MatchQuestion({ block }) {
  const left = useMemo(() => block.left || [], [block.left]);
  const right = useMemo(() => block.right || [], [block.right]);
  const [selLeft, setSelLeft] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [checked, setChecked] = useState(false);
  const wrapRef = useRef(null);
  const leftRefs = useRef([]);
  const rightRefs = useRef({});
  const [lines, setLines] = useState([]);
  const order = useMemo(() => {
    let h = 0;
    for (const c of block.title || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const arr = right.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = (h + i * 7) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [block.title, right]);
  const allMatched = pairs.length === left.length && pairs.every((p) => p.l === p.r);
  const clickRight = (r) => {
    if (checked || selLeft == null) return;
    setPairs((prev) => [...prev.filter((p) => p.r !== r), { l: selLeft, r }]);
    setSelLeft(null);
  };
  useEffect(() => {
    const update = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const newLines = pairs.map((p) => {
        const a = leftRefs.current[p.l];
        const b = rightRefs.current[p.r];
        if (!a || !b) return null;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        // نقطتان: نهاية الجملة الأولى (يسار الزر الأيسر) إلى بداية الجملة الثانية (يمين الزر الأيمن) - RTL
        const x1 = ra.left - rect.left + 6;
        const y1 = ra.top - rect.top + ra.height / 2;
        const x2 = rb.right - rect.left - 6;
        const y2 = rb.top - rect.top + rb.height / 2;
        return { x1, y1, x2, y2, ok: p.l === p.r };
      }).filter(Boolean);
      setLines(newLines);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pairs, left, right, order]);
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">link</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <div className="lesson-match-wrapper" ref={wrapRef}>
        <div className="lesson-match-cols">
          <div className="lesson-match-col">
            {left.map((l, i) => {
              const isImg = typeof l === 'object' && l.img;
              const label = isImg ? l.text : l;
              const img = isImg ? l.img : null;
              return (
                <button
                  key={i}
                  ref={(el) => { leftRefs.current[i] = el; }}
                  type="button"
                  className={`match-item ${selLeft === i ? 'selected' : ''} ${pairs.some((p) => p.l === i) ? 'used' : ''}`}
                  onClick={() => { if (!checked) setSelLeft(selLeft === i ? null : i); }}
                >
                  {img && <img src={img} alt={label} style={{ width: '100%', maxHeight: '80px', objectFit: 'contain', borderRadius: '6px', marginBottom: '4px' }} />}
                  {label}
                  <span className="match-dot" />
                </button>
              );
            })}
          </div>
          <div className="lesson-match-col">
            {order.map((r) => {
              const l = pairs.find((p) => p.r === r)?.l;
              const ok = checked && l != null && l === r;
              const no = checked && l != null && l !== r;
              return (
                <button
                  key={r}
                  ref={(el) => { rightRefs.current[r] = el; }}
                  type="button"
                  className={`match-item ${l != null ? 'used' : ''} ${ok ? 'ok' : ''} ${no ? 'no' : ''}`}
                  onClick={() => clickRight(r)}
                >
                  <span className="match-dot" />
                  {right[r]}
                </button>
              );
            })}
          </div>
        </div>
        <svg className="match-svg" width="100%" height="100%">
          {lines.map((ln, i) => (
            <g key={i}>
              <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={ln.ok || !checked ? '#2563eb' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={ln.x1} cy={ln.y1} r="5" fill={ln.ok || !checked ? '#2563eb' : '#ef4444'} stroke="#fff" strokeWidth="2" />
              <circle cx={ln.x2} cy={ln.y2} r="5" fill={ln.ok || !checked ? '#2563eb' : '#ef4444'} stroke="#fff" strokeWidth="2" />
            </g>
          ))}
        </svg>
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" disabled={pairs.length === 0} onClick={() => setChecked(true)}>
          تحقّق
        </button>
        {checked && (
          <span className={`exercise-feedback ${allMatched ? 'ok' : 'no'}`}>
            {allMatched ? '✓ صحيح' : '✗ حاول مرة أخرى'}
          </span>
        )}
        {checked && !allMatched && (
          <span className="exercise-answer">
            الإجابة: {left.map((l, i) => `${l} ← ${right[i]}`).join(' — ')}
          </span>
        )}
      </div>
    </div>
  );
}

function ImgChoiceQuestion({ block }) {
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const hasAnswer = block.answer !== undefined && block.answer !== null;
  const correct = sel != null && hasAnswer && sel === Number(block.answer);
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">image_search</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <div className="img-choice-grid">
        {(block.options || []).map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`img-choice-card ${sel === i ? 'selected' : ''} ${checked && hasAnswer ? (i === Number(block.answer) ? 'ok' : sel === i ? 'no' : '') : ''}`}
            onClick={() => { setSel(i); setChecked(false); }}
          >
            {opt.img ? <img src={opt.img} alt={opt.caption || ''} loading="lazy" />
              : opt.emoji ? <span className="img-choice-emoji">{opt.emoji}</span>
                : <span className="img-choice-text">{opt.caption}</span>}
            {opt.caption && <span className="img-choice-caption">{opt.caption}</span>}
          </button>
        ))}
      </div>
      <div className="exercise-check-row">
        {hasAnswer && (
          <button type="button" className="btn btn-sm" disabled={sel == null} onClick={() => setChecked(true)}>تحقّق</button>
        )}
        {checked && hasAnswer && (
          <span className={`exercise-feedback ${correct ? 'ok' : 'no'}`}>{correct ? '✓ صحيح' : '✗ خاطئ'}</span>
        )}
        {checked && hasAnswer && (
          <span className="exercise-answer">الإجابة: {(block.options[Number(block.answer)] || {}).caption || ''}</span>
        )}
      </div>
    </div>
  );
}

function VerticalAddition({ a, b }) {
  return (
    <div className="vertical-addition-wrap">
      <div>
        <div className="vertical-addition-hint">أفقي:</div>
        <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{a} + {b} = ?</div>
      </div>
      <div className="vertical-addition">
        <div className="va-row"><span className="va-num" style={{ minWidth: '60px', textAlign: 'right' }}>{a}</span></div>
        <div className="va-row"><span className="va-plus">+</span><span className="va-num">{b}</span></div>
        <hr className="va-line" />
        <div className="va-answer">اكتب النتيجة هنا</div>
      </div>
    </div>
  );
}

function NumberWriteQuestion({ block, count }) {
  const [val, setVal] = useState('');
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hasAnswer = block.answer !== undefined && block.answer !== null;
  const ok = hasAnswer && String(val).trim() === String(block.answer);
  const useNotebook = !!block.useNotebook;
  const addMatch = block.text && block.text.match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  const isVertical = !!addMatch && (block.text.includes('عمودي') || block.text.includes('الوضع العمودي') || !!addMatch);

  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">{count ? 'pin' : 'edit'}</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      {block.img && (
        <div className="lesson-count-img">
          <img src={block.img} alt={block.title} loading="lazy" />
        </div>
      )}
      {isVertical && addMatch && (
        <VerticalAddition a={addMatch[1]} b={addMatch[2]} />
      )}
      {useNotebook && (
        <NotebookPaper hint={block.notebookHint || 'اكتب إجابتك هنا بيدك ✏️'} onSave={() => {}} />
      )}
      <div className="lesson-write-row">
      {block.input === 'textarea' ? (
        <textarea
          className="write-textarea"
          rows={4}
          value={val}
          placeholder="أكتب هنا..."
          onChange={(e) => { setVal(e.target.value); setChecked(false); }}
        />
      ) : (
        <input
          type={block.input === 'text' ? 'text' : 'number'}
          className={`write-input ${block.input === 'text' ? 'write-input-text' : ''}`}
          value={val}
          disabled={checked}
          placeholder={block.input === 'text' ? 'أكتب هنا...' : ''}
          onChange={(e) => { setVal(e.target.value); setChecked(false); }}
        />
      )}
        {hasAnswer && (
          <button type="button" className="btn btn-sm" disabled={!val} onClick={() => setChecked(true)}>تحقّق</button>
        )}
        {!hasAnswer && block.answerHint && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowHint((v) => !v)}>
            {showHint ? 'إخفاء التلميح' : 'تلميح'}
          </button>
        )}
        {showHint && block.answerHint && <span className="exercise-answer">تلميح: {block.answerHint}</span>}
        {checked && hasAnswer && (
          <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>{ok ? '✓ صحيح' : '✗ خاطئ'}</span>
        )}
        {checked && hasAnswer && <span className="exercise-answer">الإجابة: {block.answer}</span>}
      </div>
    </div>
  );
}

function ClickImageQuestion({ block }) {
  const [marks, setMarks] = useState([]);
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">pan_tool_alt</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      {block.img && (
        <div
          className="lesson-click-img"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMarks((prev) => [...prev, { x: e.clientX - r.left, y: e.clientY - r.top }]);
          }}
        >
          <img src={block.img} alt={block.title} draggable={false} loading="lazy" />
          {marks.map((m, i) => (
            <span key={i} className="click-x" style={{ left: m.x, top: m.y }}>✗</span>
          ))}
        </div>
      )}
      <div className="exercise-check-row">
        {marks.length > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMarks([])}>مسح العلامات</button>
        )}
      </div>
    </div>
  );
}

function OrderQuestion({ block }) {
  const [seq, setSeq] = useState([]);
  const [checked, setChecked] = useState(false);
  const items = block.items || [];
  const answer = block.answer || [];
  const ok = seq.length === items.length && seq.every((idx, pos) => idx === answer[pos]);
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">sort</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <p className="order-hint">اضغط على العناصر بالترتيب الصحيح (1، 2، 3...)</p>
      <div className="lesson-order-items">
        {items.map((it, i) => {
          const pos = seq.indexOf(i);
          return (
            <button
              key={i}
              type="button"
              className={`order-item ${pos >= 0 ? 'ordered' : ''} ${checked ? (answer.indexOf(i) === seq.indexOf(i) ? 'ok' : 'no') : ''}`}
              onClick={() => {
                if (checked) return;
                setSeq((prev) => {
                  const n = prev.filter((x) => x !== i);
                  return pos >= 0 ? n : [...n, i];
                });
                setChecked(false);
              }}
            >
              <span className="order-num">{pos >= 0 ? pos + 1 : ''}</span>
              <span className="order-text">{it}</span>
            </button>
          );
        })}
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" disabled={seq.length !== items.length} onClick={() => setChecked(true)}>تحقّق</button>
        {checked && (
          <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>{ok ? '✓ صحيح' : '✗ حاول مرة أخرى'}</span>
        )}
        {checked && !ok && <span className="exercise-answer">الإجابة: {answer.map((idx) => items[idx]).join(' ← ')}</span>}
      </div>
    </div>
  );
}

function FillQuestion({ block }) {
  const rows = block.rows || [];
  const [vals, setVals] = useState(() => rows.map(() => ''));
  const [checked, setChecked] = useState(false);
  const ok = rows.every((r, i) => r.answer.every((a, j) => String(vals[i].split(',')[j] || '').trim() === String(a)));
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">table_chart</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <div className="lesson-fill-table">
        {rows.map((r, i) => (
          <div key={i} className="fill-row">
            <span className="fill-label">{r.label}</span>
            {r.answer.map((a, j) => (
              <input
                key={j}
                type={/^\d+$/.test(String(a)) ? 'number' : 'text'}
                className="write-input fill-input"
                value={vals[i].split(',')[j] || ''}
                disabled={checked}
                onChange={(e) => {
                  const parts = vals[i].split(',');
                  parts[j] = e.target.value;
                  setVals((prev) => prev.map((v, k) => (k === i ? parts.join(',') : v)));
                  setChecked(false);
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" disabled={vals.some((v) => !v)} onClick={() => setChecked(true)}>تحقّق</button>
        {checked && (
          <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>{ok ? '✓ صحيح' : '✗ حاول مرة أخرى'}</span>
        )}
        {checked && !ok && (
          <span className="exercise-answer">الإجابة: {rows.map((r) => `${r.label}: ${r.answer.join('، ')}`).join(' — ')}</span>
        )}
      </div>
    </div>
  );
}

function MultiQuestion({ block }) {
  const [sel, setSel] = useState(() => new Set());
  const [checked, setChecked] = useState(false);
  const items = block.items || [];
  const answers = block.answer || [];
  const ok = sel.size === answers.length && answers.every((i) => sel.has(i));
  return (
    <div className="lesson-block lesson-block-question">
      <div className="lesson-block-head">
        <span className="material-icons">checklist</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <div className="lesson-mark-list">
        {items.map((it, i) => {
          const marked = sel.has(i);
          let cls = 'mark-row';
          if (checked) cls += answers.includes(i) ? ' mark-ok' : marked ? ' mark-no' : '';
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={checked}
              onClick={() => {
                setSel((prev) => {
                  const n = new Set(prev);
                  if (n.has(i)) n.delete(i); else n.add(i);
                  return n;
                });
                setChecked(false);
              }}
            >
              <span className="mark-box">{marked ? '✗' : ''}</span>
              <span className="mark-text">{it}</span>
            </button>
          );
        })}
      </div>
      <div className="exercise-check-row">
        <button type="button" className="btn btn-sm" disabled={sel.size === 0} onClick={() => setChecked(true)}>تحقّق</button>
        {checked && (
          <span className={`exercise-feedback ${ok ? 'ok' : 'no'}`}>{ok ? '✓ صحيح' : '✗ حاول مرة أخرى'}</span>
        )}
        {checked && !ok && (
          <span className="exercise-answer">الإجابة: {answers.map((i) => items[i]).join(' — ')}</span>
        )}
      </div>
    </div>
  );
}

function DragBallQuestion({ block }) {
  const posMatch = block.text.match(/«([^»]+)»/);
  const pos = posMatch ? posMatch[1] : 'وراء';
  const [ballPos, setBallPos] = useState({ x: 50, y: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [feedback, setFeedback] = useState('');
  const containerRef = useRef(null);
  const getPos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e) => { e.preventDefault(); setIsDragging(true); };
  const move = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    setBallPos({ x: Math.max(15, Math.min(285, x)), y: Math.max(15, Math.min(155, y)) });
  };
  const end = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Check if dropped near correct zone for pos
    // For وراء: top area behind box (y < 50, x 110-190)
    // For فوق: above box, etc. - simplified: check if near box center
    const boxCenter = { x: 150, y: 70 };
    const dist = Math.hypot(ballPos.x - boxCenter.x, ballPos.y - boxCenter.y);
    // For demo, any drop near box is considered correct for وراء/فوق etc. - check distance
    let correct = false;
    if (pos.includes('وراء')) correct = ballPos.y < 50 && ballPos.x > 100 && ballPos.x < 200;
    else if (pos.includes('فوق')) correct = ballPos.y < 40;
    else if (pos.includes('تحت')) correct = ballPos.y > 110;
    else if (pos.includes('يمين')) correct = ballPos.x > 200;
    else if (pos.includes('يسار')) correct = ballPos.x < 100;
    else if (pos.includes('داخل')) correct = ballPos.x > 110 && ballPos.x < 190 && ballPos.y > 60 && ballPos.y < 100;
    else if (pos.includes('بجانب')) correct = (ballPos.x < 90 || ballPos.x > 210) && ballPos.y > 50 && ballPos.y < 110;
    else correct = dist < 60;
    if (correct) { setDropped(true); setFeedback('✓ أحسنت! وضعتها في المكان الصحيح'); }
    else { setFeedback('حاول مرة أخرى - اسحبها إلى المكان «' + pos + '»'); }
  };
  return (
    <div className="lesson-block lesson-block-question lesson-block-activity">
      <div className="lesson-block-head">
        <span className="material-icons">pan_tool_alt</span>
        <strong>{block.title || 'سؤال'}</strong>
      </div>
      <p className="lesson-block-text">{block.text}</p>
      <div
        ref={containerRef}
        className="drag-ball-container"
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchMove={move}
        onTouchEnd={end}
        style={{ position: 'relative', width: '100%', height: '200px', background: '#fef3c7', borderRadius: '12px', border: '2px solid #fbbf24', overflow: 'hidden', touchAction: 'none' }}
      >
        {/* Box */}
        <div style={{ position: 'absolute', left: '110px', top: '60px', width: '80px', height: '60px', background: '#92400e', borderRadius: '4px', border: '3px solid #78350f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '12px' }}>صندوق</div>
        {/* Drop zone hint */}
        <div style={{ position: 'absolute', left: '50%', top: '8px', transform: 'translateX(-50%)', fontSize: '11px', color: '#92400e', background: '#fff', padding: '2px 6px', borderRadius: '10px', border: '1px dashed #f59e0b' }}>«{pos}» هنا</div>
        {/* Ball */}
        <div
          onMouseDown={start}
          onTouchStart={start}
          style={{ position: 'absolute', left: `${ballPos.x - 15}px`, top: `${ballPos.y - 15}px`, width: '30px', height: '30px', borderRadius: '50%', background: dropped ? '#22c55e' : '#ef4444', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', transition: isDragging ? 'none' : 'left 0.2s, top 0.2s' }}
        >
          ●
        </div>
      </div>
      {feedback && <div className={`exercise-feedback ${dropped ? 'ok' : 'no'}`} style={{ marginTop: '0.6rem' }}>{feedback}</div>}
      {dropped && <NotebookPaper hint="ارسم هنا ما تعلمته ✏️" height={120} />}
    </div>
  );
}

function ActivityCard({ block }) {
  if (block.text && block.text.includes('اسحب الكرة')) {
    return <DragBallQuestion block={block} />;
  }
  return (
    <div className="lesson-block lesson-block-question lesson-block-activity">
      <div className="lesson-block-head">
        <span className="material-icons">brush</span>
        <strong>{block.title || 'نشاط'}</strong>
      </div>
      <p className="lesson-block-text">{block.text}</p>
      <NotebookPaper hint="ارسم هنا بيدك ✏️" height={180} />
    </div>
  );
}

function Block({ block }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const kind = block.kind || 'concept';
  const icon = BLOCK_ICONS[kind] || 'article';

  if (kind === 'question') {
    if (block.type === 'mark') return <MarkQuestion block={block} />;
    if (block.type === 'match' || block.type === 'M') return <MatchQuestion block={block} />;
    if (block.type === 'g' || block.type === 'imgchoice') return <ImgChoiceQuestion block={block} />;
    if (block.type === 'c' || block.type === 'count') return <NumberWriteQuestion block={block} count />;
    if (block.type === 'w' || block.type === 'write') return <NumberWriteQuestion block={block} />;
    if (block.type === 'k' || block.type === 'click') return <ClickImageQuestion block={block} />;
    if (block.type === 'o' || block.type === 'order') return <OrderQuestion block={block} />;
    if (block.type === 'f' || block.type === 'fill') return <FillQuestion block={block} />;
    if (block.type === 'u' || block.type === 'multi') return <MultiQuestion block={block} />;
    if (block.type === 'a' || block.type === 'activity') return <ActivityCard block={block} />;
    const isMCQ = block.options && block.options.length > 0;
    const hasAnswer = block.answer !== undefined && block.answer !== null;
    const answerIndex = hasAnswer && typeof block.answer === 'number'
      ? Number(block.answer)
      : Array.isArray(block.options)
        ? block.options.findIndex((o) => String(o) === String(block.answer))
        : -1;
    const correct = sel != null && hasAnswer && sel === answerIndex;
    return (
      <div className="lesson-block lesson-block-question">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'سؤال'}</strong>
          {block.text && block.text !== block.title && <p>{block.text}</p>}
        </div>
        {isMCQ ? (
          <>
            {block.img && (
              <div className="lesson-count-img">
                <img src={block.img} alt={block.title} loading="lazy" />
              </div>
            )}
            <div className="question-easy-options">
              {block.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn btn-outline btn-option ${sel === i ? 'selected' : ''} ${checked && hasAnswer && (i === sel ? (correct ? 'ok' : 'no') : i === answerIndex ? 'ok' : '')}`}
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
              {checked && hasAnswer && <span className="exercise-answer">الإجابة: {block.options[answerIndex]}</span>}
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

  if (kind === 'experiment') {
    return (
      <div className="lesson-block lesson-block-experiment">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'جرّب بنفسك'}</strong>
        </div>
        {block.text && <p className="lesson-block-text">{block.text}</p>}
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

  if (kind === 'summary') {
    return (
      <div className="lesson-block lesson-block-summary">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'خلاصة الوحدة'}</strong>
        </div>
        <ul className="lesson-summary-list">
          {(block.points || []).map((pt, i) => <li key={i}>{pt}</li>)}
        </ul>
      </div>
    );
  }

  if (kind === 'reward') {
    return (
      <div className="lesson-block lesson-block-reward">
        <span className="material-icons">{icon}</span>
        <p className="lesson-block-text">{block.text || 'أحسنت!'}</p>
      </div>
    );
  }

  return (
    <div className={`lesson-block lesson-block-${kind}`}>
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || (kind === 'objective' ? 'الأهداف' : '')}</strong>
      </div>
      {block.text && block.text !== block.title && <p className="lesson-block-text">{block.text}</p>}
    </div>
  );
}

function LessonPage({ lesson, index, total, onNav, lessonVideos, completed, onComplete }) {
  const readAloud = () => {
    const parts = [lesson.title, ...(lesson.blocks || []).map((b) => b.text || '').filter(Boolean)];
    speak(parts.join('. '));
  };
  const headerBlocks = useMemo(() => (lesson.blocks || []).filter((b) => b.kind !== 'question' && b.kind !== 'keyword'), [lesson.blocks]);
  const questionBlocks = useMemo(() => (lesson.blocks || []).filter((b) => b.kind === 'question'), [lesson.blocks]);
  const [qIndex, setQIndex] = useState(0);
  useEffect(() => { setQIndex(0); }, [lesson.id]);

  return (
    <div className="lesson-page">
      <div className="lesson-page-head">
        <div className="lesson-page-meta">
          <span className="lesson-page-num">{index + 1} / {total}</span>
          {lesson.domain && <span className="badge">{lesson.domain}</span>}
          {lesson.letter && <span className="badge accent">حرف {lesson.letter}</span>}
          {completed && <span className="badge ok">مُنجز ✓</span>}
        </div>
        <div className="lesson-page-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={readAloud} title="قراءة صوتية">
            <span className="material-icons" style={{ fontSize: 18 }}>volume_up</span>
            استمع
          </button>
          {!completed && (
            <button type="button" className="btn btn-success btn-sm" onClick={onComplete}>
              <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
              أنهيت الدرس
            </button>
          )}
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
      {(lesson.images?.length > 1 ? lesson.images : lesson.image ? [lesson.image] : []).map((src, i) => (
        <div className="lesson-page-image" key={i}>
          <img src={src} alt={`${lesson.title} ${i + 1}`} loading="lazy" />
        </div>
      ))}
      {!lesson.image && !(lesson.images?.length > 1) && <LessonIllustration lesson={lesson} />}

      {lessonVideos.length > 0 && (
        <div className="lesson-linked-videos">
          <h4>
            <span className="material-icons" style={{ fontSize: 18 }}>smart_display</span>
            فيديو قصير لهذا الدرس
          </h4>
          <VideoCard video={lessonVideos[0]} />
        </div>
      )}

      <div className="lesson-blocks">
        {headerBlocks.map((b, i) => <Block key={`h-${i}`} block={b} />)}
        {questionBlocks.length > 0 && (
          <div className="lesson-question-pager">
            <div className="question-pager-head">
              <span className="badge">سؤال {qIndex + 1} / {questionBlocks.length}</span>
              <div className="pager-actions">
                <button type="button" className="btn btn-ghost btn-sm" disabled={qIndex <= 0} onClick={() => setQIndex((v) => Math.max(0, v - 1))}>السابق</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={qIndex >= questionBlocks.length - 1} onClick={() => setQIndex((v) => Math.min(questionBlocks.length - 1, v + 1))}>التالي</button>
              </div>
            </div>
            <Block key={`q-${qIndex}`} block={questionBlocks[qIndex]} />
            <div className="question-dots">
              {questionBlocks.map((_, i) => (
                <button key={i} type="button" className={`dot ${i === qIndex ? 'active' : ''}`} onClick={() => setQIndex(i)} aria-label={`سؤال ${i + 1}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonViewer({ book, onClose }) {
  const [tab, setTab] = useState('lessons');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal lesson-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>الدروس التفاعلية — {book.title}</h3>
            <p className="viewer-sub">{book.grade} — {book.subject}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>إغلاق</button>
        </div>

        <div className="lesson-viewer-tabs">
          <button type="button" className={tab === 'lessons' ? 'active' : ''} onClick={() => setTab('lessons')}>
            <span className="material-icons" style={{ fontSize: 16 }}>menu_book</span>
            الدروس
          </button>
          <button type="button" className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
            <span className="material-icons" style={{ fontSize: 16 }}>edit_note</span>
            تمارين تفاعلية
            {!loading && tab !== 'lessons' && <span className="subject-count">{exercises.length} تمرين</span>}
          </button>
          <button type="button" className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>
            <span className="material-icons" style={{ fontSize: 16 }}>smart_display</span>
            فيديوهات
            {!loading && tab !== 'lessons' && <span className="subject-count">{videos.length} فيديو</span>}
          </button>
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
                  <li key={l.id || i} className={i === active ? 'active' : ''}>
                    <button type="button" onClick={() => go(i)}>
                      <span className="toc-num">{i + 1}</span>
                      <span className="toc-title">{l.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            <section className="lesson-stage">
              <LessonPage lesson={currentLesson} index={active} total={lessons.length} onNav={go} lessonVideos={lessonVideos} completed={doneIds.has(currentLesson?.id)} onComplete={completeCurrent} />
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
