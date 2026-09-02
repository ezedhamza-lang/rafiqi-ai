import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import AdaptiveSessionCard, { Stars } from '../../components/AdaptiveSessionCard.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useStudentLevel } from '../../hooks/useStudentLevel.js';

const SUBJECT_CODES = ['math', 'anisi', 'science'];
const SUBJECT_META = {
  math: { icon: 'calculate', bg: 'linear-gradient(135deg, #233863, #2f4a7d)' },
  anisi: { icon: 'menu_book', bg: 'linear-gradient(135deg, #f4ab2c, #fd8b15)' },
  science: { icon: 'science', bg: 'linear-gradient(135deg, #0e6b4f, #17a076)' }
};

function SummaryCards({ summary, t }) {
  if (!summary) return null;
  const maxLevel = Math.max(1, ...summary.byDifficulty.map((l) => l.count));
  return (
    <div className="adaptive-summary">
      <div className="adaptive-summary-grid">
        <div className="adaptive-stat"><strong>{summary.dueNow}</strong><span>{t('studentSpace.adaptive.dueNow')}</span></div>
        <div className="adaptive-stat"><strong>{summary.total}</strong><span>{t('studentSpace.adaptive.trackedCards')}</span></div>
        <div className="adaptive-stat"><strong>{summary.learned}</strong><span>{t('studentSpace.adaptive.masteredCards')}</span></div>
        <div className="adaptive-stat"><strong>{summary.accuracy}%</strong><span>{t('studentSpace.adaptive.accuracy')}</span></div>
      </div>
      <div className="adaptive-levels">
        {summary.byDifficulty.map((l) => (
          <div key={l.level} className="adaptive-level-row">
            <span className="adaptive-level-label"><Stars level={l.level} /></span>
            <div className="adaptive-level-bar">
              <div
                className="adaptive-level-fill"
                style={{ width: `${Math.round((l.count / maxLevel) * 100)}%`, background: '#f4ab2c' }}
              />
            </div>
            <span className="adaptive-level-count">{l.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentAdaptive() {
  const { t } = useI18n();
  const ownLevel = useStudentLevel();
  const [books, setBooks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState(null);
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionDone, setSessionDone] = useState(false);

  useEffect(() => {
    api
      .get('/public/curriculum/books')
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setBooks(arr);
        const g = ownLevel
          ? [ownLevel]
          : [...new Set(arr.map((b) => b.gradeId))].sort(
              (a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''))
            );
        setGrades(g);
        if (!grade && g.length) setGrade(g[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownLevel]);

  const loadSummary = useCallback(async () => {
    if (!grade) return;
    try {
      const data = await api.get(`/student/adaptive/summary?gradeId=${grade}&subjectId=${subject}`);
      setSummary(data);
    } catch {
      /* ignore */
    }
  }, [grade, subject]);

  const loadSession = useCallback(async (append = false) => {
    if (!grade) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.get(`/student/adaptive/session?gradeId=${grade}&subjectId=${subject}&limit=10`);
      const newItems = Array.isArray(data.items) ? data.items : [];
      if (append) {
        if (newItems.length === 0) setSessionDone(true);
        setItems((xs) => [...xs, ...newItems]);
      } else {
        setSessionDone(false);
        setItems(newItems);
        setIdx(0);
      }
      loadSummary();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [grade, subject, loadSummary]);

  useEffect(() => {
    if (grade) {
      setItems([]);
      setIdx(0);
      setSessionDone(false);
      loadSession(false);
    }
  }, [grade, subject, loadSession]);

  const handleReviewed = (res) => {
    setItems((xs) => xs.map((it, i) => (i === idx ? { ...it, state: res.state } : it)));
    loadSummary();
  };

  const next = () => {
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
    } else if (items.length > 0) {
      loadSession(true);
      setIdx(items.length);
    } else {
      setSessionDone(true);
    }
  };

  const current = items[idx];

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.adaptive.title')}</h3>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {t('studentSpace.adaptive.intro')}
      </p>

      <div className="subject-tabs">
        {SUBJECT_CODES.map((code) => (
          <button
            key={code}
            className={`subject-tab ${subject === code ? 'active' : ''}`}
            style={subject === code ? { background: SUBJECT_META[code].bg, color: '#fff' } : {}}
            onClick={() => setSubject(code)}
          >
            <span className="material-icons">{SUBJECT_META[code].icon}</span>
            {t(`studentSpace.books.subjects.${code}`)}
          </button>
        ))}
      </div>

      {grades.length > 1 && (
        <div className="subject-tabs">
          {grades.map((g) => (
            <button
              key={g}
              className={`subject-tab ${grade === g ? 'active' : ''}`}
              style={grade === g ? { background: 'var(--accent)', color: '#fff' } : {}}
              onClick={() => setGrade(g)}
            >
              {books.find((b) => b.gradeId === g)?.grade || g}
            </button>
          ))}
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <SummaryCards summary={summary} t={t} />

      {loading && items.length === 0 ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : !current ? (
        <div className="empty">
          {sessionDone
            ? t('studentSpace.adaptive.sessionDoneMsg')
            : t('studentSpace.adaptive.noQuestionsMsg')}
          {!sessionDone && (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => loadSession(false)}>
              {t('studentSpace.adaptive.startReview')}
            </button>
          )}
        </div>
      ) : (
        <div className="adaptive-session">
          <div className="adaptive-session-head">
            <span className="badge">
              {t('studentSpace.adaptive.questionProgress', { cur: idx + 1, total: items.length })}
            </span>
            <span className="badge accent">{t(`studentSpace.books.subjects.${subject}`)}</span>
            <span className="badge">{books.find((b) => b.gradeId === grade)?.grade || grade}</span>
          </div>
          <AdaptiveSessionCard item={current} onReviewed={handleReviewed} gradeId={grade} subjectId={subject} />
          <div className="adaptive-actions">
            <button type="button" className="btn btn-ghost" onClick={() => loadSession(false)}>
              {t('studentSpace.adaptive.reloadSession')}
            </button>
            <button type="button" className="btn btn-primary" onClick={next}>
              {t('studentSpace.adaptive.next')}
              <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
