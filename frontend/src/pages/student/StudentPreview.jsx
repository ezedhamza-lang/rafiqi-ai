import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

const FEATURES = [
  { icon: 'auto_stories', titleKey: 'title1', bodyKey: 'body1' },
  { icon: 'quiz', titleKey: 'title2', bodyKey: 'body2' },
  { icon: 'emoji_events', titleKey: 'title3', bodyKey: 'body3' }
];

const OPTIONS = ['a', 'b', 'c'];

/** Public preview of the student space — no login required. */
export default function StudentPreview() {
  const { t } = useI18n();
  const [picked, setPicked] = useState(null);
  const correct = picked === 'b';

  return (
    <main id="main-content" className="container student-preview" dir="rtl">
      <section className="student-preview__hero card">
        <span className="material-icons" style={{ fontSize: 46, color: 'var(--primary)' }}>school</span>
        <h1>{t('studentPreview.title')}</h1>
        <p>{t('studentPreview.subtitle')}</p>
        <div className="student-preview__cta">
          <Link to="/register" className="btn btn-primary btn-lg">
            <span className="material-icons">person_add</span> {t('studentPreview.register')}
          </Link>
          <Link to="/login" className="btn btn-outline btn-lg">{t('studentPreview.login')}</Link>
        </div>
      </section>

      <section className="student-preview__features" aria-label={t('studentPreview.featuresLabel')}>
        {FEATURES.map((f) => (
          <article key={f.icon} className="card student-preview__feature">
            <span className="material-icons" style={{ fontSize: 34, color: 'var(--primary)' }}>{f.icon}</span>
            <h2>{t(`studentPreview.${f.titleKey}`)}</h2>
            <p>{t(`studentPreview.${f.bodyKey}`)}</p>
          </article>
        ))}
      </section>

      <section className="card student-preview__demo" aria-label={t('studentPreview.demoLabel')}>
        <h2>{t('studentPreview.demoTitle')}</h2>
        <p className="student-preview__question">{t('studentPreview.question')}</p>
        <div className="student-preview__options">
          {OPTIONS.map((k) => (
            <button
              key={k}
              type="button"
              className={'btn ' + (picked === k ? 'btn-primary' : 'btn-outline')}
              onClick={() => setPicked(k)}
              aria-pressed={picked === k}
            >
              {t(`studentPreview.option${k}`)}
            </button>
          ))}
        </div>
        {picked && (
          <p className="student-preview__feedback" role="status" data-correct={correct ? 'true' : 'false'}>
            {t(correct ? 'studentPreview.correct' : 'studentPreview.tryAgain')}
          </p>
        )}
        <p className="student-preview__note">{t('studentPreview.demoNote')}</p>
      </section>

      <p className="student-preview__footnote">{t('studentPreview.footnote')}</p>
    </main>
  );
}
