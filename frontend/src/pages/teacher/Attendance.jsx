import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function Attendance() {
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/teacher/classes')
      .then((c) => {
        setClasses(c);
        if (c.length) setClassId(String(c[0].id));
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    if (!classId) return;
    api
      .get(`/teacher/attendance/classes/${classId}?date=${date}`)
      .then((d) => {
        setRows(d.students);
        setSaved(d.saved);
      })
      .catch((e) => setError(e.message));
  }, [classId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (studentId) => {
    setRows((r) => r.map((x) => (x.studentId === studentId ? { ...x, present: !x.present } : x)));
    setSaved(false);
  };

  const save = async () => {
    setError('');
    setMsg('');
    try {
      const res = await api.post('/teacher/attendance/save', {
        classId: Number(classId),
        date,
        records: rows
      });
      setSaved(true);
      setMsg(t('teacherSpace.attendance.savedMsg', { saved: res.saved, absent: res.absent }));
    } catch (err) {
      setError(err.message);
    }
  };

  const absentCount = rows.filter((r) => !r.present).length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('teacherSpace.attendance.title')}</h3>
        <p className="muted">{t('teacherSpace.attendance.subtitle')}</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{error}</div>}
      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>{t('teacherSpace.attendance.classLabel')}</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>{t('teacherSpace.attendance.dateLabel')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>&nbsp;</label>
          <button className="btn" onClick={load}>{t('teacherSpace.attendance.showList')}</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">{t('teacherSpace.attendance.empty')}</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('teacherSpace.attendance.studentCol')}</th>
                  <th>{t('teacherSpace.attendance.statusCol')}</th>
                  <th>{t('teacherSpace.attendance.noteCol')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td>{r.firstName} {r.lastName}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${r.present ? 'btn-primary' : 'btn-danger'}`}
                        onClick={() => toggle(r.studentId)}
                      >
                        {r.present ? t('teacherSpace.attendance.present') : t('teacherSpace.attendance.absent')}
                      </button>
                    </td>
                    <td>
                      <input
                        placeholder={t('teacherSpace.attendance.notePlaceholder')}
                        value={r.note || ''}
                        onChange={(e) =>
                          setRows((rowsArr) =>
                            rowsArr.map((x) => (x.studentId === r.studentId ? { ...x, note: e.target.value } : x))
                          )
                        }
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)', width: '100%' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-row" style={{ marginTop: '0.8rem' }}>
            <div>
              <span className="badge badge-approved">{t('teacherSpace.attendance.presentCount', { n: rows.length - absentCount })}</span>{' '}
              <span className="badge badge-rejected">{t('teacherSpace.attendance.absentCount', { n: absentCount })}</span>
            </div>
            <button className="btn btn-primary" onClick={save}>
              <span className="material-icons">save</span> {saved ? t('teacherSpace.attendance.updateAttendance') : t('teacherSpace.attendance.saveAttendance')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
