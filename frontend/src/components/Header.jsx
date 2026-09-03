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

const TEACHER_DROPDOWN_CATEGORIES = [
  { id: 'assessment', label: 'التقييم والاختبارات', color: '#ef4444', icon: 'grading' },
  { id: 'results', label: 'النتائج والإحصائيات', color: '#22c55e', icon: 'analytics' },
  { id: 'content', label: 'المحتوى والتدريس', color: '#3b82f6', icon: 'school' },
  { id: 'classroom', label: 'الفصل الدراسي', color: '#f59e0b', icon: 'groups' },
  { id: 'tools', label: 'الأدوات والتواصل', color: '#8b5cf6', icon: 'smart_toy' },
  { id: 'settings', label: 'إعدادات', color: '#6b7280', icon: 'settings' }
];

const TEACHER_SPACE_CHILDREN = [
  { to: '/teacher', end: true, icon: 'analytics', key: 'unitAnalysis', category: 'assessment' },
  { to: '/teacher/quizzes', icon: 'quiz', key: 'quizzes', category: 'assessment' },
  { to: '/teacher/exams', icon: 'fact_check', key: 'officialExams', category: 'assessment' },
  { to: '/teacher/exam-generator', icon: 'download', key: 'examGenerator', category: 'assessment' },
  { to: '/teacher/correction', icon: 'grading', key: 'correction', category: 'assessment' },
  { to: '/teacher/results', icon: 'scoreboard', key: 'results', category: 'results' },
  { to: '/teacher/averages', icon: 'percent', key: 'averages', category: 'results' },
  { to: '/teacher/gradebook', icon: 'menu_book', key: 'gradebook', category: 'results' },
  { to: '/teacher/analytics', icon: 'monitoring', key: 'analyticsExport', category: 'results' },
  { to: '/teacher/class-subjects', icon: 'category', key: 'classSubjects', category: 'content' },
  { to: '/teacher/lesson-plan', icon: 'calendar_month', key: 'lessonPlan', category: 'content' },
  { to: '/teacher/plans', icon: 'event_note', key: 'annualPlans', category: 'content' },
  { to: '/teacher/lesson-progress', icon: 'fact_check', key: 'lessonProgress', category: 'content' },
  { to: '/teacher/resources', icon: 'folder_special', key: 'resources', category: 'content' },
  { to: '/teacher/library', icon: 'local_library', key: 'library', category: 'content' },
  { to: '/teacher/assignments', icon: 'assignment', key: 'assignments', category: 'classroom' },
  { to: '/teacher/attendance', icon: 'fact_check', key: 'attendance', category: 'classroom' },
  { to: '/teacher/notes', icon: 'rate_review', key: 'teacherNotes', category: 'classroom' },
  { to: '/teacher/memos', icon: 'description', key: 'memos', category: 'classroom' },
  { to: '/teacher/health', icon: 'favorite', key: 'health', category: 'classroom' },
  { to: '/teacher/ai', icon: 'smart_toy', key: 'teacherAI', category: 'tools' },
  { to: '/teacher/schedules', icon: 'calendar_view_week', key: 'schedules', category: 'tools' },
  { to: '/teacher/live', icon: 'live_tv', key: 'live', category: 'tools' },
  { to: '/teacher/suggestions', icon: 'lightbulb', key: 'suggestions', category: 'tools' },
  { to: '/payment', icon: 'payments', key: 'payment', category: 'settings' },
  { to: '/help', icon: 'support_agent', key: 'help', divider: true, category: 'settings' }
];

const SUPERADMIN_SPACE_CHILDREN = [
  { to: '/superadmin', end: true, icon: 'admin_panel_settings', key: 'systemSpace' },
  { to: '/help', icon: 'support_agent', key: 'help', divider: true }
];

