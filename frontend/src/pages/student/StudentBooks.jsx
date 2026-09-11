import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import BookViewer from './BookViewer.jsx';
import LessonViewer from '../../components/LessonViewer.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useStudentLevel } from '../../hooks/useStudentLevel.js';

const SUBJECTS = [
  { code: 'math', key: 'math', icon: 'calculate', color: '#233863', bg: 'linear-gradient(135deg, #233863, #2f4a7d)' },
  { code: 'anisi', key: 'anisi', icon: 'menu_book', color: '#b06b00', bg: 'linear-gradient(135deg, #f4ab2c, #fd8b15)' },
  { code: 'science', key: 'science', icon: 'science', color: '#0e6b4f', bg: 'linear-gradient(135deg, #0e6b4f, #17a076)' },
  { code: 'production', key: 'production', icon: 'edit', color: '#6b3fa0', bg: 'linear-gradient(135deg, #6b3fa0, #9d6bdc)' }
];

// كل كتب المادة الواحدة (كثيرًا ما للسنة كتب متعددة لنفس المادة) تُجمّع تحت تبويب واحد
function bookTab(b) {
  const k = String(b.subjectKey || b.subject || '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u0652]/g, '')
    .trim();
  if (k.startsWith('رياضيات')) return 'math';
  if (k.includes('قراء') || k.includes('انيس')) return 'anisi';
  if (k.includes('ايقاظ') || k.includes('علوم')) return 'science';
  if (k.includes('انتاج')) return 'production';
  return b.subjectId || 'math';
}

export default function StudentBooks() {
  const { t } = useI18n();
  const ownLevel = useStudentLevel();
  const [books, setBooks] = useState([]);
  const [activeSubject, setActiveSubject] = useState('math');
  const [activeGrade, setActiveGrade] = useState('all');
  const [openBook, setOpenBook] = useState(null);
  const [openScanBook, setOpenScanBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/public/curriculum/books')
      .then(setBooks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grades = ownLevel
    ? [ownLevel]
    : [...new Set(books.map((b) => b.gradeId))].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  const filtered = books.filter(
    (b) =>
      bookTab(b) === activeSubject &&
      (ownLevel ? b.gradeId === ownLevel : activeGrade === 'all' || b.gradeId === activeGrade)
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.books.title')}</h3>
      </div>

      <div className="subject-tabs">
        {SUBJECTS.map((s) => (
          <button
            key={s.code}
            className={`subject-tab ${activeSubject === s.code ? 'active' : ''}`}
            style={activeSubject === s.code ? { background: s.bg, color: '#fff' } : {}}
            onClick={() => setActiveSubject(s.code)}
          >
            <span className="material-icons">{s.icon}</span>
            {t(`studentSpace.books.subjects.${s.key}`)}
            <span className="subject-count">{t('studentSpace.books.booksCount', { n: books.filter((b) => bookTab(b) === s.code).length })}</span>
          </button>
        ))}
      </div>

      {!ownLevel && (
        <div className="subject-tabs">
          <button
            className={`subject-tab ${activeGrade === 'all' ? 'active' : ''}`}
            style={activeGrade === 'all' ? { background: 'var(--primary)', color: '#fff' } : {}}
            onClick={() => setActiveGrade('all')}
          >
            {t('studentSpace.books.allLevels')}
          </button>
          {grades.map((g) => (
            <button
              key={g}
              className={`subject-tab ${activeGrade === g ? 'active' : ''}`}
              style={activeGrade === g ? { background: 'var(--accent)', color: '#fff' } : {}}
              onClick={() => setActiveGrade(g)}
            >
              {books.find((b) => b.gradeId === g)?.grade || g}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {t('studentSpace.books.empty')}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((book) => (
            <div key={`${book.gradeId}-${book.subjectId}-${book.title}`} className="card">
              <div className="lesson-head" style={{ background: (SUBJECTS.find((s) => s.code === bookTab(book)) || SUBJECTS[0]).bg }}>
                <span className="material-icons" style={{ fontSize: '2.4rem', color: '#fff' }}>
                  {(SUBJECTS.find((s) => s.code === bookTab(book)) || SUBJECTS[0]).icon}
                </span>
                <span className="lesson-num">{book.grade}</span>
              </div>
              <div className="card-body">
                <h3>{book.title}</h3>
                <p>{book.subtitle}</p>
                <div className="card-footer">
                  <span className="date-value">{book.totalPages ? t('studentSpace.books.pagesCount', { n: book.totalPages }) : t('studentSpace.books.lessonContent')}</span>
                  {!book.scanReady && (
                    <button className="btn btn-primary btn-sm" onClick={() => setOpenBook(book)}>
                      <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                      {t('studentSpace.books.interactiveLessons')}
                    </button>
                  )}
                  {book.hasImages && (
                    <button
                      className={`btn ${book.scanReady ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                      onClick={() => setOpenScanBook(book)}
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>auto_stories</span>
                      {t('studentSpace.books.browseBook')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openBook && <LessonViewer book={openBook} onClose={() => setOpenBook(null)} />}
      {openScanBook && <BookViewer book={openScanBook} onClose={() => setOpenScanBook(null)} />}
    </div>
  );
}
