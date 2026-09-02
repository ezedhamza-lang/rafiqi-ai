import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';

const SUBJECT_LABELS = {
  math: 'الرياضيات',
  anisi: 'القراءة',
  science: 'الإيقاظ العلمي',
  production: 'الإنتاج الكتابي',
  islamic: 'التربية الإسلامية',
  tech: 'التربية التقنية'
};

const MASTERY_STYLE = {
  MASTERED: { icon: '✅', label: 'متقن', color: '#2e9e5b' },
  IN_PROGRESS: { icon: '🟡', label: 'جارٍ التحسّن', color: '#e8911f' },
  NOT_STARTED: { icon: '⚪', label: 'لم يبدأ', color: '#98a2b3' }
};

// خريطة الإتقان الحية — المرحلة 2
export default function StudentMastery() {
  const [map, setMap] = useState(null);
  const [gaps, setGaps] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/student/mastery'), api.get('/student/gaps')])
      .then(([m, g]) => {
        setMap(m);
        setGaps(g);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!map) return <p>جارٍ تحميل خريطة الإتقان...</p>;

  const s = map.summary || {};

  return (
    <div className="mastery-page">
      <h3>🗺️ خريطة إتقاني</h3>
      <div className="mastery-summary">
        <span className="badge ok">متقن: {s.mastered || 0}</span>
        <span className="badge warn">جارٍ: {s.inProgress || 0}</span>
        <span className="badge">لم يبدأ: {s.notStarted || 0}</span>
      </div>

      {gaps?.gaps?.length > 0 && (
        <div className="gaps-box">
          <h4>📡 رادار الفجوات — اكتشفنا ما ينبغي تركيزك عليه</h4>
          {gaps.gaps.slice(0, 5).map((g, i) => (
            <div key={i} className={`gap-item sev-${g.severity}`}>
              <strong>{SUBJECT_LABELS[g.area] || g.area}</strong>
              <p>{g.why}</p>
              <p className="gap-action">💡 {g.suggestedAction}</p>
            </div>
          ))}
        </div>
      )}

      {map.subjects.map((sub) => (
        <div key={sub.subjectId} className="mastery-subject">
          <button type="button" className="mastery-subject-head" onClick={() => setOpenSubject(openSubject === sub.subjectId ? null : sub.subjectId)}>
            <strong>{SUBJECT_LABELS[sub.subjectId] || sub.subjectId}</strong>
            {sub.avgQuizPct != null && <span className="badge info">متوسط الاختبارات: {sub.avgQuizPct}%</span>}
            <span className="muted">{sub.lessons.filter((l) => l.mastery === 'MASTERED').length}/{sub.lessons.length} درساً</span>
          </button>
          {openSubject === sub.subjectId && (
            <ul className="mastery-lessons">
              {sub.lessons.map((l) => {
                const st = MASTERY_STYLE[l.mastery];
                return (
                  <li key={l.lessonId}>
                    <span>{st.icon}</span>
                    <span className="mastery-title">{l.order}. {l.title}</span>
                    <span style={{ color: st.color, fontSize: '0.8rem', fontWeight: 700 }}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}