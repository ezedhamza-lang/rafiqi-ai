import { useState, useEffect } from 'react';
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
  reward: 'emoji_events'
};

function Block({ block }) {
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
        {(lesson.blocks || []).map((b, i) => <Block key={i} block={b} />)}
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
