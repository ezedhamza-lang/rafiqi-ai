import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
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

const TABS = [
  { to: '', end: true, icon: 'monitor_heart', key: 'progress' },
  { to: 'insights', icon: 'auto_awesome', key: 'insights' },
  { to: 'assignments', icon: 'assignment', key: 'assignments' },
  { to: 'live', icon: 'live_tv', key: 'live' },
  { to: 'analytics', icon: 'monitoring', key: 'analytics' },
  { to: 'notes', icon: 'rate_review', key: 'notes' },
  { to: 'messages', icon: 'chat', key: 'messages' },
  { to: 'report', icon: 'assessment', key: 'report' },
  { to: 'documents', icon: 'folder_shared', key: 'documents' },
  { to: 'health', icon: 'favorite', key: 'health' }
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

        <nav className="teacher-tabs">
          {TABS.map((tb) => (
            <NavLink key={tb.to} to={`/parent/${tb.to}`} end={tb.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="material-icons">{tb.icon}</span>
              {t(`parentSpace.tabs.${tb.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="tab-content">
          <Routes>
            <Route index element={<ChildProgress childrenData={children} />} />
            <Route path="insights" element={<ParentInsights childrenData={children} />} />
            <Route path="assignments" element={<ChildAssignments />} />
            <Route path="live" element={<ParentLiveSessions />} />
            <Route path="analytics" element={<ChildAnalytics childrenData={children} />} />
            <Route path="notes" element={<ParentNotes />} />
            <Route path="messages" element={<Messages onChanged={loadUnread} />} />
            <Route path="report" element={<WeeklyReport childrenData={children} />} />
            <Route path="documents" element={<ParentDocuments />} />
            <Route path="health" element={<ParentHealth />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
