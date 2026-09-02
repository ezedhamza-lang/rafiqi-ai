// يبني محتوى التربية التقنية س1 من كتاب المستخدم التفاعلي (HTML مع صور base64)
import fs from 'fs';
import path from 'path';

const HTML = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/تربية تقنية/kitab-tarbiya-tiqnia-interactive.html';
const OUT = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/curriculum/year1/tech-book.json';
const IMG_DIR = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/uploads/tech';

fs.mkdirSync(IMG_DIR, { recursive: true });
const html = fs.readFileSync(HTML, 'utf8');

// ===== استخراج الصور base64 بالترتيب مع الـalt =====
const imgRe = /<img class="wimg" src="data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)" alt="([^"]*)"/g;
const images = [];
let m;
while ((m = imgRe.exec(html)) !== null) {
  images.push({ ext: m[1] === 'jpeg' ? 'jpg' : m[1], data: m[2], alt: m[3] });
}
console.log('images found:', images.length);
images.forEach((im, i) => {
  const name = `tech-w${String(i + 1).padStart(2, '0')}.${im.ext}`;
  fs.writeFileSync(path.join(IMG_DIR, name), Buffer.from(im.data, 'base64'));
  im.file = `/tech/${name}`;
});

// ===== استخراج الورشات =====
const stripTags = (s) => s.replace(/<[^>]+>/g, '').trim();
const deTashkeel = (s) => String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');

const sections = html.split(/<section class="workshop" id="w\d+">/).slice(1);
console.log('workshops found:', sections.length);

const TYPE_LABELS = {
  'تنفيذ': 'تنفيذ', 'تصنيف': 'تصنيف', 'امن': 'أمن', 'ملاحظه': 'ملاحظة', 'تجربه': 'تجربة',
  'ترتيب': 'ترتيب', 'وضعيه': 'وضعية', 'اداء': 'أداء', 'حماه': 'حماية', 'تفكير': 'تفكير',
  'قياس': 'قياس', 'رسم': 'رسم', 'قص': 'قص', 'لصق': 'لصق', 'طي': 'طي', 'انجاز': 'إنجاز',
  'تقويم': 'تقويم', 'مقارنه': 'مقارنة'
};

const workshops = sections.map((sec, wi) => {
  const title = stripTags((sec.match(/<h2>(.*?)<\/h2>/) || [])[1] || '');
  const img = images[wi];
  const mission = stripTags((sec.match(/<p class="mission">(.*?)<\/p>/s) || [])[1] || '')
    .replace(/^مع أنيسي:\s*/, '');
  const questions = [];
  const qRe = /<label for="w\d+q\d+">(.*?)<\/label>/g;
  let qm;
  while ((qm = qRe.exec(sec)) !== null) {
    const raw = stripTags(qm[1]);
    const bare = deTashkeel(raw);
    // النوع بين القوسين الأولين
    const tm = bare.match(/\(([^)]+)\)/);
    const tType = tm ? deTashkeel(tm[1]).trim() : '';
    const typeLabel = TYPE_LABELS[normKey(tType)] || tType;
    // التلميح: آخر قوسين في السؤال إن وُجدنا بعد علامة الاستفهام أو في نهايتها
    const hints = [...bare.matchAll(/\(([^)]+)\)/g)].map((x) => x[1]);
    const hint = hints.length > 1 ? hints[hints.length - 1] : null;
    questions.push({ num: questions.length + 1, typeLabel, text: raw, answerHint: hint });
  }
  return {
    id: `tech-y1-${String(wi + 1).padStart(2, '0')}`,
    num: wi + 1,
    title,
    image: img ? img.file : null,
    imageDesc: img ? img.alt : null,
    mission,
    questions
  };
});

function normKey(s) {
  return deTashkeel(s).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
}

// أقسام الكتاب الثلاثة
const partHeaders = [...html.matchAll(/<h2>((?:أَوَّلاً|ثَانِياً|ثَالِثاً)[^<]*)<\/h2>/g)].map((x) => stripTags(x[1]));

const out = {
  _meta: {
    source: 'kitab-tarbiya-tiqnia-interactive.html (مصدر المستخدم)',
    note: 'ورشات تطبيقية تؤخذ كما هي من الكتاب. الأسئلة عملية (تنفيذ/ملاحظة/وضعية...) بلا تحقق آلي؛ التلميح بين قوسين من الكتاب نفسه.'
  },
  title: 'كِتَابِي فِي التَّرْبِيَةِ التِّقْنِيَّةِ',
  subtitle: 'السَّنَةُ الأُولَى ابْتِدَائِي — وَرَشَاتٌ وَمَشَارِيعُ تَطْبِيقِيَّةٌ مَعَ أنيس',
  parts: partHeaders,
  lessons: workshops
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('written:', OUT);
console.log('workshops:', workshops.length);
console.log('questions total:', workshops.reduce((s, w) => s + w.questions.length, 0));
console.log('sample:', JSON.stringify(workshops[0]).slice(0, 500));