import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { CALENDAR_AUDIENCE_KEYS, calendarAudienceLabel, roleLabel } from '../roles.js';
import { timeAgo as timeAgoUtil } from '../utils/formatUtils.js';

const TYPE_INFO = {
  MESSAGE: { key: 'messageCenter.types.MESSAGE', icon: 'mail' },
  ANNOUNCEMENT: { key: 'messageCenter.types.ANNOUNCEMENT', icon: 'campaign' },
  EMERGENCY: { key: 'messageCenter.types.EMERGENCY', icon: 'warning' },
  INFO: { key: 'messageCenter.types.INFO', icon: 'notifications' }
};

const PRIORITY_LABEL_KEYS = {
  LOW: 'messageCenter.priorities.LOW',
  NORMAL: 'messageCenter.priorities.NORMAL',
  HIGH: 'messageCenter.priorities.HIGH',
  URGENT: 'messageCenter.priorities.URGENT'
};

const CATEGORY_LABEL_KEYS = {
  GENERAL: 'messageCenter.categories.GENERAL',
  URGENT: 'messageCenter.categories.URGENT',
  EXAM: 'messageCenter.categories.EXAM',
  EVENT: 'messageCenter.categories.EVENT',
  OTHER: 'messageCenter.categories.OTHER'
};

const CHANNEL_OPTIONS = [
  { key: 'EMAIL', labelKey: 'messageCenter.channels.EMAIL', hintKey: 'messageCenter.channels.EMAIL_HINT' },
  { key: 'SMS', labelKey: 'messageCenter.channels.SMS', hintKey: 'messageCenter.channels.SMS_HINT' }
];


function typeInfo(type) {
  return TYPE_INFO[type] || TYPE_INFO.INFO;
}

