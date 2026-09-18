import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

const SECTIONS = ['data', 'purpose', 'security', 'children', 'rights', 'contact'];

export default function Privacy() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem', maxWidth: 860 }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.4rem' }}>
        {t('privacy.title')}
      </h1>
      <p className="sub" style={{ marginBottom: '1.5rem' }}>{t('privacy.intro')}</p>
      {SECTIONS.map((s) => (
        <section key={s} className="ui-card" style={{ marginBottom: '1rem' }}>
          <h2 className="ui-card-title" style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>
            {t(`privacy.${s}Title`)}
          </h2>
          <p style={{ lineHeight: 1.9, color: 'var(--text-secondary)' }}>{t(`privacy.${s}Body`)}</p>
        </section>
      ))}
      <p style={{ marginTop: '1.2rem' }}>
        <Link to="/" className="btn btn-outline btn-sm">{t('common.backHome')}</Link>
      </p>
    </div>
  );
}
