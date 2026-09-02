import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getToken, api } from '../api/client.js';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const enabled = !!user && user.role !== 'STUDENT';

  const refreshUnread = useCallback(() => {
    if (!enabled) {
      setUnread(0);
      return Promise.resolve();
    }
    return api
      .get('/messages/unread-count')
      .then((d) => setUnread(d.count || 0))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread, user?.id]);

  useEffect(() => {
    if (!enabled) return undefined;
    let ws;
    let disposed = false;
    let retry = 0;

    const connect = () => {
      const token = getToken();
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // إرسال التوكن عبر Sec-WebSocket-Protocol (لا يظهر في السجلات) مع تراجع لـ query للتوافق
      ws = token
        ? new WebSocket(`${proto}://${window.location.host}/ws`, [`Bearer ${token}`])
        : new WebSocket(`${proto}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        refreshUnread();
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'unread') setUnread(data.count || 0);
          listenersRef.current.forEach((fn) => fn(data));
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (disposed) return;
        retry += 1;
        setTimeout(() => {
          if (!disposed) connect();
        }, Math.min(30000, 1000 * 2 ** retry));
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      wsRef.current = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, refreshUnread]);

  const sendEvent = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const value = { unread, refreshUnread, sendEvent, subscribe, connected };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  return useContext(ChatContext);
}
