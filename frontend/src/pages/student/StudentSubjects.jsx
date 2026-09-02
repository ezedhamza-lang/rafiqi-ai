import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import LessonViewer from '../../components/LessonViewer.jsx';

const SUBJECT_META = {
  math: { icon: 'calculate', bg: 'linear-gradient(135deg, #233863, #2f4a7d)' },
  anisi: { icon: 'auto_stories', bg: 'linear-gradient(135deg, #b06b00, #fd8b15)' },
  reading: { icon: 'auto_stories', bg: 'linear-gradient(135deg, #b06b00, #fd8b15)' },
  science: { icon: 'biotech', bg: 'linear-gradient(135deg, #0e6b4f, #17a076)' },
  production: { icon: 'edit_note', bg: 'linear-gradient(135deg, #6b3fa0, #9d6bdc)' },
  islamic: { icon: 'star', bg: 'linear-gradient(135deg, #1b5e3b, #2e8b57)' },
  civic: { icon: 'account_balance', bg: 'linear-gradient(135deg, #8a4b1d, #c97f3a)' },
  art: { icon: 'palette', bg: 'linear-gradient(135deg, #b23a6a, #e06a9a)' },
  pe: { icon: 'directions_run', bg: 'linear-gradient(135deg, #1a5f8a, #3f9bd9)' },
  french: { icon: 'translate', bg: 'linear-gradient(135deg, #5b2d8a, #8a5fc2)' },
  stories: { icon: 'menu_book', bg: 'linear-gradient(135deg, #7b3fa0, #a86bc8)' }
};

export default function StudentSubjects() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBook, setOpenBook] = useState(null);

  useEffect(() => {
    api
      .get('/teacher/student/subjects')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    api
      .get('/public/curriculum/books')
      .then(setBooks)
      .catch(() => {});
  }, []);

  const openLessonViewer = (s) => {
    const real = books.find((b) => b.gradeId === s.gradeId && b.subjectId === s.code);
    setOpenBook(
      real || {
        gradeId: s.gradeId,
        subjectId: s.code,
        title: s.subjectLabel,
        grade: data?.class?.level || '',
        subject: s.subjectLabel
      }
    );
  };

  if (loading) return <div className="loading-wrap"><span className="spinner" /></div>;

  if (!data?.subjects?.length) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{t('studentSpace.subjects.title')}</h3>
        </div>
        <div className="empty">
          {data?.class ? t('studentSpace.subjects.emptyNoClass') : t('studentSpace.subjects.emptyNone')}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.subjects.titleWithClass', { className: data.class?.name })}</h3>
      </div>

      <div className="subjects-grid">
        {data.subjects.map((s) => {
          const meta = SUBJECT_META[s.code] || SUBJECT_META.stories;
          return (
            <div key={s.code} className="card-item subject-card">
              <div className="subject-cover" style={{ background: meta.bg }}>
                <span className="subject-cover-icon material-icons">{meta.icon}</span>
                <div>
                  <h4>{s.subjectLabel}</h4>
                  <p className="sub">
                    {t('studentSpace.subjects.teacherLabel', {
                      name: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : t('studentSpace.subjects.teacherNone')
                    })}
                  </p>
                </div>
              </div>

              {s.comingSoon ? (
                <p className="coming-soon"><span className="badge badge-soft">{t('studentSpace.subjects.comingSoon')}</span></p>
              ) : (
                <div className="subject-body">
                  {s.platformLessons > 0 && (
                    <div className="platform-lessons">
                      <div className="platform-lessons-head">
                        <span className="material-icons lesson-icon">school</span>
                        <strong>{t('studentSpace.books.interactiveLessons')}</strong>
                        <span className="muted">{t('studentSpace.subjects.platformCount', { n: s.platformLessons })}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openLessonViewer(s)}
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                        {t('studentSpace.books.interactiveLessons')}
                      </button>
                    </div>
                  )}
                  {s.lessonTitles.length > 0 && (
                    <ul className="lesson-titles">
                      {s.lessonTitles.map((title, i) => (
                        <li key={i}><span className="lesson-num">{i + 1}</span>{title}</li>
                      ))}
                    </ul>
                  )}
                  {s.lessons.length > 0 && (
                    <ul className="lesson-list">
                      {s.lessons.map((l) => (
                        <li key={l.id}>
                          <span className="material-icons lesson-icon">menu_book</span>
                          <div className="lesson-info">
                            <strong>{l.title}</strong>
                            <span className="muted">{l.description}</span>
                          </div>
                          {l.fileUrl && (
                            <a className="btn btn-sm btn-outline" href={l.fileUrl} target="_blank" rel="noreferrer">
                              {t('studentSpace.subjects.download')}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openBook && <LessonViewer book={openBook} onClose={() => setOpenBook(null)} />}
    </div>
  );
}