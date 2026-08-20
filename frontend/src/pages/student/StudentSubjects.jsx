import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function StudentSubjects() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/teacher/student/subjects')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        {data.subjects.map((s) => (
          <div key={s.id} className="card-item subject-card">
            <div className="subject-head">
              <span className="subject-icon material-icons">{iconFor(s.subject)}</span>
              <div>
                <h4>{s.subjectLabel}</h4>
                <p className="sub">
                  {t('studentSpace.subjects.teacherLabel', {
                    name: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : t('studentSpace.subjects.teacherNone')
                  })}
                </p>
              </div>
            </div>

            {s.lessons.length === 0 ? (
              <p className="muted">{t('studentSpace.subjects.noLessons')}</p>
            ) : (
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
        ))}
      </div>
    </div>
  );
}

function iconFor(subject) {
  switch (subject) {
    case 'MATH':
      return 'calculate';
    case 'READING':
      return 'auto_stories';
    case 'SCIENCE':
      return 'biotech';
    case 'STORIES':
      return 'menu_book';
    default:
      return 'school';
  }
}
