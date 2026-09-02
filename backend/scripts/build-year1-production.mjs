// يبني الإنتاج الكتابي س1 من كتاب المستخدم (kitabi-fi-alintaj-alkitabi.html)
// الدروس تؤخذ كما هي: ملاحظة + بطاقات + ترتيب + مهمة إنتاج + قائمة مراجعة.
import fs from 'fs';

const HTML = 'C:/Users/ezedd/AppData/Local/Temp/opencode/intaj-files-x/kitabi-fi-alintaj-alkitabi.html';
const OUT = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/curriculum/year1/production-book-v2.json';

const html = fs.readFileSync(HTML, 'utf8');
const start = html.indexOf('const lessons = [');
const end = html.indexOf('];', start);
const lessonsRaw = eval(html.slice(start + 'const lessons ='.length, end + 1));
const periodsRaw = eval(`[${html.match(/const periods = \[([\s\S]*?)\];/)[1]}]`);

// خريطة الصور من prompts-intaj-kitabi.md
const IMG = {
  1: ['intaj_L1.png'],
  2: ['intaj_L2.png'],
  3: ['intaj_L3_1.png', 'intaj_L3_2.png', 'intaj_L3_3.png'],
  4: ['intaj_L4.png'],
  5: ['intaj_L5_1.png', 'intaj_L5_2.png', 'intaj_L5_3.png'],
  6: ['intaj_L6.png'],
  7: ['intaj_L7_1.png', 'intaj_L7_2.png', 'intaj_L7_3.png'],
  8: ['intaj_L8.png'],
  9: ['intaj_L9_1.png', 'intaj_L9_2.png', 'intaj_L9_3.png'],
  10: ['intaj_L10_1.png', 'intaj_L10_2.png', 'intaj_L10_3.png'],
  11: ['intaj_L11.png'],
  12: ['intaj_L12.png']
};

// الترتيب الصحيح لتمارين الترتيب (من منطق القصة في الكتاب: observe يحدد تسلسل الصور)
const ORDER_ANSWERS = {
  3: [1, 0, 2], // استيقظ ثم غسل ثم أكل
  7: [2, 1, 0] // رأى لصا فنبح فهرب
};
const AR_NUM = { 'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'الحادي عشر': 11, 'الثاني عشر': 12, 'العاشر': 10 };

const lessons = lessonsRaw.map((l) => {
  const num = AR_NUM[l.num] || null;
  return {
    id: `prod-y1-${String(num).padStart(2, '0')}`,
    num,
    title: `${l.title}`,
    images: (IMG[num] || []).map((f) => `/intaj/${f}`),
    imageDesc: l.img,
    observe: l.observe || null,
    correction: l.correction || null,
    cards: l.cards || null,
    complete: l.complete || null,
    ordering: l.ordering ? { items: l.ordering, answer: ORDER_ANSWERS[num] || null } : null,
    task: l.task,
    lines: l.lines || 3,
    checklist: l.checklist || []
  };
});

const out = {
  _meta: {
    source: 'kitabi-fi-alintaj-alkitabi.html + prompts-intaj-kitabi.md (مصادر المستخدم)',
    note: 'دروس الإنتاج الكتابي كما هي من الكتاب: ألاحظ → أستعد → أنتج → أراجع. مهام الكتابة بلا تحقق آلي (يصححها المعلم وفق قائمة المراجعة).'
  },
  title: 'كِتَابِي فِي الإِنْتَاجِ الكِتَابِيِّ',
  subtitle: 'السَّنَةُ الأُولَى ابتدائي',
  periods: periodsRaw.map((p) => ({ title: p.title, lessonNums: p.lessons.map((i) => i + 1) })),
  lessons
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('written:', OUT);
console.log('lessons:', lessons.length);
for (const l of lessons) console.log(` L${l.num}: ${l.title.slice(0, 40)} | imgs:${l.images.length} | ordering:${l.ordering ? (l.ordering.answer ? 'ok' : 'NO-ANSWER') : '-'}`);