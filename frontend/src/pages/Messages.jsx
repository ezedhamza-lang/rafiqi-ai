import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { roleLabel } from '../roles.js';
import { timeAgo as timeAgoUtil, fullDate as fullDateUtil } from '../utils/formatUtils.js';


export default function Messages({ onChanged }) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const { refreshUnread, sendEvent, subscribe, connected } = useChat();
  const canArchive = user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const [recipients, setRecipients] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);

  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState([]);
  const [archiveActive, setArchiveActive] = useState(null);
  const [archiveMsgs, setArchiveMsgs] = useState([]);

  const [typingFrom, setTypingFrom] = useState(null);

  const [form, setForm] = useState({ recipientId: '', subject: '', body: '' });
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = active;

  const loadConversations = useCallback(() => {
    api
      .get('/messages/conversations')
      .then((conv) => {
        setConversations(conv);
        onChanged && onChanged();
      })
      .catch(() => {});
  }, [onChanged]);

  useEffect(() => {
    Promise.all([api.get('/messages/recipients'), loadConversations()])
      .then(([r]) => setRecipients(r))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, archiveMsgs]);

  const openConversation = async (other) => {
    setShowArchive(false);
    setArchiveActive(null);
    setActive(other);
    try {
      setMessages(await api.get(`/messages/messages/${other.id}`));
      loadConversations();
    } catch (err) {
      setError(err.message);
    }
  };

  const openArchive = async () => {
    setShowArchive(true);
    setActive(null);
    setArchiveActive(null);
    setMessages([]);
    try {
      setArchive(await api.get('/messages/archive'));
    } catch (err) {
      setError(err.message);
    }
  };

  const openArchiveConv = async (conv) => {
    setArchiveActive(conv);
    try {
      const msgs = await api.get(`/messages/archive/conversation?userA=${conv.users[0].id}&userB=${conv.users[1].id}`);
      setArchiveMsgs(msgs);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribe((data) => {
      if (data.type === 'message:new' && data.message && data.message.recipientId === user?.id) {
        const current = activeRef.current;
        if (current && data.message.senderId === current.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          sendEvent({ type: 'message:read', senderId: data.message.senderId });
        } else {
          loadConversations();
        }
        refreshUnread();
      } else if (data.type === 'typing' && data.from) {
        const current = activeRef.current;
        if (current && data.from === current.id) {
          if (data.active) {
            setTypingFrom(current.id);
          } else {
            setTypingFrom((prev) => (prev === current.id ? null : prev));
          }
        }
      } else if (data.type === 'message:read' && data.readerId) {
        const current = activeRef.current;
        if (current && data.readerId === current.id) {
          const now = new Date().toISOString();
          setMessages((prev) => prev.map((m) => (m.senderId === user?.id && !m.readAt ? { ...m, readAt: now } : m)));
        }
      } else if (data.type === 'message:error') {
        setError(data.error || t('messages.errorSend'));
      }
    });
    return unsubscribe;
  }, [subscribe, user, loadConversations, refreshUnread, sendEvent, t]);

  const emitTyping = useCallback(
    (active) => {
      const current = activeRef.current;
      if (!current) return;
      sendEvent({ type: 'typing', recipientId: current.id, active });
    },
    [sendEvent]
  );

  const handleBodyChange = (e) => {
    setForm((prev) => ({ ...prev, body: e.target.value }));
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1200);
  };

  useEffect(() => {
    return () => clearTimeout(typingTimer.current);
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!form.recipientId || !form.body.trim()) {
      setError(t('messages.errorNoRecipient'));
      return;
    }
    setSending(true);
    setError('');
    const fd = new FormData();
    fd.append('recipientId', form.recipientId);
    if (form.subject.trim()) fd.append('subject', form.subject.trim());
    fd.append('body', form.body.trim());
    if (file) fd.append('attachment', file);
    try {
      const rec = recipients.find((r) => r.id === Number(form.recipientId)) || {};
      await api.post('/messages/messages', fd);
      emitTyping(false);
      setForm({ recipientId: '', subject: '', body: '' });
      setFile(null);
      setShowArchive(false);
      setArchiveActive(null);
      setActive(rec);
      setMessages(await api.get(`/messages/messages/${rec.id}`));
      loadConversations();
      refreshUnread();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (user && user.role === 'STUDENT') {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>{t('messages.title')}</h3>
        </div>
        <p className="muted">{t('messages.studentNotAllowed')}</p>
      </div>
    );
  }

  const list = showArchive ? archive : conversations;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>
          {t('messages.title')}
          {!showArchive && (
            <span className={`nav-live ${connected ? '' : 'off'}`} style={{ marginInlineStart: '8px' }} title={connected ? t('messages.liveConnected') : t('messages.liveOffline')} />
          )}
        </h3>
        <div className="msg-actions">
          <button
            className={`btn btn-sm ${!showArchive ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              setShowArchive(false);
              setArchiveActive(null);
              setArchiveMsgs([]);
            }}
          >
            <span className="material-icons">inbox</span> {t('messages.inbox')}
          </button>
          {canArchive && (
            <button className={`btn btn-sm ${showArchive ? 'btn-primary' : 'btn-outline'}`} onClick={openArchive}>
              <span className="material-icons">archive</span> {t('messages.archive')}
            </button>
          )}
        </div>
      </div>

      <form className="msg-compose" onSubmit={send}>
        <div className="msg-compose-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('messages.to')}</label>
            <select value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value })}>
              <option value="">{t('messages.selectRecipient')}</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.firstName} {r.lastName} ({roleLabel(t, r.role)})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label>{t('messages.subject')}</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder={t('messages.subjectPlaceholder')}
            />
          </div>
        </div>
        <div className="msg-compose-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('messages.body')}</label>
            <textarea
              rows={2}
              value={form.body}
              onChange={handleBodyChange}
              placeholder={t('messages.bodyPlaceholder')}
            />
          </div>
          <div className="form-group" style={{ flex: 0.6 }}>
            <label>{t('messages.attachment')}</label>
            <label className="file-picker">
              <span className="material-icons">attach_file</span>
              {file ? file.name : t('messages.chooseFile')}
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files[0] || null)} />
            </label>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="msg-compose-actions">
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? t('messages.sending') : t('messages.send')}
            {!sending && <span className="material-icons">send</span>}
          </button>
        </div>
      </form>

      <div className="message-layout">
        <div className="conv-list">
          <h5>{showArchive ? t('messages.allConversations') : t('messages.conversations')}</h5>
          {list.length === 0 && <p className="muted">{showArchive ? t('messages.noArchive') : t('messages.noConversations')}</p>}
          {list.map((item) => {
            const activeId = showArchive ? archiveActive?.key : active?.id;
            const isActive = showArchive ? item.key === activeId : item.other.id === activeId;
            const title = showArchive
              ? item.users.map((u) => `${u.firstName} ${u.lastName} (${roleLabel(t, u.role)})`).join(' ↔ ')
              : `${item.other.firstName} ${item.other.lastName} (${roleLabel(t, item.other.role)})`;
            const lastBody = (item.lastMessage?.subject ? `${item.lastMessage.subject} — ` : '') + (item.lastMessage?.body || '');
            return (
              <button
                key={showArchive ? item.key : item.other.id}
                className={`conv-item ${isActive ? 'active' : ''}`}
                onClick={() => (showArchive ? openArchiveConv(item) : openConversation(item.other))}
              >
                <span className="conv-title">{title}</span>
                <span className="conv-preview">{lastBody.slice(0, 80)}</span>
                <span className="conv-meta">
                  <span className="conv-time">{timeAgoUtil(item.lastMessage?.createdAt, lang, t)}</span>
                  {!showArchive && item.unread > 0 && <span className="badge warn">{item.unread}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="chat-box">
          {!active && !archiveActive ? (
            <div className="chat-welcome">
              {showArchive
                ? t('messages.archiveWelcome')
                : t('messages.welcome')}
            </div>
          ) : messages.length === 0 && archiveMsgs.length === 0 ? (
            <div className="chat-welcome">
              {showArchive
                ? t('messages.noMsgsInConv')
                : t('messages.startConv', { name: `${active?.firstName} ${active?.lastName}` })}
            </div>
          ) : (
            (showArchive ? archiveMsgs : messages).map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`chat-msg ${mine ? 'user' : 'assistant'}`}>
                  <div className="chat-bubble">
                    {!mine && <div className="chat-sender">{m.sender.firstName} {m.sender.lastName}</div>}
                    {m.subject && <div className="chat-subject">{m.subject}</div>}
                    <div className="chat-text">{m.body}</div>
                    {m.attachmentUrl && (
                      <a className="chat-file" href={m.attachmentUrl} target="_blank" rel="noreferrer">
                        <span className="material-icons">insert_drive_file</span> {m.attachmentName || t('messages.attachmentFallback')}
                      </a>
                    )}
                    <div className="chat-time">
                      {fullDateUtil(m.createdAt, lang)}
                      {mine && !showArchive && (
                        <span className="chat-receipt" title={m.readAt ? t('messages.readTitle') : t('messages.sentTitle')}>
                          <span className="material-icons">{m.readAt ? 'done_all' : 'done'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {!showArchive && active && typingFrom === active.id && (
            <div className="chat-msg assistant">
              <div className="chat-bubble typing">{t('messages.typing')}</div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
