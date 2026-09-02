import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Footer() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isParent = user && user.role === 'PARENT';
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/logo-rafiqi.png" alt={t('header.brandAlt')} />
            <p>{t('footer.tagline')}</p>
          </div>
          <div className="footer-social">
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social-fb">
              <span className="material-icons">facebook</span>
            </a>
            <a href="#" aria-label="YouTube" className="social-yt">
              <span className="material-icons">smart_display</span>
            </a>
            <a href="#" aria-label="LinkedIn" className="social-li">
              <span className="material-icons">work</span>
            </a>
          </div>
        </div>
        <div className="footer-grid">
          <div>
            <h4>{t('footer.contactUs')}</h4>
            <ul>
              <li>
                <span className="material-icons">phone</span>{' '}
                <span className="ltr">+216 96 035 997</span>
              </li>
              <li>
                <span className="material-icons">email</span>{' '}
                <span className="ltr">ensp75882@education.tn</span>
              </li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.quickServices')}</h4>
            <ul>
              {isParent && (
                <>
                  <li><a href="/registration">{t('footer.remoteRegistration')}</a></li>
                  <li><a href="/students">{t('footer.myChildren')}</a></li>
                </>
              )}
              <li><a href="/help">{t('footer.requestHelp')}</a></li>
              <li><a href="/dashboard">{t('footer.dashboard')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.usefulInfo')}</h4>
            <ul>
              <li><a href="/guide">{t('footer.userGuide')}</a></li>
              <li><a href="/#faq">{t('footer.faqs')}</a></li>
              <li><a href="/help">{t('footer.contactAdmin')}</a></li>
              <li><a href="/#announcements">{t('footer.announcements')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.followUs')}</h4>
            <ul className="footer-follow">
              <li><a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer">{t('footer.facebook')}</a></li>
              <li><a href="#">{t('footer.youtube')}</a></li>
              <li><a href="#">{t('footer.linkedin')}</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          {t('footer.rightsReserved')}
        </div>
      </div>
    </footer>
  );
}
