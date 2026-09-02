import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function DirectorNotifications() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '' });

  useEffect(() => {
    api
      .get('/director/notifications')
      .then((list) => setNotifications(list.length ? list : []))
      .catch(() => setNotifications([]));
  }, []);

  const markAllRead = async () => {
    await api.post('/director/notifications/read');
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const res = await api.post('/director/broadcast', broadcast);
      setMsg(t('directorNotifications.sentMsg', { n: res.recipients }));
      setBroadcast({ title: '', message: '' });
      setShowBroadcast(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorNotifications.title')}</h3>
        <div className="btn-group">
          <button className="btn" onClick={markAllRead}>{t('directorNotifications.markAllRead')}</button>
          <button className="btn btn-danger" onClick={() => setShowBroadcast((s) => !s)}>
            <span className="material-icons">campaign</span> {t('directorNotifications.broadcast')}
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      {showBroadcast && (
        <form className="card-form" onSubmit={sendBroadcast} style={{ border: '2px solid var(--danger)', marginBottom: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>{t('directorNotifications.broadcastFormTitle')}</h4>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('directorNotifications.titleLabel')}</label>
              <input required value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} placeholder={t('directorNotifications.titlePlaceholder')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group grow">
              <label>{t('directorNotifications.messageLabel')}</label>
              <textarea required rows="3" value={broadcast.message} onChange={(e) => setBroadcast({ ...broadcast, message: e.target.value })} placeholder={t('directorNotifications.messagePlaceholder')} />
            </div>
          </div>
          <button className="btn btn-danger" type="submit">{t('directorNotifications.send')}</button>
        </form>
      )}

      <div className="cards-grid">
        {notifications.map((n) => (
          <div key={n.id} className={`card-item ${n.read ? '' : 'unread'}`}>
            <span className={`badge ${n.type === 'alert' ? 'warn' : 'good'}`}>
              {n.type === 'alert' ? t('directorNotifications.typeAlert') : t('directorNotifications.typeInfo')}
            </span>
            <h4>{n.title}</h4>
            <p className="muted">{n.body}</p>
            {n.link && <a className="btn btn-sm" href={n.link}>{t('directorNotifications.view')}</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
