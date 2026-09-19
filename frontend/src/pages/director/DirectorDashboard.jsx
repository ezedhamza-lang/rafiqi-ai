import { useState, useEffect , lazy, Suspense} from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import PromoCarousel from '../../components/PromoCarousel.jsx';
const DirectorHome = lazy(() => import('./DirectorHome.jsx'));
const DirectorClasses = lazy(() => import('./DirectorClasses.jsx'));
const DirectorNotifications = lazy(() => import('./DirectorNotifications.jsx'));
const DirectorRequests = lazy(() => import('./DirectorRequests.jsx'));
const DirectorDocuments = lazy(() => import('./DirectorDocuments.jsx'));
const AdminSubscriptions = lazy(() => import('./AdminSubscriptions.jsx'));
const FinanceDashboard = lazy(() => import('./FinanceDashboard.jsx'));
const SchoolCalendar = lazy(() => import('../../components/SchoolCalendar.jsx'));
import { canManageFinance, getHomePath } from '../../roles.js';

const TABS = [
  { to: '', end: true, icon: 'dashboard', key: 'dashboard' },
  { to: 'requests', icon: 'how_to_reg', key: 'requests' },
  { to: 'documents', icon: 'folder_shared', key: 'documents' },
  { to: 'classes', icon: 'school', key: 'classes' },
  { to: 'calendar', icon: 'calendar_month', key: 'calendar' },
  { to: 'notifications', icon: 'notifications', key: 'notifications' }
];

export default function DirectorDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api
      .get('/director/requests')
      .then((reqs) => setPendingCount(reqs.filter((r) => r.status === 'PENDING_APPROVAL').length))
      .catch(() => {});
  }, [user]);

  if (!user || !['SCHOOL_DIRECTOR', 'ADMIN'].includes(user.role)) {
    return <Navigate to={getHomePath(user)} replace />;
  }

  const tabs = canManageFinance(user)
    ? [
        ...TABS,
        { to: 'subscriptions', icon: 'payments', key: 'subscriptions' },
        { to: 'finance', icon: 'account_balance_wallet', key: 'finance' }
      ]
    : TABS;

  return (
    <div className="director-space">
      <div className="space-head">
        <div>
          <h2>{t('director.title')}</h2>
          <p className="sub">{t('director.subtitle', { name: `${user.firstName} ${user.lastName}` })}</p>
        </div>
      </div>

      <PromoCarousel slides={[
        { key: 's1', image: '/dir-overview.webp', tone: 'navy', title: t('director.promo.s1t'), subtitle: t('director.promo.s1s') },
        { key: 's2', image: '/dir-stats.webp', tone: 'blue', title: t('director.promo.s2t'), subtitle: t('director.promo.s2s') },
        { key: 's3', image: '/dir-finance.webp', tone: 'gold', title: t('director.promo.s3t'), subtitle: t('director.promo.s3s') }
      ]} />

      <nav className="teacher-tabs">
        {tabs.map((tb) => (
          <NavLink key={tb.to} to={`/director/${tb.to}`} end={tb.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="material-icons">{tb.icon}</span>
            {t(`director.tabs.${tb.key}`)}
            {tb.key === 'requests' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="tab-content">
        <Suspense fallback={null}>
        <Routes>
          <Route index element={<DirectorHome />} />
          <Route path="requests" element={<DirectorRequests />} />
          <Route path="documents" element={<DirectorDocuments />} />
          <Route path="classes" element={<DirectorClasses />} />
          <Route path="calendar" element={<SchoolCalendar manageable />} />
          <Route path="notifications" element={<DirectorNotifications />} />
          {canManageFinance(user) && <Route path="subscriptions" element={<AdminSubscriptions />} />}
          {canManageFinance(user) && <Route path="finance" element={<FinanceDashboard />} />}
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
        </Suspense>
      </div>
    </div>
  );
}
