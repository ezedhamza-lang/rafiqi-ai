import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const DAILY_QUESTIONS = [
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما ناتج 7 × 8؟', options: ['54', '56', '63', '48'], answer: 1, explanation: '7 × 8 = 56' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما هو نصف 45؟', options: ['20', '22.5', '25', '23'], answer: 1, explanation: '45 ÷ 2 = 22.5' },
  { subject: 'arabic', emoji: '📖', subjectLabel: 'العربية', q: 'ما هو جمع كلمة "كتاب"؟', options: ['كتب', 'كتابات', 'كتبة', 'كتبون'], answer: 0, explanation: 'جمع كلمة "كتاب" هو "كتب"' },
  { subject: 'arabic', emoji: '📖', subjectLabel: 'العربية', q: 'كم عدد أحرف اللغة العربية؟', options: ['26', '28', '30', '36'], answer: 1, explanation: 'اللغة العربية تحتوي على 28 حرف' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'أي الكواكب التالية أقرب إلى الشمس؟', options: ['المريخ', 'الأرض', 'عطارد', 'الزحل'], answer: 2, explanation: 'عطارد هو الكوكب الأقرب إلى الشمس' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'كم عدد قلوب الإنسان؟', options: ['1', '2', '3', '4'], answer: 1, explanation: 'الإنسان لديه قلبان: الأيمن والأيسر' },
  { subject: 'french', emoji: '🇫🇷', subjectLabel: 'الفرنسية', q: 'Comment dit-on "كتاب" en français?', options: ['cahier', 'livre', 'stylo', 'table'], answer: 1, explanation: 'كتاب = livre بالفرنسية' },
  { subject: 'french', emoji: '🇫🇷', subjectLabel: 'الفرنسية', q: 'Quel est le contraire de "grand"?', options: ['long', 'petit', 'gros', 'fort'], answer: 1, explanation: 'grand (كبير) ↔ petit (صغير)' },
  { subject: 'english', emoji: '🇬🇧', subjectLabel: 'الإنجليزية', q: 'What is the opposite of "hot"?', options: ['warm', 'cold', 'cool', 'mild'], answer: 1, explanation: 'hot (ساخن) opposite is cold (بارد)' },
  { subject: 'english', emoji: '🇬🇧', subjectLabel: 'الإنجليزية', q: 'Which is a color?', options: ['run', 'blue', 'happy', 'fast'], answer: 1, explanation: 'blue is the only color in the list' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما هو العدد الذي إذا ضربناه في 5 ناتجه 35؟', options: ['6', '7', '8', '9'], answer: 1, explanation: '35 ÷ 5 = 7' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'ما هي الحيوانات التي تبيض؟', options: ['الأسماك', 'الطيور', 'الحمار', 'القط'], answer: 1, explanation: 'الطيور تضع البيض' },
  { subject: 'arabic', emoji: '📖', subjectLabel: 'العربية', q: 'ما هو فاعل الجملة: "سقى المطر الأرض"؟', options: ['المطر', 'الأرض', 'سقى', 'الشمس'], answer: 0, explanation: 'المطر هو الفاعل' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'كم عدد أضلاع المثلث؟', options: ['2', '3', '4', '5'], answer: 1, explanation: 'المثلث لديه 3 أضلاع' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'أين نعيش على كوكب الأرض؟', options: ['القمر', 'المجموعة الشمسية', 'نجم آخر', 'مجرة أخرى'], answer: 1, explanation: 'نعيش في المجموعة الشمسية' },
  { subject: 'french', emoji: '🇫🇷', subjectLabel: 'الفرنسية', q: 'Quelle heure est-il quand il est midi?', options: ['11h', '12h', '13h', '14h'], answer: 1, explanation: 'Midi = 12:00' },
  { subject: 'english', emoji: '🇬🇧', subjectLabel: 'الإنجليزية', q: 'How do you say "مرحبا" in English?', options: ['Goodbye', 'Hello', 'Thank you', 'Sorry'], answer: 1, explanation: 'مرحبا = Hello' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما هو 25% من 80؟', options: ['15', '20', '25', '30'], answer: 1, explanation: '25% من 80 = 80 ÷ 4 = 20' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'أي المجسمات التالية ليس لها أضلاع؟', options: ['المكعب', 'الأسطوانة', 'الكرة', 'المخروط'], answer: 2, explanation: 'الكرة ليس لها أضلاع' },
  { subject: 'arabic', emoji: '📖', subjectLabel: 'العربية', q: 'ما هو إعراب كلمة "الباب" في الجملة: "الباب مفتوح"؟', options: ['المبتدأ', 'الخبر', 'الفعل', 'المفعول'], answer: 0, explanation: 'البداية هي المبتدأ' },
  { subject: 'english', emoji: '🇬🇧', subjectLabel: 'الإنجليزية', q: 'Which word means "سعيد" in English?', options: ['sad', 'angry', 'happy', 'tired'], answer: 2, explanation: 'سعيد = happy' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما ناتج 144 ÷ 12؟', options: ['11', '12', '13', '14'], answer: 1, explanation: '144 ÷ 12 = 12' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'ما الفرق بين الشمس والقمر؟', options: ['لا يوجد فرق', 'الشمس نجم والقمر كوكب', 'الشمس كوكب والقمر نجم', 'كلاهما نجمان'], answer: 1, explanation: 'الشمس نجم مضيء والقمر يدور حول الأرض' },
  { subject: 'french', emoji: '🇫🇷', subjectLabel: 'الفرنسية', q: 'Comment dit-on "مدرسة" en français?', options: ['maison', 'école', 'bureau', 'magasin'], answer: 1, explanation: 'مدرسة = école' },
  { subject: 'arabic', emoji: '📖', subjectLabel: 'العربية', q: 'ما هو نوع هذه الكلمة: "بالنسبة"؟', options: ['اسم', 'فعل', 'حرف', 'ظرف'], answer: 2, explanation: 'بالنسبة حرف جر' },
  { subject: 'math', emoji: '🔢', subjectLabel: 'الرياضيات', q: 'ما محيط المربع الذي ضلعه 5 سم؟', options: ['10', '15', '20', '25'], answer: 2, explanation: 'المحيط = 4 × الضلع = 4 × 5 = 20 سم' },
  { subject: 'science', emoji: '🔬', subjectLabel: 'العلوم', q: 'أي الألوان التالية يمتص جميع الألوان؟', options: ['الأبيض', 'الأسود', 'الأحمر', 'الأزرق'], answer: 1, explanation: 'الأسود يمتص جميع الألوان' },
  { subject: 'english', emoji: '🇬🇧', subjectLabel: 'الإنجليزية', q: 'What color is the sky?', options: ['red', 'blue', 'green', 'yellow'], answer: 1, explanation: 'The sky is blue' },
  { subject: 'french', emoji: '🇫🇷', subjectLabel: 'الفرنسية', q: 'Quel est le contraire de "chaud"?', options: ['brûlant', 'froid', 'tiède', 'glacial'], answer: 1, explanation: 'chaud (ساخن) ↔ froid (بارد)' },
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
      api.post('/student/progress/lessons', { gradeId: 'daily', subjectId: 'daily', lessonId: `daily-${today}`, lessonTitle: 'تحدي اليوم' }).catch(() => {});
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
          <span className="dc-streak__fire">🔥</span>
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
