import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import LiveRoom from '../../components/LiveRoom.jsx';
import { useI18n } from '../../i18n/index.jsx';

function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} — ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function StudentLiveSessions() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/student/live')
      .then(setSessions)
      .catch((e) => setError(e.message));
    api
      .get('/student/live/recordings')
      .then(setRecordings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const join = async (id) => {
    setError('');
    try {
      const res = await api.post(`/student/live/${id}/join`);
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
  const past = sessions.filter((s) => s.status === 'ENDED');

  const renderTable = (rows, withJoin) => (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('studentSpace.live.colSession')}</th>
            <th>{t('studentSpace.live.colTeacher')}</th>
            <th>{t('studentSpace.live.colTime')}</th>
            <th>{t('studentSpace.live.colStatus')}</th>
            {withJoin && <th>{t('studentSpace.live.colJoin')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.title}</strong>
                {s.subject && <div className="muted">{s.subject}</div>}
              </td>
              <td>{s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : t('studentSpace.live.noTeacher')}</td>
              <td>{fmtDateTime(s.startsAt)}</td>
              <td>
                <span className={`badge ${s.status === 'LIVE' ? 'badge-approved' : s.status === 'ENDED' ? 'badge-info' : 'badge-warning'}`}>
                  {t(`studentSpace.live.status.${s.status}`)}
                </span>
              </td>
              {withJoin && (
                <td>
                  {s.status === 'LIVE' && (
                    <button className="btn btn-sm btn-primary" onClick={() => join(s.id)}>
                      <span className="material-icons">videocam</span> {t('studentSpace.live.joinNow')}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={withJoin ? 5 : 4} className="empty">{t('studentSpace.live.empty')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{t('studentSpace.live.title')}</h3>
          <p className="muted">{t('studentSpace.live.subtitle')}</p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}

      {live.length > 0 && (
        <>
          <h4 style={{ color: 'var(--success)' }}>{t('studentSpace.live.liveNowCount', { n: live.length })}</h4>
          <div style={{ marginBottom: '1rem' }}>{renderTable(live, true)}</div>
        </>
      )}

      <h4>{t('studentSpace.live.upcomingCount', { n: upcoming.length })}</h4>
      <div style={{ marginBottom: '1rem' }}>{renderTable(upcoming, false)}</div>

      <h4>{t('studentSpace.live.pastCount', { n: past.length })}</h4>
      {renderTable(past, false)}

      {recordings.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>{t('studentSpace.live.recordingsTitle')}</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('studentSpace.live.colRecording')}</th>
                  <th>{t('studentSpace.live.colSession')}</th>
                  <th>{t('studentSpace.live.colTeacher')}</th>
                  <th>{t('studentSpace.live.colDownload')}</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.session?.title}</td>
                    <td>{r.session?.teacher ? `${r.session.teacher.firstName} ${r.session.teacher.lastName}` : t('studentSpace.live.noTeacher')}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          api
                            .download(`/student/live/${r.sessionId}/recording`, `${r.title}.${r.format || 'webm'}`)
                            .catch((e) => setError(e.message))
                        }
                      >
                        <span className="material-icons">download</span> {t('studentSpace.live.download')}
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
