import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

export default function TeacherNotes() {
  const { t } = useI18n();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get('/teacher/notes')
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const sendReply = async (id) => {
    if (!reply.trim()) return;
    await api.post(`/teacher/notes/${id}/reply`, { reply });
    setReply('');
    setReplying(null);
    load();
  };

  return (
    <div className="notes-page">
      <div className="space-head">
        <div>
          <h2>{t('teacherSpace.notes.title')}</h2>
          <p className="sub">{t('teacherSpace.notes.subtitle')}</p>
        </div>
      </div>

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && notes.length === 0 && <p className="muted">{t('teacherSpace.notes.empty')}</p>}

      {notes.map((n) => (
        <div key={n.id} className={`card note-card ${n.readAt ? '' : 'unread'}`}>
          <div className="lesson-head" style={{ background: 'linear-gradient(135deg, #6b3fa0, #9d6bdc)' }}>
            <span className="material-icons">rate_review</span>
            <h3>{n.parentName} ← {n.studentName}</h3>
            <span className="muted small">{new Date(n.createdAt).toLocaleDateString('ar-TN')}</span>
          </div>
          <div className="card-body">
            <p className="note-content">{n.content}</p>
            {n.reply && (
              <div className="note-reply">
                <strong>{t('teacherSpace.notes.yourReply')}:</strong> {n.reply}
              </div>
            )}
            {replying === n.id ? (
              <div className="reply-editor">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder={t('teacherSpace.notes.replyPlaceholder')} />
                <div className="row">
                  <button className="btn btn-primary btn-sm" onClick={() => sendReply(n.id)}>{t('teacherSpace.notes.sendReply')}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setReplying(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              !n.reply && (
                <button className="btn btn-secondary btn-sm" onClick={() => setReplying(n.id)}>
                  {t('teacherSpace.notes.reply')}
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}