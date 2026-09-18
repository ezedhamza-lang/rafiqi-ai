import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';

const WEEKLY_SUBJECTS = ['العربية', 'الرياضيات', 'العلوم', 'الفرنسية', 'التربية الإسلامية'];

const WEEKLY_CHALLENGES = [
  { week: 1, subject: 'الرياضيات', title: 'تحدي الجمع والطرح', questions: [
    { q: '15 + 27 = ?', opts: ['42', '32', '52', '22'], a: 0 },
    { q: '50 - 23 = ?', opts: ['27', '37', '17', '47'], a: 0 },
    { q: '18 + 34 = ?', opts: ['42', '52', '62', '32'], a: 1 },
    { q: '100 - 45 = ?', opts: ['55', '65', '45', '75'], a: 0 },
    { q: '33 + 28 = ?', opts: ['61', '51', '71', '41'], a: 0 },
  ]},
  { week: 2, subject: 'العربية', title: 'تحدي القراءة والفهم', questions: [
    { q: 'ما جمع كلمة "كتاب"?', opts: ['كتب', 'كتابات', 'كتّاب', 'مكتبة'], a: 0 },
    { q: 'ما مقابل كلمة "كبير"?', opts: ['صغير', 'ضخم', 'عملاق', 'طالع'], a: 0 },
    { q: 'أي الجمل صحيحة?', opts: ['الماء بارد', 'الماء حار', 'الماء طويل', 'الماء سريع'], a: 0 },
    { q: 'ما نوع كلمة "يُكتب"?', opts: ['فعل مضارع', 'فعل ماضي', 'اسم', 'صفة'], a: 0 },
    { q: 'جمع "طفل"?', opts: ['أطفال', 'طفولات', 'طلبة', 'صبية'], a: 0 },
  ]},
  { week: 3, subject: 'العلوم', title: 'تحدي العلوم العامة', questions: [
    { q: 'كم عدد كواكب المجموعة الشمسية؟', opts: ['8', '9', '7', '10'], a: 0 },
    { q: 'ما أكبر كوكب؟', opts: ['المشتري', 'زحل', 'الأرض', 'عطارد'], a: 0 },
    { q: 'من ي心血 الطيور?', opts: ['الرياح', 'المطر', 'الشمس', 'القمر'], a: 0 },
    { q: 'ما مصدر ضوء النهار?', opts: ['الشمس', 'القمر', 'النجوم', 'السحب'], a: 0 },
    { q: 'كم عدد أرجل العنكبوت?', opts: ['8', '6', '10', '12'], a: 0 },
  ]},
  { week: 4, subject: 'الرياضيات', title: 'تحدي الضرب والقسمة', questions: [
    { q: '6 × 7 = ?', opts: ['42', '48', '36', '54'], a: 0 },
    { q: '9 × 9 = ?', opts: ['81', '72', '91', '63'], a: 0 },
    { q: '56 ÷ 8 = ?', opts: ['7', '6', '8', '9'], a: 0 },
    { q: '12 × 5 = ?', opts: ['60', '50', '70', '40'], a: 0 },
    { q: '72 ÷ 9 = ?', opts: ['8', '7', '9', '6'], a: 0 },
  ]},
];

export default function StudentWeeklyChallenge() {
  const { t } = useI18n();
  const [challenge, setChallenge] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekNumber = Math.ceil(new Date().getDate() / 7) % WEEKLY_CHALLENGES.length || WEEKLY_CHALLENGES.length;
    const ch = WEEKLY_CHALLENGES[weekNumber - 1] || WEEKLY_CHALLENGES[0];
    setChallenge(ch);
    setLoading(false);
  }, []);

  const selectAnswer = (qi, oi) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qi]: oi }));
  };

  const submit = async () => {
    if (!challenge) return;
    let s = 0;
    challenge.questions.forEach((q, i) => {
      if (answers[i] === q.a) s++;
    });
    setScore(s);
    setSubmitted(true);
    try { await api.post('/student/challenge/weekly', { score: s, total: challenge.questions.length }); } catch {}
  };

  if (loading || !challenge) return <div className="wc-loading"><div className="spinner" /></div>;

  return (
    <div className="wc-page">
      <div className="wc-hero">
        <span className="wc-hero__icon">📅</span>
        <h2 className="wc-hero__title">{t('studentSpace.weeklyChallenge.title', 'التحدي الأسبوعي')}</h2>
        <p className="wc-hero__sub">{challenge.title} — {challenge.subject}</p>
      </div>

      {!submitted ? (
        <>
          <div className="wc-progress">
            <span>{Object.keys(answers).length}/{challenge.questions.length}</span>
            <div className="wc-progress__bar">
              <div className="wc-progress__fill" style={{ width: `${(Object.keys(answers).length / challenge.questions.length) * 100}%` }} />
            </div>
          </div>
          <div className="wc-questions">
            {challenge.questions.map((q, qi) => (
              <div key={qi} className={`wc-q ${answers[qi] !== undefined ? 'wc-q--answered' : ''}`}>
                <p className="wc-q__text">{qi + 1}. {q.q}</p>
                <div className="wc-q__opts">
                  {q.opts.map((o, oi) => (
                    <button key={oi}
                      className={`wc-opt ${answers[qi] === oi ? 'wc-opt--selected' : ''}`}
                      onClick={() => selectAnswer(qi, oi)}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="wc-submit" onClick={submit} disabled={Object.keys(answers).length < challenge.questions.length}>
            {t('studentSpace.weeklyChallenge.submit', 'إرسال الإجابات')}
          </button>
        </>
      ) : (
        <div className="wc-result">
          <span className="wc-result__icon">{score >= challenge.questions.length * 0.8 ? '🏆' : score >= challenge.questions.length * 0.5 ? '👍' : '💪'}</span>
          <h3 className="wc-result__score">{score}/{challenge.questions.length}</h3>
          <p className="wc-result__msg">
            {score >= challenge.questions.length * 0.8
              ? t('studentSpace.weeklyChallenge.excellent', 'ممتاز! أنت نجم!')
              : score >= challenge.questions.length * 0.5
                ? t('studentSpace.weeklyChallenge.good', 'جيد! واصل التقدم!')
                : t('studentSpace.weeklyChallenge.tryAgain', 'حاول مرة أخرى下周!')}
          </p>
          <div className="wc-review">
            {challenge.questions.map((q, qi) => (
              <div key={qi} className={`wc-review__item ${answers[qi] === q.a ? 'wc-review__item--correct' : 'wc-review__item--wrong'}`}>
                <span className="material-icons" style={{ fontSize: '1rem' }}>
                  {answers[qi] === q.a ? 'check_circle' : 'cancel'}
                </span>
                <span>{q.q} — <strong>{q.opts[q.a]}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
