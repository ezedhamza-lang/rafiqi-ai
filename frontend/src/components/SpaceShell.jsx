import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

/**
 * SpaceShell — تخطيط موحّد: Sidebar جانبية (يمين RTL / يسار LTR) + مساحة محتوى.
 * items: [{ to, end?, icon, key|label, color }] ; base: بادئة المسار ; children: المحتوى/الـRoutes.
 */
export default function SpaceShell({ items, base, title, storageKey = 'rafiqi-sidebar', children }) {
  const { t } = useI18n();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded'); }, [collapsed, storageKey]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const aside = (
    <aside className={`student-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="student-sidebar-head">
        <span className="student-sidebar-title">{title}</span>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t('studentSpace.expand') : t('studentSpace.collapse')}
          title={collapsed ? t('studentSpace.expand') : t('studentSpace.collapse')}
        >
          <span className="material-icons">{collapsed ? 'chevron_left' : 'chevron_right'}</span>
        </button>
      </div>
      <nav className="student-sidebar-nav">
        {items.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to === '' ? base : `${base}/${tab.to}`}
            end={tab.end}
            className={({ isActive }) => `student-nav-item ${isActive ? 'active' : ''}`}
            style={{ '--c': tab.color || '#38bdf8' }}
            title={tab.label || t(tab.key)}
          >
            <span className="nav-dot" aria-hidden="true" />
            <span className="material-icons nav-ico">{tab.icon}</span>
            <span className="nav-label">{tab.label || t(tab.key)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="student-layout">
      {aside}
      <div className="tab-content student-main">{children}</div>

      <button type="button" className="sidebar-fab" onClick={() => setMobileOpen(true)} aria-label={t('studentSpace.menu')}>
        <span className="material-icons">menu</span>
      </button>

      {mobileOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="student-sidebar-drawer">{aside}</div>
        </>
      )}
    </div>
  );
}
