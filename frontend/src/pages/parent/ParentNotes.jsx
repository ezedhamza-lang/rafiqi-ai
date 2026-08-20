import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function ParentNotes() {
  const { t } = useI18n();
  const [notes, setNotes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [content, setContent] = useState('');
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api.get('/parent/notes').then(setNotes).catch(() => setNotes([]));
    api.get('/parent/notes/teachers').then(setTeachers).catch(() => setTeachers([]));
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!studentId || !teacherId || content.trim().length < 3) {
      setErr(t('parentSpace.notes.required'));
      return;
    }
    try {
      await api.post('/parent/notes', { studentId: Number(studentId), teacherId: Number(teacherId), content });
      setContent('');
      setMsg(t('parentSpace.notes.sent'));
      load();
    } catch {
      setErr(t('parentSpace.notes.failed'));
    }
  };

  return (
    <div className="notes-page">
      <div className="space-head">
        <div>
          <h2>{t('parentSpace.notes.title')}</h2>
          <p className="sub">{t('parentSpace.notes.subtitle')}</p>
        </div>
      </div>

      {teachers.length > 0 && (
        <form className="card note-compose" onSubmit={submit}>
          <h3>{t('parentSpace.notes.compose')}</h3>
          <div className="row">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">{t('parentSpace.notes.selectChild')}</option>
              {teachers.map((x, i) => (
                <option key={`${x.studentId}-${i}`} value={x.studentId}>{x.studentName || `#${x.studentId}`}</option>
              ))}
            </select>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">{t('parentSpace.notes.selectTeacher')}</option>
              {teachers.map((x) => (
                <option key={x.teacherId} value={x.teacherId}>{x.teacherName}</option>
              ))}
            </select>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder={t('parentSpace.notes.placeholder')} />
          {err && <p className="error-text">{err}</p>}
          {msg && <p className="success-text">{msg}</p>}
          <button className="btn btn-primary" type="submit">
            <span className="material-icons">send</span>
            {t('parentSpace.notes.send')}
          </button>
        </form>
      )}

      <h3>{t('parentSpace.notes.history')}</h3>
      {notes.length === 0 && <p className="muted">{t('parentSpace.notes.empty')}</p>}
      {notes.map((n) => (
        <div key={n.id} className="card note-card">
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #233863, #2f4a7d)' }}>
            <span className="material-icons">rate_review</span>
            <h3>{n.studentName} → {n.teacherName}</h3>
            <span className="muted small">{new Date(n.createdAt).toLocaleDateString('ar-TN')}</span>
          </div>
          <div className="card-body">
            <p className="note-content">{n.content}</p>
            {n.reply && (
              <div className="note-reply">
                <strong>{t('parentSpace.notes.teacherReply')}:</strong> {n.reply}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}