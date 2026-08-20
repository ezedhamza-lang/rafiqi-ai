import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import Licenses from './Licenses.jsx';
import Subscriptions from './Subscriptions.jsx';
import UsersAdmin from './UsersAdmin.jsx';

const TABS = [
  { to: '', end: true, icon: 'vpn_key', key: 'licenses' },
  { to: 'subscriptions', icon: 'subscriptions', key: 'subscriptions' },
  { to: 'users', icon: 'manage_accounts', key: 'users' }
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

        <nav className="teacher-tabs">
          {TABS.map((tb) => (
            <NavLink key={tb.to} to={`/superadmin/${tb.to}`} end={tb.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="material-icons">{tb.icon}</span>
              {t(`superadmin.tabs.${tb.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="tab-content">
          <Routes>
            <Route index element={<Licenses />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="users" element={<UsersAdmin />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
