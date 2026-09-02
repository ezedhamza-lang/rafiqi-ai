import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function DirectorStudents() {
  const { t } = useI18n();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/director/students').then(setStudents).catch(() => {});
    api.get('/director/classes').then(setClasses).catch(() => {});
  }, []);

  const transfer = async (student, classId) => {
    setError('');
    setMsg('');
    if (!classId || Number(classId) === student.classId) return;
    try {
      await api.put(`/director/students/${student.id}/transfer`, { classId: Number(classId) });
      setMsg(`تم نقل ${student.firstName} ${student.lastName} إلى ${classes.find((c) => c.id === Number(classId))?.name || ''}`);
      const updated = students.map((s) => (s.id === student.id ? { ...s, classId: Number(classId), class: classes.find((c) => c.id === Number(classId)) } : s));
      setStudents(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('director.students.title')}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}
      {msg && <div className="form-success">{msg}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('director.students.name')}</th>
              <th>{t('director.students.level')}</th>
              <th>{t('director.students.currentClass')}</th>
              <th>{t('director.students.transferTo')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.firstName} {s.lastName}</td>
                <td>{s.level}</td>
                <td>{s.class ? s.class.name : '—'}</td>
                <td>
                  <select
                    className="input"
                    defaultValue=""
                    key={`${s.id}-${s.classId}`}
                    onChange={(e) => transfer(s, e.target.value)}
                  >
                    <option value="">{t('director.students.choose')}</option>
                    {classes
                      .filter((c) => c.id !== s.classId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.level})</option>
                      ))}
                  </select>
                </td>
                <td>
                  {s.classId == null && <span className="badge warn">{t('director.students.noClass')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
