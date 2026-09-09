import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import Licenses from './Licenses.jsx';
import Subscriptions from './Subscriptions.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import Schools from './Schools.jsx';
import SpaceShell from '../../components/SpaceShell.jsx';

const TABS = [
  { to: '', end: true, icon: 'vpn_key', key: 'licenses', color: '#f59e0b' },
  { to: 'subscriptions', icon: 'subscriptions', key: 'subscriptions', color: '#0ea5e9' },
  { to: 'users', icon: 'manage_accounts', key: 'users', color: '#10b981' },
  { to: 'schools', icon: 'school', key: 'schools', color: '#8b5cf6' }
];

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="superadmin-space">
      <div className="container">
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
          <Routes>
            <Route index element={<Licenses />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="schools" element={<Schools />} />
          </Routes>
        </SpaceShell>
      </div>
    </div>
  );
}
