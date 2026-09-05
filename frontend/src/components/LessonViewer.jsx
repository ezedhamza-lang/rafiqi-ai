import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import VideoPlayer from './VideoPlayer.jsx';
import VideoCard from './VideoCard.jsx';

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
  reward: 'emoji_events',
  textarea: 'edit',
  'math-input': 'functions',
  drawing: 'brush',
  'file-upload': 'cloud_upload'
};

function Block({ block, onAnswer, blockId }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const kind = block.kind || 'concept';
  const icon = BLOCK_ICONS[kind] || 'article';

  if (kind === 'question') {
    const isMCQ = block.options && block.options.length > 0;
    const hasAnswer = block.answer !== undefined && block.answer !== null;
    const answerIndex = hasAnswer && typeof block.answer === 'number'
      ? Number(block.answer)
      : block.options.findIndex((o) => String(o) === String(block.answer));
    const correct = sel != null && hasAnswer && sel === answerIndex;
    return (
      <div className="lesson-block lesson-block-question">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'سؤال'}</strong>
          {block.text && <p>{block.text}</p>}
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

  if (kind === 'textarea') {
    const [value, setValue] = useState('');
    useEffect(() => { onAnswer(blockId, value); }, [value]);
    return (
      <div className="lesson-block lesson-block-textarea">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'إجابة حرة'}</strong>
        </div>
        {block.text && <p className="lesson-block-text">{block.text}</p>}
        <textarea
          className="lesson-textarea"
          placeholder={block.placeholder || 'اكتب إجابتك هنا...'}
          rows={block.rows || 4}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          dir="rtl"
        />
        {block.hint && <p className="lesson-hint">{block.hint}</p>}
      </div>
    );
  }

if (kind === 'math-input') {
    const [value, setValue] = useState('');
    useEffect(() => { onAnswer(blockId, value); }, [value]);
    return (
      <div className="lesson-block lesson-block-math">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'عملية رياضية'}</strong>
        </div>
        {block.text && <p className="lesson-block-text">{block.text}</p>}
        <div className="math-input-wrapper">
          <textarea
            className="lesson-math-input"
            placeholder={block.placeholder || 'اكتب العملية الحسابية...'}
            rows={block.rows || 6}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            dir="ltr"
            spellCheck={false}
          />
          <div className="math-symbols">
            {mathSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                className="math-symbol-btn"
                onClick={() => setValue(value + sym)}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
        {block.hint && <p className="lesson-hint">{block.hint}</p>}
      </div>
    );
  }

  if (kind === 'drawing') {
    const canvasRef = useRef(null);
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [dataUrl, setDataUrl] = useState(null);

    useEffect(() => {
      if (dataUrl) onAnswer(blockId, { type: 'drawing', dataUrl });
    }, [dataUrl]);

    const draw = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
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

    const startDraw = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('touchmove', (e) => draw(e.touches[0]));
    };

    const stopDraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchmove', draw);
      // Capture drawing as data URL
      setDataUrl(canvas.toDataURL('image/png'));
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);
        canvas.addEventListener('touchstart', (e) => startDraw(e.touches[0]));
        canvas.addEventListener('touchend', stopDraw);
        return () => {
          canvas.removeEventListener('mousedown', startDraw);
          canvas.removeEventListener('mouseup', stopDraw);
          canvas.removeEventListener('mouseleave', stopDraw);
          canvas.removeEventListener('touchstart', startDraw);
          canvas.removeEventListener('touchend', stopDraw);
        };
      }
    }, []);

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
    }, []);

    const tools = block.tools || ['pen', 'eraser'];
    const colors = ['#000000', '#ff0000', '#0000ff', '#00aa00', '#ff8800', '#aa00aa'];

    return (
      <div className="lesson-block lesson-block-drawing">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'رسم حر'}</strong>
        </div>
        {block.prompt && <p className="lesson-block-text">{block.prompt}</p>}
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
          style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
        />
        {block.hint && <p className="lesson-hint">{block.hint}</p>}
      </div>
    );
  }

  if (kind === 'file-upload') {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFile = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (block.maxSizeMB && f.size > block.maxSizeMB * 1024 * 1024) {
        alert(`الملف كبير جداً. الحد الأقصى ${block.maxSizeMB} MB`);
        return;
      }
      setFile(f);
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(f);
      }
    };

    const handleUpload = async () => {
      if (!file) return;
      setUploading(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 200);
      try {
        const formData = new FormData();
        formData.append('file', file);
        await new Promise((r) => setTimeout(r, 1500));
        clearInterval(interval);
        setProgress(100);
        alert('تم رفع الملف بنجاح! سيصل للمعلم للتصحيح.');
      } catch (e) {
        alert('فشل الرفع: ' + e.message);
      } finally {
        setUploading(false);
        clearInterval(interval);
      }
    };

    return (
      <div className="lesson-block lesson-block-upload">
        <div className="lesson-block-head">
          <span className="material-icons">{icon}</span>
          <strong>{block.title || 'رفع ملف'}</strong>
        </div>
        {block.text && <p className="lesson-block-text">{block.text}</p>}
        <div className="upload-area">
          <input
            type="file"
            accept={block.accept || 'image/*,application/pdf'}
            onChange={(e) => {
              const f = e.target.files[0];
              if (!f) return;
              if (block.maxSizeMB && f.size > block.maxSizeMB * 1024 * 1024) {
                alert(`الملف كبير جداً. الحد الأقصى ${block.maxSizeMB} MB`);
                return;
              }
              setFile(f);
              // Notify parent of file selection
              onAnswer(blockId, { kind: 'file', name: f.name, size: f.size, mimeType: f.type });
              if (f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setPreview(e.target.result);
                reader.readAsDataURL(f);
              }
            }}
            className="file-input"
            id={`upload-${Math.random()}`}
          />
          <label className="upload-label" htmlFor={`upload-${Math.random()}`}>
            <span className="material-icons">cloud_upload</span>
            {file ? `تم اختيار: ${file.name}` : 'اضغط لاختيار ملف (صورة أو PDF)'}
          </label>
        </div>
        {preview && (
          <div className="upload-preview">
            <img src={preview} alt="معاينة" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 8 }} />
          </div>
        )}
        {file && !uploading && (
          <button className="btn btn-primary" onClick={async () => {
            setUploading(true);
            setProgress(0);
            const interval = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 200);
            try {
              const formData = new FormData();
              formData.append('file', file);
              await new Promise((r) => setTimeout(r, 1500));
              clearInterval(setInterval(() => setProgress(p => Math.min(p + 10, 90)), 200));
              setProgress(100);
              alert('تم رفع الملف بنجاح! سيصل للمعلم للتصحيح.');
            } catch (e) {
              alert('فشل الرفع: ' + e.message);
            } finally {
              setUploading(false);
            }
          }} disabled={uploading}>
            <span className="material-icons">send</span> أرسل للمعلم
          </button>
        )}
        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span>جاري الرفع... {progress}%</span>
          </div>
        )}
        {block.hint && <p className="lesson-hint">{block.hint}</p>}
      </div>
    );
  }

  return (
    <div className={`lesson-block lesson-block-${kind}`}>
      <div className="lesson-block-head">
        <span className="material-icons">{icon}</span>
        <strong>{block.title || (kind === 'objective' ? 'الأهداف' : '')}</strong>
      </div>
      <p className="lesson-block-text">{block.text}</p>
    </div>
  );
}

