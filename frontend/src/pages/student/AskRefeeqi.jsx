import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AskRefeeqi() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    api
      .get('/ai/chat/history')
      .then(setMessages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get('/ai/student/tutor-context')
      .then((d) => {
        setContext(d);
        if (d.subjects?.length) setSubjectId(d.subjects[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLessonId('');
  }, [subjectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ar' ? 'ar' : 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages((m) => [...m, { id: Date.now(), role: 'user', content: text }]);
    setLoading(true);
    try {
      const reply = await api.post('/ai/chat', {
        message: text,
        gradeId: context?.gradeId || undefined,
        subjectId: subjectId || undefined,
        lessonId: lessonId || undefined
      });
      setMessages((m) => [...m, reply]);
    } catch (err) {
      setMessages((m) => [...m, { id: Date.now(), role: 'assistant', content: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const selectedSubject = context?.subjects?.find((s) => s.id === subjectId) || null;
  const lessons = selectedSubject?.lessons || [];

  return (
    <div className="panel chat-panel">
      <div className="panel-head">
        <h3>{t('studentSpace.askRefeeqi.title')}</h3>
        <p className="muted">{t('studentSpace.askRefeeqi.subtitle')}</p>
      </div>

      {context && context.subjects?.length > 0 && (
        <div className="ai-context-row">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label={t('studentSpace.askRefeeqi.subjectAria')}>
            {context.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} aria-label={t('studentSpace.askRefeeqi.lessonAria')}>
            <option value="">{t('studentSpace.askRefeeqi.allLessons')}</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="chat-box">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <span className="owl-emoji">🦉</span>
            <p>{t('studentSpace.askRefeeqi.welcome')}</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className="chat-bubble">
              {m.content}
              {m.role === 'assistant' && (
                <button className="btn-ghost speak-btn" onClick={() => speak(m.content)} title={t('studentSpace.askRefeeqi.speakTitle')}>
                  🔊
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="chat-msg assistant"><div className="chat-bubble typing">{t('studentSpace.askRefeeqi.typing')}</div></div>}
        <div ref={endRef} />
      </div>

      <form className="chat-input-row" onSubmit={send}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('studentSpace.askRefeeqi.inputPlaceholder')} />
        <button className="btn btn-primary" disabled={loading}>{t('studentSpace.askRefeeqi.send')}</button>
      </form>
    </div>
  );
}