const STUDENT_DROPDOWN_CATEGORIES = [
  { id: 'home', label: 'ملخصي', color: '#3b82f6', icon: 'home' },
  { id: 'learning', label: 'التعلم والدراسة', color: '#22c55e', icon: 'menu_book' },
  { id: 'activities', label: 'النشاطات والترفيه', color: '#f59e0b', icon: 'sports_esports' },
  { id: 'ai', label: 'الذكاء الاصطناعي', color: '#8b5cf6', icon: 'smart_toy' },
  { id: 'settings', label: 'إعدادات', color: '#6b7280', icon: 'settings' }
];

const STUDENT_SPACE_CHILDREN = [
  { to: '/student-space', end: true, icon: 'home', key: 'mySummary', category: 'home' },
  { to: '/student-space/subjects', icon: 'menu_book', key: 'mySubjects', category: 'learning' },
  { to: '/student-space/quizzes', icon: 'quiz', key: 'myQuizzes', category: 'learning' },
  { to: '/student-space/assignments', icon: 'assignment', key: 'myAssignments', category: 'learning' },
  { to: '/student-space/flashcards', icon: 'style', key: 'myFlashcards', category: 'learning' },
  { to: '/student-space/paper-exam', icon: 'document_scanner', key: 'paperExam', category: 'learning' },
  { to: '/student-space/routine', icon: 'today', key: 'myRoutine', category: 'activities' },
  { to: '/student-space/live', icon: 'live_tv', key: 'myLive', category: 'activities' },
  { to: '/student-space/play', icon: 'sports_esports', key: 'playZone', category: 'activities' },
  { to: '/student-space/books', icon: 'auto_stories', key: 'myBooks', category: 'activities' },
  { to: '/student-space/stories', icon: 'library_books', key: 'storyLibrary', category: 'activities' },
  { to: '/student-space/calendar', icon: 'calendar_month', key: 'schoolCalendar', category: 'activities' },
  { to: '/student-space/schedule', icon: 'calendar_view_week', key: 'mySchedule', category: 'activities' },
  { to: '/student-space/refeeqi', icon: 'smart_toy', key: 'askRefeeqi', category: 'ai' },
  { to: '/student-space/twin', icon: 'insights', key: 'digitalTwin', category: 'ai' },
  { to: '/help', icon: 'support_agent', key: 'help', divider: true, category: 'settings' }
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

const PARENT_DROPDOWN_CATEGORIES = [
  { id: 'dashboard', label: 'لوحة التحكم', color: '#3b82f6', icon: 'dashboard' },
  { id: 'monitoring', label: 'متابعة الطفل', color: '#22c55e', icon: 'monitoring' },
  { id: 'admin', label: 'الإدارة والتسجيل', color: '#f59e0b', icon: 'admin_panel_settings' },
  { id: 'settings', label: 'إعدادات', color: '#6b7280', icon: 'settings' }
];

const PARENT_SPACE_CHILDREN = [
  { to: '/parent', end: true, icon: 'family_restroom', key: 'parentSpace', category: 'dashboard' },
  { to: '/dashboard', icon: 'dashboard', key: 'indicatorsSummary', category: 'dashboard' },
  { to: '/parent/analytics', icon: 'monitoring', key: 'analytics', category: 'monitoring' },
  { to: '/parent/assignments', icon: 'assignment', key: 'parentAssignments', category: 'monitoring' },
  { to: '/parent/live', icon: 'live_tv', key: 'parentLive', category: 'monitoring' },
  { to: '/parent/notes', icon: 'rate_review', key: 'parentNotes', category: 'monitoring' },
  { to: '/students', icon: 'groups', key: 'myChildren', category: 'admin' },
  { to: '/registration', icon: 'person_add', key: 'newRegistration', category: 'admin' },
  { to: '/my-requests', icon: 'folder_open', key: 'myRequests', category: 'admin' },
  { to: '/payment', icon: 'payments', key: 'payment', category: 'settings' },
  { to: '/help', icon: 'support_agent', key: 'help', category: 'settings' }
];

const ROLE_NAV = {
  TEACHER: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/teacher', icon: 'co_present', key: 'teacherSpace', children: TEACHER_SPACE_CHILDREN, categories: TEACHER_DROPDOWN_CATEGORIES },
    NOTIF_NAV,
    MESSAGES_NAV
  ],
  STUDENT: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/student-space', icon: 'school', key: 'studentSpace', children: STUDENT_SPACE_CHILDREN, categories: STUDENT_DROPDOWN_CATEGORIES },
    NOTIF_NAV
  ],
  PARENT: [
    { to: '/', icon: 'home', key: 'home' },
    { to: '/parent', icon: 'family_restroom', key: 'parentSpace', children: PARENT_SPACE_CHILDREN, categories: PARENT_DROPDOWN_CATEGORIES },
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
  const [openDropdown, setOpenDropdown] = useState(null);
  const notifRef = useRef(null);
  const navRef = useRef(null);

  const navItems = user ? ROLE_NAV[user.role] || PUBLIC_NAV : PUBLIC_NAV;

  useEffect(() => {
    function onDocClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (navRef.current && !navRef.current.contains(e.target)) setOpenDropdown(null);
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
          <img src="/logo-rafiqi.png" alt={t('header.brandAlt')} />
          <div className="brand-text">
            <h6>{t('header.brandTitle')}</h6>
          </div>
        </div>
        <div className="header-actions">
          {/* Batch 6: Enhanced Language Switcher */}
          <MiniLanguageSwitcher 
            onLanguageChange={(newLang, dir) => {
              console.log(`Language changed to: ${newLang}, direction: ${dir}`);
            }} 
          />
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
              <button className="icon-btn" title={t('header.myBoard')} aria-label={t('header.myBoard')} onClick={goHome}>
                <span className="material-icons">grid_view</span>
              </button>
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
        <ul id="main-nav" className={`nav-links ${menuOpen ? 'open' : ''}`} ref={navRef}>
          {navItems.map((item) =>
            item.children ? (
              <li key={item.to} className={`has-dropdown ${openDropdown === item.key ? 'open' : ''}`}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => {
                    setMenuOpen(false);
                    setOpenDropdown(null);
                  }}
                >
                  <span className="material-icons" aria-hidden="true">{item.icon}</span>
                  {t(`nav.${item.key}`)}
                  {renderBadge(item)}
                </NavLink>
                <button
                  type="button"
                  className="dropdown-toggle"
                  aria-label={t('header.toggleMenu')}
                  aria-expanded={openDropdown === item.key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenDropdown((cur) => (cur === item.key ? null : item.key));
                  }}
                >
                  <span className="material-icons dropdown-caret" aria-hidden="true">expand_more</span>
                </button>
                <ul className="dropdown-menu">
                  {item.categories && (
                    (() => {
                      let lastCat = null;
                      return item.children.map((child) => {
                        const catDef = child.category ? item.categories.find(c => c.id === child.category) : null;
                        const showCatHeader = catDef && catDef.id !== lastCat;
                        if (showCatHeader) lastCat = catDef.id;
                        return (
                          <li key={child.to} className={child.divider ? 'dropdown-divider' : ''}>
                            {showCatHeader && (
                              <div className="dropdown-cat-header" style={{ '--cat-color': catDef.color }}>
                                <span className="material-icons" style={{ fontSize: 15 }}>{catDef.icon}</span>
                                <span>{catDef.label}</span>
                              </div>
                            )}
                            <NavLink
                              to={child.to}
                              end={child.end}
                              className={({ isActive }) => (isActive ? 'active' : '')}
                              onClick={() => {
                                setMenuOpen(false);
                                setOpenDropdown(null);
                              }}
                            >
                              <span className="material-icons" aria-hidden="true">{child.icon}</span>
                              {t(`nav.${child.key}`)}
                            </NavLink>
                          </li>
                        );
                      });
                    })()
                  )}
                  {!item.categories && item.children.map((child) => (
                    <li key={child.to} className={child.divider ? 'dropdown-divider' : ''}>
                      <NavLink
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                        onClick={() => {
                          setMenuOpen(false);
                          setOpenDropdown(null);
                        }}
                      >
                        <span className="material-icons" aria-hidden="true">{child.icon}</span>
                        {t(`nav.${child.key}`)}
                      </NavLink>
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
