import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath } from '../../roles.js';
import { useI18n } from '../../i18n/index.jsx';
const Overview = lazy(() => import('./Overview.jsx'));
const Licenses = lazy(() => import('./Licenses.jsx'));
const Subscriptions = lazy(() => import('./Subscriptions.jsx'));
const UsersAdmin = lazy(() => import('./UsersAdmin.jsx'));
const Schools = lazy(() => import('./Schools.jsx'));
const AdminSubscriptions = lazy(() => import('../director/AdminSubscriptions.jsx'));
const FinanceDashboard = lazy(() => import('../director/FinanceDashboard.jsx'));
const DirectorNotifications = lazy(() => import('../director/DirectorNotifications.jsx'));
const AdminAiKey = lazy(() => import('../AdminAiKey.jsx'));
import SpaceShell from '../../components/SpaceShell.jsx';

const TABS = [
  { to: '', end: true, icon: 'insights', key: 'overview', color: '#6366f1' },
  { to: 'users', icon: 'manage_accounts', key: 'users', color: '#10b981' },
  { to: 'schools', icon: 'school', key: 'schools', color: '#8b5cf6' },
  { to: 'licenses', icon: 'vpn_key', key: 'licenses', color: '#E8A317' },
  { to: 'subscriptions', icon: 'subscriptions', key: 'subscriptions', color: '#0ea5e9' },
  { to: 'billing', icon: 'receipt_long', key: 'billing', color: '#06b6d4' },
  { to: 'finance', icon: 'account_balance_wallet', key: 'finance', color: '#f43f5e' },
  { to: 'broadcast', icon: 'campaign', key: 'broadcast', color: '#ef4444' },
  { to: 'ai-key', icon: 'smart_toy', key: 'aiKey', color: '#ec4899' }
];

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to={getHomePath(user)} replace />;
  }

  return (
    <div className="superadmin-space">
      <div className="space-head">
        <div>
          <h2>{t('superadmin.title')}</h2>
          <p className="sub">{t('superadmin.subtitle')}</p>
        </div>
      </div>

      <SpaceShell
        base="/superadmin"
        title={t('superadmin.title')}
        storageKey="rafiqi-super-sidebar"
        items={TABS.map((tb) => ({ ...tb, label: t(`superadmin.tabs.${tb.key}`) }))}
      >
        <Suspense fallback={null}>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="schools" element={<Schools />} />
          <Route path="licenses" element={<Licenses />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="billing" element={<AdminSubscriptions />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="broadcast" element={<DirectorNotifications />} />
          <Route path="ai-key" element={<AdminAiKey />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Suspense>
      </SpaceShell>
    </div>
  );
}
