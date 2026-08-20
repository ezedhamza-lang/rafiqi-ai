import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import LiveRoom from '../../components/LiveRoom.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime as formatDt } from '../../utils/formatUtils.js';

const STATUS_ORDER = { LIVE: 0, SCHEDULED: 1, ENDED: 2, CANCELLED: 3 };

function emptyForm() {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60000);
  const end = new Date(now.getTime() + 120 * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    title: '',
    subject: '',
    description: '',
    classId: '',
    startsAt: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endsAt: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
    maxParticipants: 30
  };
}

export default function LiveSessions() {
  const { t, lang } = useI18n();
  const [sessions, setSessions] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    api
      .get('/teacher/live')
      .then(setSessions)
      .catch((e) => setError(e.message));
    api
      .get('/teacher/live/recordings')
      .then(setRecordings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    api
      .get('/teacher/classes')
      .then(setClasses)
      .catch(() => {});
  }, [load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const createSession = async () => {
    setError('');
    setMsg('');
    try {
      const body = { ...form, classId: form.classId ? Number(form.classId) : null };
      body.maxParticipants = Number(body.maxParticipants) || 30;
      await api.post('/teacher/live', body);
      setShowForm(false);
      setForm(emptyForm());
      setMsg(t('teacherSpace.liveSessions.scheduledSuccess'));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startSession = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const res = await api.post(`/teacher/live/${id}/start`);
      setActive({ session: res.session, join: res.join });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const joinSession = async (id) => {
    setBusyId(id);
    setError('');
    try {
      const res = await api.post(`/teacher/live/${id}/join`);
      setActive({ session: res.session, join: res.join });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const endSession = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/teacher/live/${id}/end`);
      setMsg(t('teacherSpace.liveSessions.endedSuccess'));
      load();
      if (active && active.session.id === id) setActive(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const cancelSession = async (id) => {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/teacher/live/${id}/cancel`);
      setMsg(t('teacherSpace.liveSessions.cancelledSuccess'));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (active) {
    return (
      <LiveRoom
        session={active.session}
        joinData={active.join}
        canPublish={true}
        onExit={() => {
          setActive(null);
          load();
        }}
      />
    );
  }

  const sorted = [...sessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || new Date(a.startsAt) - new Date(b.startsAt)
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('teacherSpace.liveSessions.title')}</h3>
          <p className="muted">
            {t('teacherSpace.liveSessions.subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          <span className="material-icons">video_call</span> {showForm ? t('teacherSpace.liveSessions.close') : t('teacherSpace.liveSessions.scheduleSession')}
        </button>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      {showForm && (
        <div className="form-card" style={{ marginBottom: '1rem' }}>
          <h4>{t('teacherSpace.liveSessions.scheduleNewTitle')}</h4>
          <div className="form-row">
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.sessionTitleLabel')}</label>
              <input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder={t('teacherSpace.liveSessions.sessionTitlePlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.subjectLabel')}</label>
              <input value={form.subject} onChange={(e) => setField('subject', e.target.value)} placeholder={t('teacherSpace.liveSessions.subjectPlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.classLabel')}</label>
              <select value={form.classId} onChange={(e) => setField('classId', e.target.value)}>
                <option value="">{t('teacherSpace.common.allClasses')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.startsAtLabel')}</label>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setField('startsAt', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.endsAtLabel')}</label>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setField('endsAt', e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t('teacherSpace.liveSessions.maxParticipantsLabel')}</label>
              <input type="number" min="2" max="300" value={form.maxParticipants} onChange={(e) => setField('maxParticipants', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>{t('teacherSpace.liveSessions.descriptionLabel')}</label>
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows={2} placeholder={t('teacherSpace.liveSessions.descriptionPlaceholder')} />
          </div>
          <div className="form-row" style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={createSession}>
              <span className="material-icons">event_available</span> {t('teacherSpace.liveSessions.scheduleBtn')}
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('teacherSpace.liveSessions.sessionCol')}</th>
              <th>{t('teacherSpace.liveSessions.classCol')}</th>
              <th>{t('teacherSpace.liveSessions.timeCol')}</th>
              <th>{t('teacherSpace.liveSessions.statusCol')}</th>
              <th>{t('teacherSpace.liveSessions.actionsCol')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">{t('teacherSpace.liveSessions.empty')}</td>
              </tr>
            )}
            {sorted.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.title}</strong>
                  {s.subject && <div className="muted">{s.subject}</div>}
                  {s.description && <div className="muted" style={{ fontSize: '0.8rem' }}>{s.description}</div>}
                </td>
                <td>{s.class ? s.class.name : t('teacherSpace.common.allClasses')}</td>
                <td>{formatDt(s.startsAt, lang)}</td>
                <td>
                  <span className={`badge ${s.status === 'LIVE' ? 'badge-approved' : s.status === 'ENDED' ? 'badge-info' : s.status === 'CANCELLED' ? 'badge-rejected' : 'badge-warning'}`}>
                    {t(`teacherSpace.liveSessions.status.${s.status}`)}
                  </span>
                </td>
                <td>
                  <div className="btn-row" style={{ gap: '0.4rem' }}>
                    {s.status === 'SCHEDULED' && (
                      <>
                        <button className="btn btn-sm btn-success" disabled={busyId === s.id} onClick={() => startSession(s.id)}>
                          <span className="material-icons">play_circle</span> {t('teacherSpace.liveSessions.startNow')}
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => cancelSession(s.id)} disabled={busyId === s.id}>
                          <span className="material-icons">event_busy</span> {t('teacherSpace.liveSessions.cancelSession')}
                        </button>
                      </>
                    )}
                    {s.status === 'LIVE' && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => joinSession(s.id)}>
                          <span className="material-icons">videocam</span> {t('teacherSpace.liveSessions.joinSession')}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => endSession(s.id)} disabled={busyId === s.id}>
                          <span className="material-icons">stop_circle</span> {t('teacherSpace.liveSessions.endSession')}
                        </button>
                      </>
                    )}
                    {s.recordings.length > 0 && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => api.download(`/teacher/live/${s.id}/recording`, `${s.title}-recording.wav`).catch((e) => setError(e.message))}
                      >
                        <span className="material-icons">download</span> {t('teacherSpace.liveSessions.recordingBtn')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recordings.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>{t('teacherSpace.liveSessions.recordingsTitle')}</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('teacherSpace.liveSessions.recordingCol')}</th>
                  <th>{t('teacherSpace.liveSessions.sessionCol')}</th>
                  <th>{t('teacherSpace.liveSessions.durationCol')}</th>
                  <th>{t('teacherSpace.liveSessions.downloadCol')}</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.session?.title}</td>
                    <td>{r.durationSec ? `${Math.round(r.durationSec / 60)} ${t('teacherSpace.liveSessions.minutesSuffix')}` : t('teacherSpace.common.noValue')}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          api
                            .download(`/teacher/live/${r.sessionId}/recording`, `${r.title}.wav`)
                            .catch((e) => setError(e.message))
                        }
                      >
                        <span className="material-icons">download</span> {t('teacherSpace.liveSessions.download')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
