import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import DirectorHome from './DirectorHome.jsx';
import DirectorClasses from './DirectorClasses.jsx';
import DirectorNotifications from './DirectorNotifications.jsx';
import DirectorRequests from './DirectorRequests.jsx';
import DirectorDocuments from './DirectorDocuments.jsx';
import AdminSubscriptions from './AdminSubscriptions.jsx';
import FinanceDashboard from './FinanceDashboard.jsx';
import SchoolCalendar from '../../components/SchoolCalendar.jsx';
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
      <div className="container">
        <div className="space-head">
          <div>
            <h2>{t('director.title')}</h2>
            <p className="sub">{t('director.subtitle', { name: `${user.firstName} ${user.lastName}` })}</p>
          </div>
          {pendingCount > 0 && (
            <div className="badge warn">🔔 {t('director.pendingBadge', { n: pendingCount })}</div>
          )}
        </div>

        <nav className="teacher-tabs">
          {tabs.map((tb) => (
            <NavLink key={tb.to} to={`/director/${tb.to}`} end={tb.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="material-icons">{tb.icon}</span>
              {t(`director.tabs.${tb.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="tab-content">
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
        </div>
      </div>
    </div>
  );
}
