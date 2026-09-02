import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function TeacherLessonProgress() {
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/teacher/classes').then(setClasses).catch(() => {});
  }, []);

  const load = (id) => {
    if (!id) return;
    setClassId(id);
    setLoading(true);
    api
      .get(`/teacher/lesson-progress?classId=${id}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  return (
    <div className="lesson-progress-page">
      <div className="space-head">
        <div>
          <h2>{t('teacherSpace.lessonProgress.title')}</h2>
          <p className="sub">{t('teacherSpace.lessonProgress.subtitle')}</p>
        </div>
        <select value={classId} onChange={(e) => load(e.target.value)}>
          <option value="">{t('teacherSpace.lessonProgress.selectClass')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}

      {!loading && data && (
        <>
          <p className="muted">
            {t('teacherSpace.lessonProgress.studentsCount', { n: data.studentsCount })}
          </p>
          {data.subjects.length === 0 && <p className="muted">{t('common.noData')}</p>}
          {data.subjects.map((s) => (
            <div key={s.subjectId} className="card">
              <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #233863, #2f4a7d)' }}>
                <span className="material-icons">menu_book</span>
                <h3>
                  {t(`subjects.${s.subjectId === 'anisi' || s.subjectId === 'reading' ? 'READING' : s.subjectId.toUpperCase()}`)} —{' '}
                  {t('teacherSpace.lessonProgress.totalCompletions', { n: s.totalCompletions })}
                </h3>
              </div>
              <div className="card-body">
                {s.lessons.map((l) => (
                  <div key={l.lessonId} className="lesson-progress-row">
                    <span className="lesson-name">{l.lessonTitle}</span>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(100, Math.round((l.count / data.studentsCount) * 100))}%` }}
                      />
                    </div>
                    <span className="progress-count">{l.count}/{data.studentsCount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && !data && classId && <p className="muted">{t('common.noData')}</p>}
    </div>
  );
}