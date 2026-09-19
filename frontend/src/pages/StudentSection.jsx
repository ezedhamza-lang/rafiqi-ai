import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';

const SUBJECTS = {
  MATH: {
    key: 'subjectMath',
    icon: 'calculate',
    color: 'var(--primary)',
    bg: 'linear-gradient(135deg, #233863, #2f4a7d)'
  },
  READING: {
    key: 'subjectReading',
    icon: 'menu_book',
    color: '#b06b00',
    bg: 'linear-gradient(135deg, #f4ab2c, #E8A317)'
  }
};

function LessonCard({ lesson, onOpen }) {
  const { t } = useI18n();
  const subj = SUBJECTS[lesson.subject];
  return (
    <div className="card">
      <div className="lesson-head" style={{ background: subj.bg }}>
        <span className="material-icons" style={{ fontSize: '2.4rem', color: '#fff' }}>
          {subj.icon}
        </span>
        <span className="lesson-num">{t('studentSection.lessonNum', { n: lesson.order })}</span>
      </div>
      <div className="card-body">
        <h3>{lesson.title}</h3>
        <p>{lesson.description}</p>
        <div className="card-footer">
          <span className="date-value">{t('studentSection.level', { level: lesson.level })}</span>
          {lesson.fileUrl && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpen(lesson)}>
              <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
              {t('studentSection.readBook')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PdfModal({ lesson, onClose }) {
  const { t } = useI18n();
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{lesson.title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('studentSection.close')}
          </button>
        </div>
        <iframe
          src={lesson.fileUrl}
          title={lesson.title}
          className="pdf-frame"
        />
        <div className="modal-foot">
          <a className="btn btn-primary btn-sm" href={lesson.fileUrl} target="_blank" rel="noreferrer" download>
            <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
            {t('studentSection.downloadBook')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function StudentSection() {
  const { t } = useI18n();
  const [active, setActive] = useState('MATH');
  const [lessons, setLessons] = useState([]);
  const [openLesson, setOpenLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/public/lessons')
      .then(setLessons)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = lessons.filter((l) => l.subject === active);

  return (
    <>
      <h2>{t('studentSection.title')}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.4rem', lineHeight: 1.8 }}>
        {t('studentSection.subtitle')}
      </p>

      <div className="subject-tabs">
        {Object.entries(SUBJECTS).map(([key, s]) => (
          <button
            key={key}
            className={`subject-tab ${active === key ? 'active' : ''}`}
            style={active === key ? { background: s.bg, color: '#fff' } : {}}
            onClick={() => setActive(key)}
          >
            <span className="material-icons">{s.icon}</span>
            {t(`studentSection.${s.key}`)}
            <span className="subject-count">
              {t('studentSection.lessonCount', { n: lessons.filter((l) => l.subject === key).length })}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-wrap">
          <span className="spinner" />
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} onOpen={setOpenLesson} />
          ))}
        </div>
      )}

      <div className="lesson-books">
        <h3>{t('studentSection.schoolBooks')}</h3>
        <p>{t('studentSection.schoolBooksSub')}</p>
        <div className="books-grid">
          {active === 'MATH' ? (
            <>
              <a className="book-link" href="/uploads/lessons/math-book-1.pdf" target="_blank" rel="noreferrer">
                <span className="material-icons">book</span>
                {t('studentSection.mathBook1')}
              </a>
              <a className="book-link" href="/uploads/lessons/math-book-2.pdf" target="_blank" rel="noreferrer">
                <span className="material-icons">book</span>
                {t('studentSection.mathBook2')}
              </a>
            </>
          ) : (
            <>
              <a className="book-link" href="/uploads/lessons/reading-book-1.pdf" target="_blank" rel="noreferrer">
                <span className="material-icons">book</span>
                {t('studentSection.readingBook')}
              </a>
              <a className="book-link" href="/uploads/lessons/reading-exercises-1.pdf" target="_blank" rel="noreferrer">
                <span className="material-icons">book</span>
                {t('studentSection.readingExercises')}
              </a>
            </>
          )}
        </div>
      </div>

      {openLesson && <PdfModal lesson={openLesson} onClose={() => setOpenLesson(null)} />}
    </>
  );
}
