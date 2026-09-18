import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import MiniLanguageSwitcher from './LanguageSwitcher.jsx';
import { roleLabel, getHomePath } from '../roles.js';
import { timeAgo as timeAgoUtil } from '../utils/formatUtils.js';


const PUBLIC_NAV = [
  { to: '/', icon: 'home', key: 'home' },
  { to: '/student', icon: 'school', key: 'studentSection' },
  { to: '/help', icon: 'support_agent', key: 'help' }
];

const MESSAGES_NAV = { to: '/messages', icon: 'mail', key: 'messages', unread: true };
const NOTIF_NAV = { to: '/message-center', icon: 'notifications_active', key: 'notifications', notif: true };

const SUPERADMIN_SPACE_CHILDREN = [
  { to: '/superadmin', end: true, icon: 'admin_panel_settings', key: 'systemSpace' },
  { to: '/help', icon: 'support_agent', key: 'help', divider: true }
];

const DIRECTOR_SPACE_CHILDREN = [
  { to: '/director', end: true, icon: 'dashboard', key: 'dashboard' },
  { to: '/director/requests', icon: 'how_to_reg', key: 'registrationRequests' },
  { to: '/director/documents', icon: 'folder_shared', key: 'adminDocuments' },
  { to: '/director/classes', icon: 'school', key: 'classesPerf' },
  { to: '/director/calendar', icon: 'calendar_month', key: 'directorCalendar' },
  { to: '/director/notifications', icon: 'notifications', key: 'directorNotifications' }
];

const DIRECTOR_FINANCE_CHILDREN = [
  { to: '/director/subscriptions', icon: 'payments', key: 'subscriptionsRevenue' },
  { to: '/director/finance', icon: 'account_balance_wallet', key: 'financeBoard' }
];

const DIRECTOR_HELP_CHILD = { to: '/help', icon: 'support_agent', key: 'help', divider: true };

const PARENT_SPACE_CHILDREN = [
  { to: '/parent', end: true, icon: 'family_restroom', key: 'parentSpace' },
  { to: '/parent/assignments', icon: 'assignment', key: 'parentAssignments' },
  { to: '/parent/live', icon: 'live_tv', key: 'parentLive' },
  { to: '/parent/analytics', icon: 'monitoring', key: 'analytics' },
  { to: '/parent/notes', icon: 'rate_review', key: 'parentNotes' },
  { to: '/dashboard', icon: 'dashboard', key: 'indicatorsSummary' },
  { to: '/students', icon: 'groups', key: 'myChildren' },
  { to: '/registration', icon: 'person_add', key: 'newRegistration' },
  { to: '/my-requests', icon: 'folder_open', key: 'myRequests' },
  { to: '/payment', icon: 'payments', key: 'payment' },
  { to: '/help', icon: 'support_agent', key: 'help' }
];

