import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const DAILY_QUESTIONS = [
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù†Ø§ØªØ¬ 7 Ã— 8ØŸ', options: ['54', '56', '63', '48'], answer: 1, explanation: '7 Ã— 8 = 56' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù‡Ùˆ Ù†ØµÙ 45ØŸ', options: ['20', '22.5', '25', '23'], answer: 1, explanation: '45 Ã· 2 = 22.5' },
  { subject: 'arabic', emoji: 'ðŸ“–', subjectLabel: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', q: 'Ù…Ø§ Ù‡Ùˆ Ø¬Ù…Ø¹ ÙƒÙ„Ù…Ø© "ÙƒØªØ§Ø¨"ØŸ', options: ['ÙƒØªØ¨', 'ÙƒØªØ§Ø¨Ø§Øª', 'ÙƒØªØ¨Ø©', 'ÙƒØªØ¨ÙˆÙ†'], answer: 0, explanation: 'Ø¬Ù…Ø¹ ÙƒÙ„Ù…Ø© "ÙƒØªØ§Ø¨" Ù‡Ùˆ "ÙƒØªØ¨"' },
  { subject: 'arabic', emoji: 'ðŸ“–', subjectLabel: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', q: 'ÙƒÙ… Ø¹Ø¯Ø¯ Ø£Ø­Ø±Ù Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©ØŸ', options: ['26', '28', '30', '36'], answer: 1, explanation: 'Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ 28 Ø­Ø±Ù' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ø£ÙŠ Ø§Ù„ÙƒÙˆØ§ÙƒØ¨ Ø§Ù„ØªØ§Ù„ÙŠØ© Ø£Ù‚Ø±Ø¨ Ø¥Ù„Ù‰ Ø§Ù„Ø´Ù…Ø³ØŸ', options: ['Ø§Ù„Ù…Ø±ÙŠØ®', 'Ø§Ù„Ø£Ø±Ø¶', 'Ø¹Ø·Ø§Ø±Ø¯', 'Ø§Ù„Ø²Ø­Ù„'], answer: 2, explanation: 'Ø¹Ø·Ø§Ø±Ø¯ Ù‡Ùˆ Ø§Ù„ÙƒÙˆÙƒØ¨ Ø§Ù„Ø£Ù‚Ø±Ø¨ Ø¥Ù„Ù‰ Ø§Ù„Ø´Ù…Ø³' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'ÙƒÙ… Ø¹Ø¯Ø¯ Ù‚Ù„ÙˆØ¨ Ø§Ù„Ø¥Ù†Ø³Ø§Ù†ØŸ', options: ['1', '2', '3', '4'], answer: 1, explanation: 'Ø§Ù„Ø¥Ù†Ø³Ø§Ù† Ù„Ø¯ÙŠÙ‡ Ù‚Ù„Ø¨Ø§Ù†: Ø§Ù„Ø£ÙŠÙ…Ù† ÙˆØ§Ù„Ø£ÙŠØ³Ø±' },
  { subject: 'french', emoji: 'ðŸ‡«ðŸ‡·', subjectLabel: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', q: 'Comment dit-on "ÙƒØªØ§Ø¨" en franÃ§ais?', options: ['cahier', 'livre', 'stylo', 'table'], answer: 1, explanation: 'ÙƒØªØ§Ø¨ = livre Ø¨Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©' },
  { subject: 'french', emoji: 'ðŸ‡«ðŸ‡·', subjectLabel: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', q: 'Quel est le contraire de "grand"?', options: ['long', 'petit', 'gros', 'fort'], answer: 1, explanation: 'grand (ÙƒØ¨ÙŠØ±) â†” petit (ØµØºÙŠØ±)' },
  { subject: 'english', emoji: 'ðŸ‡¬ðŸ‡§', subjectLabel: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', q: 'What is the opposite of "hot"?', options: ['warm', 'cold', 'cool', 'mild'], answer: 1, explanation: 'hot (Ø³Ø§Ø®Ù†) opposite is cold (Ø¨Ø§Ø±Ø¯)' },
  { subject: 'english', emoji: 'ðŸ‡¬ðŸ‡§', subjectLabel: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', q: 'Which is a color?', options: ['run', 'blue', 'happy', 'fast'], answer: 1, explanation: 'blue is the only color in the list' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù‡Ùˆ Ø§Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ø°ÙŠ Ø¥Ø°Ø§ Ø¶Ø±Ø¨Ù†Ø§Ù‡ ÙÙŠ 5 Ù†Ø§ØªØ¬Ù‡ 35ØŸ', options: ['6', '7', '8', '9'], answer: 1, explanation: '35 Ã· 5 = 7' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ù…Ø§ Ù‡ÙŠ Ø§Ù„Ø­ÙŠÙˆØ§Ù†Ø§Øª Ø§Ù„ØªÙŠ ØªØ¨ÙŠØ¶ØŸ', options: ['Ø§Ù„Ø£Ø³Ù…Ø§Ùƒ', 'Ø§Ù„Ø·ÙŠÙˆØ±', 'Ø§Ù„Ø­Ù…Ø§Ø±', 'Ø§Ù„Ù‚Ø·'], answer: 1, explanation: 'Ø§Ù„Ø·ÙŠÙˆØ± ØªØ¶Ø¹ Ø§Ù„Ø¨ÙŠØ¶' },
  { subject: 'arabic', emoji: 'ðŸ“–', subjectLabel: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', q: 'Ù…Ø§ Ù‡Ùˆ ÙØ§Ø¹Ù„ Ø§Ù„Ø¬Ù…Ù„Ø©: " cursus Ø§Ù„Ù…Ø·Ø± Ø§Ù„Ø£Ø±Ø¶ØŸ', options: ['Ø§Ù„Ù…Ø·Ø±', 'Ø§Ù„Ø£Ø±Ø¶', ' cursus', 'Ø§Ù„Ø´Ù…Ø³'], answer: 0, explanation: 'Ø§Ù„Ù…Ø·Ø± Ù‡Ùˆ Ø§Ù„ÙØ§Ø¹Ù„' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'ÙƒÙ… Ø¹Ø¯Ø¯ Ø£Ø¶Ù„Ø§Ø¹ Ø§Ù„Ù…Ø«Ù„Ø«ØŸ', options: ['2', '3', '4', '5'], answer: 1, explanation: 'Ø§Ù„Ù…Ø«Ù„Ø« Ù„Ø¯ÙŠÙ‡ 3 Ø£Ø¶Ù„Ø§Ø¹' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ø£ÙŠÙ† Ù†Ø¹ÙŠØ´ Ø¹Ù„Ù‰ ÙƒÙˆÙƒØ¨ Ø§Ù„Ø£Ø±Ø¶ØŸ', options: ['Ø§Ù„Ù‚Ù…Ø±', 'Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© Ø§Ù„Ø´Ù…Ø³ÙŠØ©', 'Ù†Ø¬Ù… Ø¢Ø®Ø±', 'Ù…Ø¬Ø±Ø© Ø£Ø®Ø±Ù‰'], answer: 1, explanation: 'Ù†Ø¹ÙŠØ´ ÙÙŠ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© Ø§Ù„Ø´Ù…Ø³ÙŠØ©' },
  { subject: 'french', emoji: 'ðŸ‡«ðŸ‡·', subjectLabel: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', q: 'Quelle heure est-il quand il est midi?', options: ['11h', '12h', '13h', '14h'], answer: 1, explanation: 'Midi = 12:00' },
  { subject: 'english', emoji: 'ðŸ‡¬ðŸ‡§', subjectLabel: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', q: 'How do you say "Ù…Ø±Ø­Ø¨Ø§" in English?', options: ['Goodbye', 'Hello', 'Thank you', 'Sorry'], answer: 1, explanation: 'Ù…Ø±Ø­Ø¨Ø§ = Hello' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù‡Ùˆ 25% Ù…Ù† 80ØŸ', options: ['15', '20', '25', '30'], answer: 1, explanation: '25% Ù…Ù† 80 = 80 Ã· 4 = 20' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ø£ÙŠ Ø§Ù„Ù…Ø¬Ø³Ù…Ø§Øª Ø§Ù„ØªØ§Ù„ÙŠØ© Ù„ÙŠØ³ Ù„Ù‡Ø§ Ø£Ø¶Ù„Ø§Ø¹ØŸ', options: ['Ø§Ù„Ù…ÙƒØ¹Ø¨', 'Ø§Ù„Ø£Ø³Ø·ÙˆØ§Ù†Ø©', 'Ø§Ù„ÙƒØ±Ø©', 'Ø§Ù„Ù…Ø®Ø±ÙˆØ·'], answer: 2, explanation: 'Ø§Ù„ÙƒØ±Ø© Ù„ÙŠØ³ Ù„Ù‡Ø§ Ø£Ø¶Ù„Ø§Ø¹' },
  { subject: 'arabic', emoji: 'ðŸ“–', subjectLabel: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', q: 'Ù…Ø§ Ù‡ÙŠ ÙƒÙ„Ù…Ø© "å¼€å­¦" ÙÙŠ Ø§Ù„Ø¬Ù…Ù„Ø©: "ÙØªØ­ Ø§Ù„Ø¨Ø§Ø¨"ØŸ', options: ['Ø§Ù„Ù…Ø¨ØªØ¯Ø£', 'Ø§Ù„Ø®Ø¨Ø±', 'Ø§Ù„ÙØ¹Ù„', 'Ø§Ù„Ù…ÙØ¹ÙˆÙ„'], answer: 0, explanation: 'Ø§Ù„Ø¨Ø¯Ø§ÙŠØ© Ù‡ÙŠ Ø§Ù„Ù…Ø¨ØªØ¯Ø£' },
  { subject: 'english', emoji: 'ðŸ‡¬ðŸ‡§', subjectLabel: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', q: 'Which word means "Ø³Ø¹ÙŠØ¯" in English?', options: ['sad', 'angry', 'happy', 'tired'], answer: 2, explanation: 'Ø³Ø¹ÙŠØ¯ = happy' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù†Ø§ØªØ¬ 144 Ã· 12ØŸ', options: ['11', '12', '13', '14'], answer: 1, explanation: '144 Ã· 12 = 12' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ù…Ø§ Ø§Ù„ÙØ±Ù‚ Ø¨ÙŠÙ† Ø§Ù„Ø´Ù…Ø³ ÙˆØ§Ù„Ù‚Ù…Ø±ØŸ', options: ['Ù„Ø§ ÙŠÙˆØ¬Ø¯ ÙØ±Ù‚', 'Ø§Ù„Ø´Ù…Ø³ Ù†Ø¬Ù… ÙˆØ§Ù„Ù‚Ù…Ø± ÙƒÙˆÙƒØ¨', 'Ø§Ù„Ø´Ù…Ø³ ÙƒÙˆÙƒØ¨ ÙˆØ§Ù„Ù‚Ù…Ø± Ù†Ø¬Ù…', 'ÙƒÙ„Ø§Ù‡Ù…Ø§ Ù†Ø¬Ù…Ø§Ù†'], answer: 1, explanation: 'Ø§Ù„Ø´Ù…Ø³ Ù†Ø¬Ù… Ù…Ø¶ÙŠØ¡ ÙˆØ§Ù„Ù‚Ù…Ø± ÙŠØ¯ÙˆØ± Ø­ÙˆÙ„ Ø§Ù„Ø£Ø±Ø¶' },
  { subject: 'french', emoji: 'ðŸ‡«ðŸ‡·', subjectLabel: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', q: 'Comment dit-on "Ù…Ø¯Ø±Ø³Ø©" en franÃ§ais?', options: ['maison', 'Ã©cole', 'bureau', 'magasin'], answer: 1, explanation: 'Ù…Ø¯Ø±Ø³Ø© = Ã©cole' },
  { subject: 'arabic', emoji: 'ðŸ“–', subjectLabel: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', q: 'Ù…Ø§ Ù‡Ùˆ rodzaj Ù‡Ø°Ù‡ Ø§Ù„ÙƒÙ„Ù…Ø©: "Ø¨Ø§Ù„Ù†Ø³Ø¨Ø©"ØŸ', options: ['Ø§Ø³Ù…', 'ÙØ¹Ù„', 'Ø­Ø±Ù', 'Ø¸Ø±Ù'], answer: 2, explanation: 'Ø¨Ø§Ù„Ù†Ø³Ø¨Ø© Ø­Ø±Ù Ø¬Ø±' },
  { subject: 'math', emoji: 'ðŸ”¢', subjectLabel: 'Ø§Ù„Ø±ÙŠØ§Ø¶ÙŠØ§Øª', q: 'Ù…Ø§ Ù…Ø­ÙŠØ· Ø§Ù„Ù…Ø±Ø¨Ø¹ Ø§Ù„Ø°ÙŠ Ø¶Ù„Ø¹Ù‡ 5 Ø³Ù…ØŸ', options: ['10', '15', '20', '25'], answer: 2, explanation: 'Ø§Ù„Ù…Ø­ÙŠØ· = 4 Ã— Ø§Ù„Ø¶Ù„Ø¹ = 4 Ã— 5 = 20 Ø³Ù…' },
  { subject: 'science', emoji: 'ðŸ”¬', subjectLabel: 'Ø§Ù„Ø¹Ù„ÙˆÙ…', q: 'Ø£ÙŠ Ø§Ù„Ø£Ù„ÙˆØ§Ù† Ø§Ù„ØªØ§Ù„ÙŠØ© ÙŠÙ…ØªØµ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£Ù„ÙˆØ§Ù†ØŸ', options: ['Ø§Ù„Ø£Ø¨ÙŠØ¶', 'Ø§Ù„Ø£Ø³ÙˆØ¯', 'Ø§Ù„Ø£Ø­Ù…Ø±', 'Ø§Ù„Ø£Ø²Ø±Ù‚'], answer: 1, explanation: 'Ø§Ù„Ø£Ø³ÙˆØ¯ ÙŠÙ…ØªØµ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£Ù„ÙˆØ§Ù†' },
  { subject: 'english', emoji: 'ðŸ‡¬ðŸ‡§', subjectLabel: 'Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©', q: 'What color is the sky?', options: ['red', 'blue', 'green', 'yellow'], answer: 1, explanation: 'The sky is blue' },
  { subject: 'french', emoji: 'ðŸ‡«ðŸ‡·', subjectLabel: 'Ø§Ù„ÙØ±Ù†Ø³ÙŠØ©', q: 'Quel est le contraire de "chaud"?', options: ['brÃ»lant', 'froid', 'tiÃ¨de', 'glacial'], answer: 1, explanation: 'chaud (Ø³Ø§Ø®Ù†) â†” froid (Ø¨Ø§Ø±Ø¯)' },
];

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / 86400000);
}

export default function StudentDailyChallenge() {
  const { t } = useI18n();
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [streak, setStreak] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rafiqi-daily-streak') || '{"count":0,"lastDate":""}'); } catch { return { count: 0, lastDate: '' }; }
  });

  const today = new Date().toISOString().slice(0, 10);
  const dayIndex = getDayOfYear();
  const question = DAILY_QUESTIONS[dayIndex % DAILY_QUESTIONS.length];

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('rafiqi-daily-answered') || '{}');
    if (stored[today]) {
      setAnswered(true);
      setSelected(stored[today].selected);
    }
  }, [today]);

  const selectAnswer = (idx) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);

    const correct = idx === question.answer;
    const prevStreak = JSON.parse(localStorage.getItem('rafiqi-daily-streak') || '{"count":0,"lastDate":""}');
    let newCount = prevStreak.count;
    if (correct) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      newCount = prevStreak.lastDate === yesterdayStr ? prevStreak.count + 1 : 1;
    } else {
      newCount = 0;
    }
    const newStreak = { count: newCount, lastDate: today };
    setStreak(newStreak);
    localStorage.setItem('rafiqi-daily-streak', JSON.stringify(newStreak));
    localStorage.setItem('rafiqi-daily-answered', JSON.stringify({
      ...JSON.parse(localStorage.getItem('rafiqi-daily-answered') || '{}'),
      [today]: { selected: idx, correct }
    }));

    if (correct) {
      api.post('/student/progress/lessons', { gradeId: 'daily', subjectId: 'daily', lessonId: `daily-${today}`, lessonTitle: 'ØªØ­Ø¯ÙŠ Ø§Ù„ÙŠÙˆÙ…' }).catch(() => {});
    }
  };

  return (
    <div className="student-daily-challenge">
      <div className="dc-header" style={{ background: 'linear-gradient(135deg, #E8A317, #ef4444)' }}>
        <span className="material-icons dc-header__icon">emoji_events</span>
        <div>
          <h2 className="dc-header__title">{t('studentSpace.dailyChallenge.title')}</h2>
          <p className="dc-header__sub">{t('studentSpace.dailyChallenge.subtitle')}</p>
        </div>
      </div>

      <div className="dc-body">
        <div className="dc-streak">
          <span className="dc-streak__fire">ðŸ”¥</span>
          <span className="dc-streak__count">{streak.count}</span>
          <span className="dc-streak__label">{t('studentSpace.dailyChallenge.streakDays')}</span>
        </div>

        <div className="dc-question-card">
          <div className="dc-question-card__subject">
            <span>{question.emoji}</span>
            <span>{question.subjectLabel}</span>
          </div>
          <h3 className="dc-question-card__q">{question.q}</h3>
          <div className="dc-options">
            {question.options.map((opt, i) => {
              let cls = 'dc-option';
              if (answered) {
                if (i === question.answer) cls += ' dc-option--correct';
                else if (i === selected && i !== question.answer) cls += ' dc-option--wrong';
              }
              return (
                <button key={i} className={cls} onClick={() => selectAnswer(i)} disabled={answered}>
                  <span className="dc-option__letter">{String.fromCharCode(65 + i)}</span>
                  <span className="dc-option__text">{opt}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className={`dc-result ${selected === question.answer ? 'dc-result--correct' : 'dc-result--wrong'}`}>
              <span className="material-icons">
                {selected === question.answer ? 'check_circle' : 'cancel'}
              </span>
              <span>
                {selected === question.answer
                  ? t('studentSpace.dailyChallenge.correct')
                  : t('studentSpace.dailyChallenge.wrong')}
              </span>
              <p className="dc-result__explanation">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
