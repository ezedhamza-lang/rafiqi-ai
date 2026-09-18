import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import DarkModeToggle from './DarkModeToggle.jsx';

/**
 * SpaceShell — Sidebar موحّدة (يمين RTL / يسار LTR)، أخفّ بصريًا، بمجموعات منطقية.
 * إما items=[{to,end,icon,key|label,color}] مسطّح،
 * أو sections=[{label, items:[...]}] للمجموعات.
 */
export default function SpaceShell({ base, title, storageKey = 'rafiqi-sidebar', items, sections, children, fullWidth, hideThemeToggle = false }) {
  const { t } = useI18n();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded'); }, [collapsed, storageKey]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const groups = sections && sections.length ? sections : [{ label: null, items: items || [] }];

  const linkFor = (tab) => (
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
  );

  const aside = (
    <aside className={`student-sidebar is-light ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="student-sidebar-head">
        <span className="student-sidebar-title">{title}</span>
        {!hideThemeToggle && <DarkModeToggle />}
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
        {groups.map((g, gi) => (
          <div className="sidebar-group" key={g.label || gi}>
            {g.label && !collapsed && <div className="sidebar-group-label">{g.label}</div>}
            {g.label && collapsed && <div className="sidebar-group-sep" aria-hidden="true" />}
            {g.items.map(linkFor)}
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className={`student-layout ${fullWidth ? 'is-fullwidth' : ''}`}>
      {!fullWidth && aside}
      <div className={`tab-content student-main${fullWidth ? ' fullwidth' : ''}`}>{children}</div>

      <button type="button" className="sidebar-fab" onClick={() => setMobileOpen(true)} aria-label={t('studentSpace.menu')}>
        <span className="material-icons">menu</span>
      </button>

      {mobileOpen && (
        <>
          <div className="sidebar-backdrop" aria-hidden="true" onClick={() => setMobileOpen(false)} />
          <div className="student-sidebar-drawer" role="dialog" aria-modal="true" aria-label={title}>
            {aside}
            <button type="button" className="drawer-close" onClick={() => setMobileOpen(false)} aria-label={t('common.close')}>
              <span className="material-icons">close</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
