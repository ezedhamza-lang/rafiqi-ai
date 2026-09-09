import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import ChildProgress from './ChildProgress.jsx';
import Messages from '../Messages.jsx';
import WeeklyReport from './WeeklyReport.jsx';
import ParentDocuments from './ParentDocuments.jsx';
import ParentHealth from './ParentHealth.jsx';
import ChildAssignments from './ChildAssignments.jsx';
import ChildAnalytics from './ChildAnalytics.jsx';
import ParentLiveSessions from './ParentLiveSessions.jsx';
import ParentInsights from './ParentInsights.jsx';
import ParentNotes from './ParentNotes.jsx';
import ChildCredentials from './ChildCredentials.jsx';
import SpaceShell from '../../components/SpaceShell.jsx';

const TABS = [
  { to: '', end: true, icon: 'monitor_heart', key: 'progress', color: '#10b981' },
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
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="parent-space">
      <div className="container">
        <div className="space-head">
          <div>
            <h2>{t('parentSpace.title')}</h2>
            <p className="sub">{t('parentSpace.subtitle', { name: `${user.firstName} ${user.lastName}` })}</p>
          </div>
          {unread > 0 && <div className="badge warn">🔔 {t('parentSpace.unreadMsg', { n: unread })}</div>}
        </div>

        <SpaceShell
          base="/parent"
          title={t('parentSpace.title')}
          storageKey="rafiqi-parent-sidebar"
          items={TABS.map((tb) => ({ ...tb, label: t(`parentSpace.tabs.${tb.key}`) }))}
        >
          <Routes>
            <Route index element={<ChildProgress childrenData={children} />} />
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
          </Routes>
        </SpaceShell>
      </div>
    </div>
  );
}