export default function MessageCenter() {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, refresh, markAllRead, markRead, preferences, updatePreferences } = useNotifications();

  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState([]);
  const [notifPage, setNotifPage] = useState(1);
  const [notifTotal, setNotifTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const [announcements, setAnnouncements] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const canPublish = user && ['SCHOOL_DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const [composer, setComposer] = useState({
    title: '',
    body: '',
    category: 'GENERAL',
    priority: 'NORMAL',
    audience: ['ALL'],
    level: '',
    channels: []
  });
  const [audienceCount, setAudienceCount] = useState(null);
  const [sending, setSending] = useState(false);

  const loadNotifications = useCallback((page = 1) => {
    const q = typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : '';
    api
      .get(`/notifications?page=${page}&limit=20${q}`)
      .then((d) => {
        setNotifications((prev) => (page === 1 ? d.items || [] : [...prev, ...(d.items || [])]));
        setNotifTotal(d.total || 0);
        setNotifPage(page);
      })
      .catch(() => {});
  }, [typeFilter]);

  const loadAnnouncements = useCallback(() => {
    api
      .get('/notifications/announcements')
      .then(setAnnouncements)
      .catch(() => {});
  }, []);

  const loadConversations = useCallback(() => {
    api
      .get('/messages/conversations')
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications(1);
      loadAnnouncements();
      loadConversations();
      refresh();
    }
  }, [user, loadNotifications, loadAnnouncements, loadConversations, refresh]);

  useEffect(() => {
    loadNotifications(1);
  }, [typeFilter, loadNotifications]);

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkRead = async (id) => {
    await markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const openNotification = async (n) => {
    if (!n.read) handleMarkRead(n.id);
    if (n.link) navigate(n.link);
  };

  const computeAudienceCount = async () => {
    setError('');
    setAudienceCount(null);
    try {
      const q = new URLSearchParams({ audience: composer.audience.join(',') });
      if (composer.level.trim()) q.set('level', composer.level.trim());
      const d = await api.get(`/director/announcements/audience-count?${q.toString()}`);
      setAudienceCount(d.count);
    } catch (err) {
      setError(err.message);
    }
  };

  const submitAnnouncement = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        title: composer.title.trim(),
        body: composer.body.trim(),
        category: composer.category,
        priority: composer.priority,
        audience: composer.audience,
        channels: composer.channels
      };
      if (composer.level.trim()) payload.level = composer.level.trim();
      const res = await api.post('/director/announcements', payload);
      setMsg(t('messageCenter.publishedMsg', { n: res.recipients }));
      setComposer((c) => ({ ...c, title: '', body: '', level: '', channels: [], audienceCount: null }));
      setAudienceCount(null);
      loadAnnouncements();
      refresh();
      setTab('announcements');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const toggleAudience = (key) => {
    setComposer((prev) => {
      const has = prev.audience.includes(key);
      const audience = has ? prev.audience.filter((a) => a !== key) : [...prev.audience, key];
      return { ...prev, audience: audience.length ? audience : ['ALL'] };
    });
  };

  const toggleChannel = (key) => {
    setComposer((prev) => ({
      ...prev,
      channels: prev.channels.includes(key) ? prev.channels.filter((c) => c !== key) : [...prev.channels, key]
    }));
  };

  if (!user) return null;

  return (
    <div className="panel message-center">
      <div className="panel-head">
        <h3>
          <span className="material-icons">notifications_active</span> {t('messageCenter.title')}
          {unreadCount > 0 && <span className="badge warn">{t('messageCenter.unreadBadge', { n: unreadCount })}</span>}
        </h3>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      <div className="msg-actions" style={{ marginBottom: '1rem' }}>
        {[
          { key: 'notifications', icon: 'notifications', label: t('messageCenter.tabNotifications') + (unreadCount ? ` (${unreadCount})` : '') },
          { key: 'announcements', icon: 'campaign', label: t('messageCenter.tabAnnouncements') },
          { key: 'messages', icon: 'chat', label: t('messageCenter.tabMessages') }
        ].map((tb) => (
          <button key={tb.key} className={`btn btn-sm ${tab === tb.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(tb.key)}>
            <span className="material-icons">{tb.icon}</span> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <>
          <div className="notif-toolbar">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t('messageCenter.filterAllTypes')}</option>
              <option value="ANNOUNCEMENT">{t('messageCenter.filterAnnouncements')}</option>
              <option value="MESSAGE">{t('messageCenter.filterMessages')}</option>
              <option value="EMERGENCY">{t('messageCenter.filterEmergencies')}</option>
              <option value="INFO">{t('messageCenter.filterInfo')}</option>
            </select>
            <button className="btn btn-sm" onClick={handleMarkAll}>{t('messageCenter.markAllRead')}</button>
          </div>

          <div className="notif-list">
            {notifications.length === 0 && <p className="muted">{t('messageCenter.noNotifications')}</p>}
            {notifications.map((n) => {
              const info = typeInfo(n.type);
              return (
                <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                  <span className={`notif-icon ${n.priority === 'URGENT' ? 'urgent' : ''}`}>
                    <span className="material-icons">{info.icon}</span>
                  </span>
                  <span className="notif-body">
                    <span className="notif-title">{n.title}</span>
                    {n.body && <span className="notif-text">{n.body}</span>}
                    <span className="notif-meta">
                      <span className="badge">{t(info.key)}</span>
                      <span className="muted">{timeAgoUtil(n.createdAt, lang, t)}</span>
                      {n.channels?.length > 1 && <span className="muted">{t('messageCenter.channelsLabel', { channels: n.channels.join(t('messageCenter.channelSeparator')) })}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {notifTotal > notifications.length && (
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <button className="btn btn-outline" onClick={() => loadNotifications(notifPage + 1)}>{t('messageCenter.loadMore')}</button>
            </div>
          )}

          <div className="notif-prefs">
            <h5>{t('messageCenter.prefsTitle')}</h5>
            <div className="notif-prefs-row">
              {[
                { key: 'push', labelKey: 'messageCenter.prefPush', hintKey: 'messageCenter.prefPushHint' },
                { key: 'email', labelKey: 'messageCenter.prefEmail', hintKey: 'messageCenter.prefEmailHint' },
                { key: 'sms', labelKey: 'messageCenter.prefSms', hintKey: 'messageCenter.prefSmsHint' }
              ].map((opt) => (
                <label key={opt.key} className="pref-option">
                  <input
                    type="checkbox"
                    checked={preferences[opt.key]}
                    onChange={(e) => updatePreferences({ [opt.key]: e.target.checked })}
                  />
                  <span>
                    <strong>{t(opt.labelKey)}</strong>
                    <small>{t(opt.hintKey)}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'announcements' && (
        <>
          {canPublish && (
            <form className="card-form notif-compose" onSubmit={submitAnnouncement} style={{ marginBottom: '1.2rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{t('messageCenter.publishTitle')}</h4>
              <div className="form-row">
                <div className="form-group grow">
                  <label>{t('messageCenter.annTitle')}</label>
                  <input required value={composer.title} onChange={(e) => setComposer({ ...composer, title: e.target.value })} placeholder={t('messageCenter.annTitlePlaceholder')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group grow">
                  <label>{t('messageCenter.annBody')}</label>
                  <textarea required rows="3" value={composer.body} onChange={(e) => setComposer({ ...composer, body: e.target.value })} placeholder={t('messageCenter.annBodyPlaceholder')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('messageCenter.category')}</label>
                  <select value={composer.category} onChange={(e) => setComposer({ ...composer, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABEL_KEYS).map(([k, key]) => (
                      <option key={k} value={k}>{t(key)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('messageCenter.priority')}</label>
                  <select value={composer.priority} onChange={(e) => setComposer({ ...composer, priority: e.target.value })}>
                    {Object.entries(PRIORITY_LABEL_KEYS).map(([k, key]) => (
                      <option key={k} value={k}>{t(key)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('messageCenter.level')}</label>
                  <input value={composer.level} onChange={(e) => setComposer({ ...composer, level: e.target.value })} placeholder={t('messageCenter.levelPlaceholder')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group grow">
                  <label>{t('messageCenter.audience')}</label>
                  <div className="check-group">
                    {CALENDAR_AUDIENCE_KEYS.map((a) => (
                      <label key={a} className="check-option">
                        <input type="checkbox" checked={composer.audience.includes(a)} onChange={() => toggleAudience(a)} />
                        {calendarAudienceLabel(t, a)}
                      </label>
                    ))}
                    <button type="button" className="btn btn-sm btn-outline" onClick={computeAudienceCount}>
                      {t('messageCenter.previewCount')}
                    </button>
                    {audienceCount !== null && <strong className="muted">{t('messageCenter.approxBeneficiaries', { n: audienceCount })}</strong>}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group grow">
                  <label>{t('messageCenter.extraChannels')}</label>
                  <div className="check-group">
                    {CHANNEL_OPTIONS.map((c) => (
                      <label key={c.key} className="check-option" title={t(c.hintKey)}>
                        <input type="checkbox" checked={composer.channels.includes(c.key)} onChange={() => toggleChannel(c.key)} />
                        {t(c.labelKey)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? t('messageCenter.publishing') : t('messageCenter.publish')}
                {!sending && <span className="material-icons">campaign</span>}
              </button>
            </form>
          )}

          <div className="notif-list">
            {announcements.length === 0 && <p className="muted">{t('messageCenter.noAnnouncements')}</p>}
            {announcements.map((item) => {
              const ann = item.schoolAnnouncement;
              return (
                <div key={item.id} className="ann-item">
                  <span className={`badge ${ann?.priority === 'URGENT' ? 'warn' : 'good'}`}>
                    {ann ? (CATEGORY_LABEL_KEYS[ann.category] ? t(CATEGORY_LABEL_KEYS[ann.category]) : t('messageCenter.categories.GENERAL')) : t('messageCenter.announcement')}
                  </span>
                  <h4>{item.title}</h4>
                  <p className="muted">{item.body}</p>
                  <div className="notif-meta">
                    <span className="muted">{timeAgoUtil(item.createdAt, lang, t)}</span>
                    {ann?.link && <Link className="btn btn-sm" to={ann.link}>{t('messageCenter.view')}</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'messages' && (
        <div className="mc-messages">
          <div className="panel-head" style={{ borderBottom: 'none' }}>
            <h4>{t('messageCenter.directMessages')}</h4>
            <Link to="/messages" className="btn btn-primary btn-sm">
              <span className="material-icons">chat</span> {t('messageCenter.openFullChat')}
            </Link>
          </div>
          {user.role === 'STUDENT' ? (
            <p className="muted">{t('messageCenter.studentNotAllowed')}</p>
          ) : (
            <div className="conv-list" style={{ border: 'none', padding: 0 }}>
              {conversations.length === 0 && <p className="muted">{t('messageCenter.noConversations')}</p>}
              {conversations.slice(0, 6).map((c) => (
                <Link key={c.other.id} to="/messages" className="conv-item">
                  <span className="conv-title">
                    {c.other.firstName} {c.other.lastName} ({roleLabel(t, c.other.role)})
                  </span>
                  <span className="conv-preview">{(c.lastMessage?.subject ? `${c.lastMessage.subject} — ` : '') + (c.lastMessage?.body || '')}</span>
                  <span className="conv-meta">
                    <span className="conv-time">{timeAgoUtil(c.lastMessage?.createdAt, lang, t)}</span>
                    {c.unread > 0 && <span className="badge warn">{c.unread}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
