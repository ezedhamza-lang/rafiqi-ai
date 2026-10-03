import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { levelLabel } from '../../utils/labels.js';

const CERT_ICONS = { level: '🏆', subject: '📚', xp: '⭐' };

export default function StudentCertificates() {
  const { t, lang } = useI18n();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api.get('/student/certificates')
      .then(d => setCerts(d.certificates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const download = async (type, id) => {
    setDownloading(id);
    try {
      const res = await fetch(`${api.defaults?.baseURL || '/api'}/student/certificates/${type}/${id}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${type}-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* empty */ }
    setDownloading(null);
  };

  if (loading) return <div className="cert-loading"><div className="spinner" /></div>;

  return (
    <div className="cert-page">
      <div className="cert-hero">
        <span className="cert-hero__icon">🎓</span>
        <h2 className="cert-hero__title">{t('studentSpace.certificates.title', 'شهاداتي')}</h2>
        <p className="cert-hero__sub">{t('studentSpace.certificates.subtitle', 'شهاداتك القابلة للتحميل والطباعة')}</p>
      </div>

      {certs.length === 0 ? (
        <div className="cert-empty">
          <span className="cert-empty__icon">📜</span>
          <p>{t('studentSpace.certificates.empty', 'لم تحصل على شهادة بعد. واصل التعلم لكسب شهادات!')}</p>
        </div>
      ) : (
        <div className="cert-grid">
          {certs.map(c => (
            <div key={c.id} className="cert-card">
              <div className="cert-card__icon">{CERT_ICONS[c.type] || '📜'}</div>
              <h3 className="cert-card__title">{c.title}</h3>
              <p className="cert-card__desc">{c.description}</p>
              {c.subject && <span className="cert-card__subject">📚 {c.subject}</span>}
              {c.level && <span className="cert-card__level">🏅 المستوى {levelLabel(c.level, lang)}</span>}
              <button
                className="cert-download"
                onClick={() => download(c.type, c.id)}
                disabled={downloading === c.id}
              >
                <span className="material-icons" style={{ fontSize: '1rem' }}>
                  {downloading === c.id ? 'hourglass_top' : 'download'}
                </span>
                {downloading === c.id
                  ? t('studentSpace.certificates.generating', 'جاري التوليد...')
                  : t('studentSpace.certificates.download', 'تحميل PDF')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