function LessonPage({ lesson, index, total, onNav, lessonVideos, completed, onComplete }) {
  const readAloud = () => {
    const parts = [lesson.title, ...(lesson.blocks || []).map((b) => b.text || '').filter(Boolean)];
    speak(parts.join('. '));
  };

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const handleAnswer = (blockId, answer) => {
    setAnswers((prev) => ({ ...prev, [blockId]: answer }));
  };

  const handleSubmit = async () => {
    const lessonId = lesson.id;
    const interactiveBlocks = (lesson.blocks || []).filter((b) =>
      ['textarea', 'math-input', 'drawing', 'file-upload'].includes(b.kind)
    );

    if (interactiveBlocks.length === 0) {
      setSubmitResult({ success: false, message: 'لا توجد تمارين تفاعلية في هذا الدرس' });
      return;
    }

    const submission = {
      lessonId,
      lessonTitle: lesson.title,
      answers: Object.fromEntries(
        Object.entries(answers).filter(([id, val]) => val !== '' && val !== null)
      ),
      submittedAt: new Date().toISOString()
    };

    // Check if there's at least one answer
    if (Object.keys(submission.answers).length === 0) {
      setSubmitResult({ success: false, message: 'الرجاء الإجابة على تمرين واحد على الأقل قبل الإرسال' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/student/lesson/submit', submission);
      setSubmitResult({ success: true, message: 'تم إرسال إجاباتك للمعلم بنجاح!', data: res });
      // Optionally mark lesson as completed
      if (!completed) {
        await api.post('/student/progress/lessons', {
          gradeId: 'year3', // This should come from context
          subjectId: 'math',
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

      <div className="lesson-blocks">
        {(lesson.blocks || []).map((b, i) => <Block key={i} block={b} onAnswer={handleAnswer} blockId={`${lesson.id}-${i}`} />)}
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
    </div>
  );
}

function LessonViewer({ book, onClose }) {
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

export default LessonViewer;