import { useState } from 'react';
import { useI18n } from '../../i18n/index.jsx';

const EXPERIMENTS = [
  {
    id: 'exp-1',
    category: 'physics',
    emoji: '💧',
    title: 'الماء وقوى الجاذبية',
    description: 'اكتشف كيف يسقط الماء من مكان مرتفع!',
    materials: ['كوب ماء', 'ملعقة', 'ورقة'],
    steps: [
      'املأ الكوب بالماء حتى الحافة',
      'ضع الورقة فوق فم الكوب',
      'اقلب الكوب بسرعة مع إبقاء الورقة',
      'ارفع يدك عن الورقة ببطء',
      'شاهد! الماء يبقى في الكوب'
    ],
    question: 'لماذا الماء لا ينسكب؟',
    answer: 'بسبب ضغط الهواء الخارجي على الورقة!',
    funFact: 'الهواء يضغط بقوة 10 نيوتن لكل سم2!'
  },
  {
    id: 'exp-2',
    category: 'physics',
    emoji: '🌈',
    title: 'قوس قزح في الماء',
    description: 'اصنع قوس قزح بسيط في غرفة الدراسة!',
    materials: ['كوب ماء شفاف', 'مصباح يدوي', 'حائط أبيض'],
    steps: [
      'أضاء المصباح على جانب الكوب',
      'ضع الكوب الممتلئ بالماء أمام الحائط',
      'حرك المصباح حول الكوب',
      'شاهد الألوان على الحائط'
    ],
    question: 'لماذا نرى ألواناً مختلفة؟',
    answer: 'الضوء ينكسر عند مروره بالماء وينفصل عن الألوان!',
    funFact: 'الأبيض في الضوء يحتوي على 7 ألوان!'
  },
  {
    id: 'exp-3',
    category: 'biology',
    emoji: '🌱',
    title: 'نمو البذور',
    description: 'شاهد كيف تنمو البذور في بضع أيام!',
    materials: ['حبة فول أو عدس', 'قطعة قطن', 'كوب بلاستيكي', 'ماء'],
    steps: [
      'ضعي القطن في قاع الكوب',
      'رشّي القطن بالماء حتى يصبح رطباً',
      'ضعي حبة الفول على القطن',
      'ضعي الكوب في مكان مضاء بالشمس',
      'اسقي القطن كل يوم وراقب التغيرات'
    ],
    question: 'ماذا يحدث بعد 3 أيام؟',
    answer: 'تظهر جذيرة صغيرة وبرعم أخضر!',
    funFact: 'البذرة تحتاج ماء + ضوء + هواء لتنمو!'
  },
  {
    id: 'exp-4',
    category: 'biology',
    emoji: '🫁',
    title: 'كيف نتنفس؟',
    description: 'اكتشف كيف تعمل رئتنا!',
    materials: ['balloon', 'زجاجة بلاستيكية كبيرة', 'أنبوب رفيع'],
    steps: [
      'قصّي قاع الزجاجة',
      'ثبّتي البالون في فم الزجاجة',
      'ادخلي الأنبوب من الثقب',
      'اسحبي الأنبوب للخارج',
      'سترين البالون يتورم!'
    ],
    question: 'ماذا يمثل البالون؟',
    answer: 'البالون يمثل الرئة التي تتسع عند التنفس!',
    funFact: 'رئتنا تحتوي على 300 مليون نفضة هوائية!'
  },
  {
    id: 'exp-5',
    category: 'physics',
    emoji: '⚡',
    title: 'الكهرباء من ال balloons',
    description: 'اصنع شحنة كهربائية بسيطة!',
    materials: ['balloon', 'شعر جاف أو صوف', 'قطع ورق صغيرة'],
    steps: [
      'افرغي البالون',
      'احكّي البالون بالشعر أو الصوف بسرعة',
      'اقترب بالبالون من قطع الورق',
      'ستنجذب قطع الورق إلى البالون!'
    ],
    question: 'لماذا تنجذب الورق؟',
    answer: 'الحك يسبب شحنة كهربائية سلبية تجذب!',
    funFact: 'البرق هو شحنة كهربائية ضخمة بين السحب!'
  },
  {
    id: 'exp-6',
    category: 'chemistry',
    emoji: '🌋',
    title: 'البركان الصغير',
    description: 'اصنع بركاناً صغيراً في المطبخ!',
    materials: ['بيكربونات الصوديوم', 'خل أبيض', 'صبغة طعام حمراء', 'كوب كبير'],
    steps: [
      'ضعي 2 ملعقة بيكربونات الصوديوم في الكوب',
      'أضف بضع قطرات من صبغة الطعام',
      'أضف نصف كوب من الخل ببطء',
      'شاهد البركان ينفجر!'
    ],
    question: 'لماذا ينتفخ البركان؟',
    answer: 'تفاعل البكربونات مع الخل ينتج غاز ثاني أكسد الكربون!',
    funFact: 'البراكين الحقيقية تنفث الصهارة الساخنة!'
  },
  {
    id: 'exp-7',
    category: 'physics',
    emoji: '🧲',
    title: 'قوة المغناطيس',
    description: 'اكتشف قوة الجاذبية المغناطيسية!',
    materials: ['مغناطيس قوي', 'مسامير حديدية', 'ورقة', 'زجاج'],
    steps: [
      'ضع المسامير على الورقة فوق الزجاج',
      'أحضر المغناطيس من تحت الزجاج',
      'اسحب المسامير ببطء',
      'جرّب رفع المغناطيس — سترى المسامير تتبعه!'
    ],
    question: 'لماذا تتبع المسامير المغناطيس؟',
    answer: 'المغناطيس يُصدر حقل مغناطيسي يجذب المعادن الحديدية!',
    funFact: 'الأرض نفسها مغناطيس ضخم!'
  },
  {
    id: 'exp-8',
    category: 'chemistry',
    emoji: '🧪',
    title: 'الماء المتلون',
    description: 'اصنع ماءً متعدد الألوان!',
    materials: ['3 أكواب ماء', 'صبغات طعام (أحمر، أزرق، أصفر)', 'ممصّ (dropper)'],
    steps: [
      'صبّ صبغة حمراء في كوب ماء',
      'صبّ صبغة زرقاء في كوب آخر',
      'صبّ صبغة صفراء في الكوب الثالث',
      'امزج الألوان ببعضها بقطرات صغيرة',
      'راقب الألوان الجديدة!'
    ],
    question: 'ماذا تحصل عند مزج الأزرق والأصفر؟',
    answer: 'تحصل على اللون الأخضر!',
    funFact: 'اللون الأخضر هو المزيج بين الأزرق والأصفر!'
  }
];

