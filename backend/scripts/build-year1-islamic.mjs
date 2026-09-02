// يبني محتوى التربية الإسلامية س1 من كتاب المستخدم (rafiqi_book/index.html)
// المحتوى يؤخذ كما هو: الدرس + السند + الاقتباس + الأسئلة السبعة.
import fs from 'fs';

const HTML = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/تربية اسلامية/rafiqi_book/index.html';
const OUT = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/curriculum/year1/islamic-book.json';

const html = fs.readFileSync(HTML, 'utf8');
const start = html.indexOf('const LESSONS = [');
const end = html.indexOf('];', start);
const LESSONS = eval(html.slice(start + 'const LESSONS ='.length, end + 1));

const lessons = LESSONS.map((l, i) => ({
  id: `islamic-y1-${String(i + 1).padStart(2, '0')}`,
  num: i + 1,
  period: l.period,
  axis: l.axis,
  title: l.title,
  image: `/islamic/lesson${String(i + 1).padStart(2, '0')}.png`,
  imageDesc: l.image,
  sanad: l.sanad,
  quoteType: l.quoteType,
  quote: l.quote,
  questions: (l.questions || []).map((q) => {
    if (q.type === 'mcq') {
      return { type: 'mcq', text: q.q, options: q.options, answer: q.correct };
    }
    if (q.type === 'tf') {
      return { type: 'mcq', text: q.q, options: ['صحيح ✓', 'خطأ ✗'], answer: q.correct ? 0 : 1 };
    }
    if (q.type === 'match') {
      return {
        type: 'match',
        text: q.q,
        left: (q.pairs || []).map((p) => p[0]),
        right: (q.pairs || []).map((p) => p[1])
      };
    }
    if (q.type === 'fill') {
      return { type: 'write', input: 'text', text: q.q };
    }
    const bareQ = String(q.q || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');
    if (/وضعيه|وضعية/.test(bareQ) || /وضعية/.test(String(q.type || ''))) {
      return { type: 'activity', text: q.q };
    }
    return { type: 'write', input: 'text', text: q.q };
  })
}));

const periods = [...new Set(LESSONS.map((l) => l.period))];

const out = {
  _meta: {
    source: 'rafiqi_book/index.html (مصدر المستخدم)',
    note: 'المحتوى يؤخذ حرفياً من كتاب التربية الإسلامية المقدَّم. الأسئلة المفتوحة والإملائية بلا تحقق آلي (يصححها المعلم).'
  },
  title: 'كِتَابِي فِي التَّرْبِيَةِ الإِسْلَامِيَّةِ',
  subtitle: 'السَّنَةُ الأُولَى ابتدائي',
  periods,
  lessons
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('written:', OUT);
console.log('lessons:', lessons.length, '| periods:', periods.length);
const qTypes = {};
for (const l of lessons) for (const q of l.questions) qTypes[q.type] = (qTypes[q.type] || 0) + 1;
console.log('question types:', JSON.stringify(qTypes));