const ROLE_NAV = {
  TEACHER: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/teacher', icon: 'co_present', key: 'teacherSpace' },
    NOTIF_NAV,
    MESSAGES_NAV
  ],
  STUDENT: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/student-space', icon: 'school', key: 'studentSpace' },
    NOTIF_NAV
  ],
  PARENT: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/parent', icon: 'family_restroom', key: 'parentSpace', children: PARENT_SPACE_CHILDREN },
    NOTIF_NAV,
    MESSAGES_NAV
  ],
  SCHOOL_DIRECTOR: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/director', icon: 'admin_panel_settings', key: 'adminBoard', children: [...DIRECTOR_SPACE_CHILDREN, DIRECTOR_HELP_CHILD] },
    NOTIF_NAV,
    MESSAGES_NAV
  ],
  ADMIN: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/director', icon: 'admin_panel_settings', key: 'adminBoard', children: [...DIRECTOR_SPACE_CHILDREN, ...DIRECTOR_FINANCE_CHILDREN, DIRECTOR_HELP_CHILD] },
    NOTIF_NAV,
    MESSAGES_NAV
  ],
  SUPER_ADMIN: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/superadmin', icon: 'admin_panel_settings', key: 'systemSpace', children: SUPERADMIN_SPACE_CHILDREN },
    NOTIF_NAV,
    MESSAGES_NAV
  ]
};

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, t } = useI18n();
  const { unread: msgUnread, connected } = useChat();
  const { unreadCount, recent, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const navItems = user ? ROLE_NAV[user.role] || PUBLIC_NAV : PUBLIC_NAV;

  useEffect(() => {
    function onDocClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const goHome = () => {
    navigate(getHomePath(user));
  };

  const renderBadge = (item) => {
    if (item.notif && unreadCount > 0) {
      return <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>;
    }
    if (item.unread && msgUnread > 0) {
      return <span className="nav-badge">{msgUnread}</span>;
    }
    return null;
  };

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="brand">
          <img src="/logo-rafiqi.png" alt={t('header.brandAlt')} className="brand-owl" />
          <div className="brand-text">
            <h6>{t('header.brandTitle')}</h6>
          </div>
        </div>
        <div className="header-actions">
          {/* Batch 6: Enhanced Language Switcher */}
          <MiniLanguageSwitcher />
          <button
            className="icon-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
            title={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
          >
            <span className="material-icons">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          {user && (
            <div className="notif-bell-wrap" ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setNotifOpen((o) => !o)}
                title={t('header.notifications')}
                aria-label={t('header.notifications')}
                aria-expanded={notifOpen}
              >
                <span className="material-icons">notifications</span>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-head">
                    <strong>{t('header.notifications')}</strong>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        markAllRead();
                      }}
                    >
                      {t('header.markAllRead')}
                    </button>
                  </div>
                  <div className="notif-dropdown-list">
                    {recent.length === 0 && <p className="muted" style={{ padding: '0.8rem' }}>{t('header.noNotifications')}</p>}
                    {recent.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        className={`notif-item ${n.read ? '' : 'unread'}`}
                        onClick={() => {
                          setNotifOpen(false);
                          navigate(n.link || '/message-center');
                        }}
                      >
                        <span className="notif-body">
                          <span className="notif-title">{n.title}</span>
                          <span className="notif-meta">
                            <span className="muted">{timeAgoUtil(n.createdAt, lang, t)}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="notif-dropdown-foot">
                    <Link to="/message-center" onClick={() => setNotifOpen(false)}>
                      {t('header.viewAll')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          {user ? (
            <>
              <button className="icon-btn" title={t('header.account')} aria-label={t('header.account')} onClick={() => navigate('/account')} style={{ position: 'relative' }}>
                <span className="material-icons">person</span>
                {user.mustChangePassword && <span className="notif-badge">!</span>}
              </button>
              <button className="icon-btn" title={t('header.myBoard')} aria-label={t('header.myBoard')} onClick={goHome}>
                <span className="material-icons">grid_view</span>
              </button>
              {['TEACHER', 'ADMIN', 'SCHOOL_DIRECTOR'].includes(user.role) && (
                <a className="icon-btn" href="/teacher-guide.pdf" target="_blank" rel="noreferrer" title={t('header.teacherGuide')} aria-label={t('header.teacherGuide')}>
                  <span className="material-icons">menu_book</span>
                </a>
              )}
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                {t('header.logout')}
              </button>
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                {user.firstName} {user.lastName}
                <span className="role-chip">({roleLabel(t, user.role) || t('header.userFallback')})</span>
              </span>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                {t('header.login')}
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                {t('header.createAccount')}
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="navbar" aria-label={t('header.mainNav')}>
        <button
          className="nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          aria-label={t('header.navMenu')}
        >
          <span className="material-icons">{menuOpen ? 'close' : 'menu'}</span>
        </button>
        <ul id="main-nav" className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {navItems.map((item) =>
            item.children ? (
              <li key={item.to} className="has-dropdown">
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="material-icons" aria-hidden="true">{item.icon}</span>
                  {t(`nav.${item.key}`)}
                  {renderBadge(item)}
                  <span className="material-icons dropdown-caret" aria-hidden="true">expand_more</span>
                </NavLink>
                <ul className={`dropdown-menu${item.key === 'studentSpace' ? ' dropdown-menu--wide' : ''}`}>
                  {item.children.map((child, ci) => (
                    <li key={child.to || child.group || ci} className={`${child.divider ? 'dropdown-divider' : ''} ${child.group ? 'dropdown-group-header' : ''}`}>
                      {child.group ? (
                        <span className="dropdown-group-label" style={{ '--group-color': child.groupColor }}>
                          <span className="material-icons" style={{ color: child.groupColor }}>{child.groupIcon}</span>
                          {t(`nav.groups.${child.group}`)}
                        </span>
                      ) : (
                        <NavLink
                          to={child.to}
                          end={child.end}
                          className={({ isActive }) => (isActive ? 'active' : '')}
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="material-icons" aria-hidden="true">{child.icon}</span>
                          {t(`nav.${child.key}`)}
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="material-icons" aria-hidden="true">{item.icon}</span>
                  {t(`nav.${item.key}`)}
                  {renderBadge(item)}
                  {item.unread && (
                    <span
                      className={`nav-live ${connected ? '' : 'off'}`}
                      title={connected ? t('header.liveChatConnected') : t('header.liveChatOffline')}
                    />
                  )}
                </NavLink>
              </li>
            )
          )}
        </ul>
      </nav>
    </header>
  );
}
