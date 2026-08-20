import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Footer() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isParent = user && user.role === 'PARENT';
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>{t('footer.contactUs')}</h4>
            <ul>
              <li>
                <span className="material-icons">phone</span> +216 96 035 997
              </li>
              <li>
                <span className="material-icons">email</span> ensp75882@education.tn
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
              <li><a href="/">{t('footer.userGuide')}</a></li>
              <li><a href="/#faq">{t('footer.faqs')}</a></li>
              <li><a href="/help">{t('footer.contactAdmin')}</a></li>
              <li><a href="/#announcements">{t('footer.announcements')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('footer.followUs')}</h4>
            <ul>
              <li><a href="#">{t('footer.facebook')}</a></li>
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
