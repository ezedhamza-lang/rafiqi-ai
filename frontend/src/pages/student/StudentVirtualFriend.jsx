import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const FRIEND_MOODS = [
  { emoji: '🦊', name: 'ثعلبي', greeting: 'مرحباً يا صديقي! أنا ثعلبي، رفيقك التعليمي!' },
  { emoji: '🦉', img: '/owl-mascot.webp', name: 'بومة', greeting: 'أهلاً! أنا بومة الحكمة، سأساعدك في تعلمك!' },
  { emoji: '🐱', name: 'قطوتي', greeting: 'ميـاو! أنا قطوتي، أنا هنا لمساعدتك!' },
  { emoji: '🐰', name: 'أرنبون', greeting: 'مرحباً! أنا أرنبون، صديقك المفضل!' },
];

const ENCOURAGEMENTS = [
  'أنت رائع! استمر في التعلم! 🌟',
  'كل يوم تتعلم شيئاً جديداً! 💪',
  'أنا فخور بك يا صديقي! ⭐',
  'لا تستسلم، أنت تستطيع! 🎯',
  'تعلم شيء جديد كل يوم! 📚',
  'أنت نجم! واصل التقدم! 🌟',
];

const QUICK_ACTIONS = [
  { label: 'معلومة مفيدة', prompt: 'أعطني معلومة مفيدة', emoji: '💡' },
  { label: 'نكتة', prompt: 'احكِ لي نكتة مناسبة للأطفال', emoji: '😄' },
  { label: 'معلومة عن الحيوانات', prompt: 'أعطني معلومة مثيرة عن الحيوانات', emoji: '🐾' },
  { label: 'نصيحة للدراسة', prompt: ' أعطني نصيحة مفيدة للدراسة', emoji: '📝' },
  { label: 'معلومة عن الفضاء', prompt: 'أعطني معلومة مثيرة عن الفضاء', emoji: '🚀' },
];

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const formatted = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    return <p key={i} style={{ margin: '0.25rem 0' }} dangerouslySetInnerHTML={{ __html: formatted }} />;
  });
}

export default function StudentVirtualFriend() {
  const { t } = useI18n();
  const [friend] = useState(() => FRIEND_MOODS[Math.floor(Math.random() * FRIEND_MOODS.length)]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const endRef = useRef(null);

  const friendMark = friend.img ? '' : `${friend.emoji} `;
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `${friendMark}${friend.greeting}\n\n${ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}`
    }]);
  }, [friendMark, friend.greeting]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowQuick(false);

    try {
      const systemPrompt = `أنت رفيق تعليمي ودود اسمك "${friend.name}". أنت تتحدث مع تلميذ في المدرسة الابتدائية. كن ودوداً ومشجعاً ومفيداً. استخدم لغة عربية بسيطة مناسبة للأطفال.`;
      const res = await api.post('/ai/chat', {
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        systemPrompt
      });
      const reply = res?.reply || res?.message || 'أعتذر، لم أفهم. حاول مرة أخرى!';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${friendMark}أعتذر، حدث خطأ بسيط. حاول مرة أخرى!`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-vfriend">
      <div className="vf-header" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
        <span className="vf-header__emoji">{friend.img ? <img src={friend.img} alt={friend.name} className="owl-img" style={{ width: 40, height: 40 }} /> : friend.emoji}</span>
        <div>
          <h2 className="vf-header__title">{friend.name}</h2>
          <p className="vf-header__sub">{t('studentSpace.virtualFriend.subtitle')}</p>
        </div>
      </div>

      <div className="vf-chat">
        {messages.map((m, i) => (
          <div key={i} className={`vf-msg ${m.role === 'user' ? 'vf-msg--user' : 'vf-msg--bot'}`}>
            {m.role === 'assistant' && <span className="vf-msg__avatar">{friend.img ? <img src={friend.img} alt={friend.name} className="owl-img" style={{ width: 24, height: 24 }} /> : friend.emoji}</span>}
            <div className={`vf-msg__bubble ${m.role === 'user' ? 'vf-msg__bubble--user' : 'vf-msg__bubble--bot'}`}>
              {renderMarkdown(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="vf-msg vf-msg--bot">
            <span className="vf-msg__avatar">{friend.img ? <img src={friend.img} alt={friend.name} className="owl-img" style={{ width: 24, height: 24 }} /> : friend.emoji}</span>
            <div className="vf-msg__bubble vf-msg__bubble--bot vf-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {showQuick && (
        <div className="vf-quick">
          <p className="vf-quick__label">{t('studentSpace.virtualFriend.quickActions')}</p>
          <div className="vf-quick__grid">
            {QUICK_ACTIONS.map((a, i) => (
              <button key={i} className="vf-quick__btn" onClick={() => sendMessage(a.prompt)}>
                <span>{a.emoji}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="vf-input-bar">
        <input className="vf-input" placeholder={t('studentSpace.virtualFriend.placeholder')}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(input); }} />
        <button className="vf-send" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          <span className="material-icons">send</span>
        </button>
      </div>
    </div>
  );
}
