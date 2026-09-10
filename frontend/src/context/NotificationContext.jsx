import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useChat } from './ChatContext.jsx';
import { api } from '../api/client.js';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { subscribe } = useChat();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [preferences, setPreferences] = useState({ notifyEmail: false, notifyPush: true, notifySms: false });

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setRecent([]);
    }
  }, [user]);

  const refresh = useCallback(() => {
    if (!user) return Promise.resolve();
    return Promise.all([
      api
        .get('/notifications/unread-count')
        .then((d) => setUnreadCount(d.count || 0))
        .catch(() => {}),
      api
        .get('/notifications?limit=12')
        .then((d) => setRecent(d.items || []))
        .catch(() => {})
    ]);
  }, [user]);

  const refreshPreferences = useCallback(() => {
    if (!user) return Promise.resolve();
    return api
      .get('/notifications/preferences')
      .then(setPreferences)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user) {
      refresh();
      refreshPreferences();
    }
  }, [user, refresh, refreshPreferences]);

  useEffect(() => {
    if (!user) return undefined;
    return subscribe((data) => {
      if (data.type === 'notification:new') {
        setRecent((prev) => [data.notification, ...prev].slice(0, 12));
        setUnreadCount((prev) => prev + 1);
      } else if (data.type === 'notification:unread') {
        setUnreadCount(data.count || 0);
      }
    });
  }, [subscribe, user]);

  const markAllRead = useCallback(async () => {
    const d = await api.post('/notifications/read');
    setUnreadCount(d.unread || 0);
    setRecent((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback(async (id) => {
    const d = await api.post(`/notifications/${id}/read`);
    setUnreadCount(d.unread || 0);
    setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const updatePreferences = useCallback(async (prefs) => {
    const d = await api.put('/notifications/preferences', prefs);
    setPreferences(d);
    return d;
  }, []);

  const value = useMemo(
    () => ({ unreadCount, recent, preferences, refresh, markAllRead, markRead, updatePreferences }),
    [unreadCount, recent, preferences, refresh, markAllRead, markRead, updatePreferences]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
