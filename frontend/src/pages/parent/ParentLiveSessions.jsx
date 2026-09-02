import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import LiveRoom from '../../components/LiveRoom.jsx';

function fmtDateTime(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB');
  const time = d.toLocaleTimeString(lang === 'ar' ? 'ar-TN' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} — ${time}`;
}

export default function ParentLiveSessions() {
  const { lang, t } = useI18n();
  const [sessions, setSessions] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/parent/live')
      .then(setSessions)
      .catch((e) => setError(e.message));
    api
      .get('/parent/live/recordings')
      .then(setRecordings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const join = async (id) => {
    setError('');
    try {
      const res = await api.post(`/parent/live/${id}/join`);
      setActive({ session: res.session, join: res.join });
    } catch (err) {
      setError(err.message);
    }
  };

  if (active) {
    return (
      <LiveRoom
        session={active.session}
        joinData={active.join}
        canPublish={false}
        onExit={() => {
          setActive(null);
          load();
        }}
      />
    );
  }

  const upcoming = sessions.filter((s) => s.status === 'SCHEDULED');
  const live = sessions.filter((s) => s.status === 'LIVE');

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('parentLive.title')}</h3>
          <p className="muted">{t('parentLive.subtitle')}</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}

      {live.length > 0 && (
        <>
          <h4 style={{ color: 'var(--success)' }}>{t('parentLive.liveNow', { n: live.length })}</h4>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('parentLive.session')}</th>
                  <th>{t('parentLive.teacher')}</th>
                  <th>{t('parentLive.time')}</th>
                  <th>{t('parentLive.follow')}</th>
                </tr>
              </thead>
              <tbody>
                {live.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      {s.subject && <div className="muted">{s.subject}</div>}
                    </td>
                    <td>{s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '—'}</td>
                    <td>{fmtDateTime(s.startsAt, lang)}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => join(s.id)}>
                        <span className="material-icons">visibility</span> {t('parentLive.follow')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4>{t('parentLive.upcoming', { n: upcoming.length })}</h4>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('parentLive.session')}</th>
              <th>{t('parentLive.teacher')}</th>
              <th>{t('parentLive.time')}</th>
              <th>{t('parentLive.status')}</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.title}</strong>
                  {s.subject && <div className="muted">{s.subject}</div>}
                </td>
                <td>{s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '—'}</td>
                <td>{fmtDateTime(s.startsAt, lang)}</td>
                <td>
                  <span className="badge badge-warning">{t(`parentLive.${s.status}`)}</span>
                </td>
              </tr>
            ))}
            {upcoming.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">{t('parentLive.noUpcoming')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recordings.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>{t('parentLive.recordings')}</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('parentLive.recording')}</th>
                  <th>{t('parentLive.session')}</th>
                  <th>{t('parentLive.teacher')}</th>
                  <th>{t('parentLive.download')}</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.session?.title}</td>
                    <td>{r.session?.teacher ? `${r.session.teacher.firstName} ${r.session.teacher.lastName}` : '—'}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          api
                            .download(`/parent/live/${r.sessionId}/recording`, `${r.title}.wav`)
                            .catch((e) => setError(e.message))
                        }
                      >
                        <span className="material-icons">download</span> {t('parentLive.download')}
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
