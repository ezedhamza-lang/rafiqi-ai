import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { useStudentLevel } from '../../hooks/useStudentLevel.js';

const SUBJECTS = [
  { code: 'math', key: 'math', icon: 'calculate', color: '#233863' },
  { code: 'anisi', key: 'anisi', icon: 'menu_book', color: '#b06b00' },
  { code: 'science', key: 'science', icon: 'science', color: '#0e6b4f' },
  { code: 'production', key: 'production', icon: 'edit', color: '#6b3fa0' },
  { code: 'french', key: 'french', icon: 'translate', color: '#1e40af' }
];

const GRADES = ['year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

export default function StudentFlashcards() {
  const { t } = useI18n();
  const ownLevel = useStudentLevel();
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState(ownLevel || 'year1');
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setIndex(0);
    setFlipped(false);
    setKnown([]);
    api
      .get(`/student/flashcards?gradeId=${ownLevel || grade}&subjectId=${subject}&limit=12`)
      .then((res) => setCards(res.cards || []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, grade, ownLevel]);

  const card = cards[index];

  const mark = (ok) => {
    setKnown((prev) => [...prev, ok]);
    if (index + 1 < cards.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      setIndex(cards.length);
      const results = [...known, ok];
      const knownIds = cards.filter((_, i) => results[i]).map((c) => c.id);
      const reviewIds = cards.filter((_, i) => !results[i]).map((c) => c.id);
      api.post('/student/flashcards/progress', {
        subjectId: subject,
        gradeId: ownLevel || grade,
        knownIds,
        reviewIds
      }).catch(() => {});
    }
  };

  return (
    <div className="flashcards-page">
      <div className="space-head">
        <div>
          <h2>{t('studentSpace.flashcards.title')}</h2>
          <p className="sub">{t('studentSpace.flashcards.subtitle')}</p>
        </div>
      </div>

      <div className="flash-filters">
        {!ownLevel && (
          <div className="flash-grades">
            {GRADES.map((g) => (
              <button key={g} className={`chip ${grade === g ? 'active' : ''}`} onClick={() => setGrade(g)}>
                {t(`studentSpace.flashcards.grade.${g}`)}
              </button>
            ))}
          </div>
        )}
        <div className="flash-subjects">
          {SUBJECTS.map((s) => (
            <button key={s.code} className={`chip ${subject === s.code ? 'active' : ''}`} style={subject === s.code ? { background: s.color } : {}} onClick={() => setSubject(s.code)}>
              <span className="material-icons">{s.icon}</span>
              {t(`subjects.${s.key}`)}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && cards.length === 0 && <p className="muted">{t('studentSpace.flashcards.empty')}</p>}

      {!loading && cards.length > 0 && index < cards.length && card && (
        <div className="flash-stage">
          <div className={`flash-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)}>
            <div className="flash-inner">
              <div className="flash-face flash-front">
                <span className="chip small muted">{card.lesson}</span>
                <p>{card.front}</p>
                <small className="muted">{t('studentSpace.flashcards.tapToReveal')}</small>
              </div>
              <div className="flash-face flash-back">
                <p>{card.back}</p>
                <small className="muted">{t('studentSpace.flashcards.tapToHide')}</small>
              </div>
            </div>
          </div>
          <div className="flash-actions">
            <button className="btn btn-success" onClick={() => mark(true)}>
              <span className="material-icons">check</span>
              {t('studentSpace.flashcards.known')}
            </button>
            <span className="muted">{index + 1} / {cards.length}</span>
            <button className="btn btn-outline" onClick={() => mark(false)}>
              <span className="material-icons">close</span>
              {t('studentSpace.flashcards.review')}
            </button>
          </div>
        </div>
      )}

      {!loading && cards.length > 0 && index >= cards.length && (
        <div className="card flash-summary">
          <h3>{t('studentSpace.flashcards.done')}</h3>
          <p>
            ✅ {known.filter(Boolean).length} {t('studentSpace.flashcards.knownCount')} — 🔁 {known.filter((k) => !k).length} {t('studentSpace.flashcards.reviewCount')}
          </p>
          <button className="btn btn-primary" onClick={load}>
            {t('studentSpace.flashcards.restart')}
          </button>
        </div>
      )}
    </div>
  );
}