import { useState, useEffect, useCallback , lazy, Suspense} from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath } from '../../roles.js';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
const ChildProgress = lazy(() => import('./ChildProgress.jsx'));
const Messages = lazy(() => import('../Messages.jsx'));
const WeeklyReport = lazy(() => import('./WeeklyReport.jsx'));
const ParentDocuments = lazy(() => import('./ParentDocuments.jsx'));
const ParentHealth = lazy(() => import('./ParentHealth.jsx'));
const ChildAssignments = lazy(() => import('./ChildAssignments.jsx'));
const ChildAnalytics = lazy(() => import('./ChildAnalytics.jsx'));
const ParentLiveSessions = lazy(() => import('./ParentLiveSessions.jsx'));
const ParentInsights = lazy(() => import('./ParentInsights.jsx'));
const ParentNotes = lazy(() => import('./ParentNotes.jsx'));
const ChildCredentials = lazy(() => import('./ChildCredentials.jsx'));
const ParentDashboard = lazy(() => import('./ParentDashboard.jsx'));
import SpaceShell from '../../components/SpaceShell.jsx';

const TABS = [
  { to: '', end: true, icon: 'monitor_heart', key: 'progress', color: '#10b981' },
  { to: 'overview', icon: 'dashboard', key: 'overview', color: '#ff6a00' },
  { to: 'insights', icon: 'auto_awesome', key: 'insights', color: '#8b5cf6' },
  { to: 'credentials', icon: 'vpn_key', key: 'credentials', color: '#f59e0b' },
  { to: 'assignments', icon: 'assignment', key: 'assignments', color: '#f97316' },
  { to: 'live', icon: 'live_tv', key: 'live', color: '#22c55e' },
  { to: 'analytics', icon: 'monitoring', key: 'analytics', color: '#0ea5e9' },
  { to: 'notes', icon: 'rate_review', key: 'notes', color: '#3b82f6' },
  { to: 'messages', icon: 'chat', key: 'messages', color: '#06b6d4' },
  { to: 'report', icon: 'assessment', key: 'report', color: '#8b5cf6' },
  { to: 'documents', icon: 'folder_shared', key: 'documents', color: '#14b8a6' },
  { to: 'health', icon: 'favorite', key: 'health', color: '#ec4899' }
];

const TAB_GROUPS = (t) => [
  { label: 'المتابعة', items: ['progress', 'overview', 'insights', 'analytics', 'report'].map((key) => tabByKey(t, key)) },
  { label: 'الحياة المدرسية', items: ['assignments', 'live', 'notes', 'documents', 'health'].map((key) => tabByKey(t, key)) },
  { label: 'الإدارة', items: ['credentials', 'messages'].map((key) => tabByKey(t, key)) },
];

function tabByKey(t, key) {
  const tb = TABS.find((x) => x.key === key);
  return { ...tb, label: t(`parentSpace.tabs.${tb.key}`) };
}

export default function ParentSpace() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [children, setChildren] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api
      .get('/parent/children/progress')
      .then(setChildren)
      .catch(() => {});
  }, []);

  const loadUnread = useCallback(() => {
    api
      .get('/messages/conversations')
      .then((conv) => setUnread(conv.reduce((acc, c) => acc + c.unread, 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadUnread();
  }, [load, loadUnread]);

  if (!user || user.role !== 'PARENT') {
    return <Navigate to={getHomePath(user)} replace />;
  }

  return (
    <div className="parent-space">
      <div className="space-head">
        <div>
          <h2>{t('parentSpace.title')}</h2>
          <p className="sub">{t('parentSpace.subtitle', { name: `${user.firstName} ${user.lastName}` })}</p>
        </div>
        {unread > 0 && <div className="badge warn"><span className="material-icons" style={{ fontSize: '1rem' }}>mark_chat_unread</span> {t('parentSpace.unreadMsg', { n: unread })}</div>}
      </div>

      <SpaceShell
        base="/parent"
        title={t('parentSpace.title')}
        storageKey="rafiqi-parent-sidebar"
        sections={TAB_GROUPS(t)}
      >
        <Suspense fallback={null}>
        <Routes>
          <Route index element={<ChildProgress childrenData={children} />} />
          <Route path="overview" element={<ParentDashboard childrenData={children} />} />
          <Route path="insights" element={<ParentInsights childrenData={children} />} />
          <Route path="credentials" element={<ChildCredentials />} />
          <Route path="assignments" element={<ChildAssignments />} />
          <Route path="live" element={<ParentLiveSessions />} />
          <Route path="analytics" element={<ChildAnalytics childrenData={children} />} />
          <Route path="notes" element={<ParentNotes />} />
          <Route path="messages" element={<Messages onChanged={loadUnread} />} />
          <Route path="report" element={<WeeklyReport childrenData={children} />} />
          <Route path="documents" element={<ParentDocuments />} />
          <Route path="health" element={<ParentHealth />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Suspense>
      </SpaceShell>
    </div>
  );
}