const CATEGORIES = [
  { id: 'all', emoji: '🔬', label: 'الكل' },
  { id: 'physics', emoji: '⚡', label: 'الفيزياء' },
  { id: 'biology', emoji: '🧬', label: 'الأحياء' },
  { id: 'chemistry', emoji: '🧪', label: 'الكيمياء' }
];

function ExperimentCard({ exp, onClick }) {
  const catColor = exp.category === 'physics' ? '#3b82f6' : exp.category === 'biology' ? '#10b981' : '#f59e0b';
  return (
    <div className="exp-card" onClick={() => onClick(exp)} style={{ borderTop: `4px solid ${catColor}` }}>
      <div className="exp-card__emoji">{exp.emoji}</div>
      <div className="exp-card__body">
        <h4 className="exp-card__title">{exp.title}</h4>
        <p className="exp-card__desc">{exp.description}</p>
        <span className="exp-card__cat" style={{ color: catColor }}>
          {exp.category === 'physics' ? 'فيزياء' : exp.category === 'biology' ? 'أحياء' : 'كيمياء'}
        </span>
      </div>
    </div>
  );
}

function ExperimentDetail({ exp, onBack }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const catColor = exp.category === 'physics' ? '#3b82f6' : exp.category === 'biology' ? '#10b981' : '#f59e0b';
  return (
    <div className="exp-detail">
      <button className="exp-back" onClick={onBack}>
        <span className="material-icons">arrow_back</span>
      </button>

      <div className="exp-detail__hero" style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}88)` }}>
        <span className="exp-detail__emoji">{exp.emoji}</span>
        <h2 className="exp-detail__title">{exp.title}</h2>
      </div>

      <div className="exp-detail__body">
        <div className="exp-step-section">
          <h3 className="exp-step-section__title">
            <span className="material-icons" style={{ color: catColor }}>inventory_2</span>
            الأدوات المطلوبة
          </h3>
          <ul className="exp-materials">
            {exp.materials.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>

        <div className="exp-step-section">
          <h3 className="exp-step-section__title">
            <span className="material-icons" style={{ color: catColor }}>format_list_numbered</span>
            خطوات التجربة
          </h3>
          <ol className="exp-steps">
            {exp.steps.map((s, i) => (
              <li key={i} className="exp-step">
                <span className="exp-step__num">{i + 1}</span>
                <span className="exp-step__text">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="exp-question-box">
          <h4 className="exp-question-box__title">
            <span className="material-icons">help</span>
            سؤال التجربة
          </h4>
          <p className="exp-question-box__q">{exp.question}</p>
          {!showAnswer ? (
            <button className="exp-question-box__btn" onClick={() => setShowAnswer(true)}>
              أظهر الإجابة
            </button>
          ) : (
            <div className="exp-question-box__answer">
              <span className="material-icons" style={{ color: '#10b981' }}>check_circle</span>
              <span>{exp.answer}</span>
            </div>
          )}
        </div>

        <div className="exp-fun-fact">
          <span className="exp-fun-fact__icon">💡</span>
          <p className="exp-fun-fact__text">{exp.funFact}</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentExperiments() {
  const { t } = useI18n();
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = category === 'all' ? EXPERIMENTS : EXPERIMENTS.filter(e => e.category === category);

  if (selected) {
    return <ExperimentDetail exp={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="student-experiments">
      <div className="exp-header" style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)' }}>
        <span className="material-icons exp-header__icon">science</span>
        <div>
          <h2 className="exp-header__title">{t('studentSpace.experiments.title')}</h2>
          <p className="exp-header__sub">{t('studentSpace.experiments.subtitle')}</p>
        </div>
      </div>

      <div className="exp-categories">
        {CATEGORIES.map(c => (
          <button key={c.id}
            className={`exp-cat-btn ${category === c.id ? 'exp-cat-btn--active' : ''}`}
            onClick={() => setCategory(c.id)}>
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="exp-grid">
        {filtered.map(exp => (
          <ExperimentCard key={exp.id} exp={exp} onClick={setSelected} />
        ))}
      </div>
    </div>
  );
}
