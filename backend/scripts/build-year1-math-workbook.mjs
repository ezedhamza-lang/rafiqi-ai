// يبني محتوى رياضيات السنة الأولى من كراس التمارين (kitab-riyadiyat-anisi-v2.md)
// وفق تعليمات امر.txt: كل سؤال يُؤخذ كما هو في الملف، مع تعيين الإجابة الصحيحة
// والأنواع التفاعلية (اختيار، صورة، عدّ، كتابة، نقر على الصورة، مطابقة، ترتيب، تعبئة، متعدد).
import fs from 'fs';
import path from 'path';

const MD = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/رياضيات/kitab-riyadiyat-anisi-v2.md';
const OUT = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/curriculum/year1/math-workbook.json';

// ---------- قراءة الملف ----------
const lines = fs.readFileSync(MD, 'utf8').split(/\r?\n/);
const line = (i) => lines[i] || '';

// ---------- أنواع الأسئلة ----------
// m: اختيار من متعدد (نص) | t: صح/خطأ | g: اختيار صورة | c: عدّ | w: كتابة
// k: نقر على الصورة | M: مطابقة | o: ترتيب | f: تعبئة خانات | u: اختيار متعدد | a: نشاط
// RULES[L] = { q1..q10: [نوع, جواب, تفاصيل] }
const RULES = {
  1:  { q1:['m',0], q2:['t',0], q3:['g',0], q4:['m',null], q5:['k'], q6:['M'], q7:['m',null], q8:['t',1], q9:['a'], q10:['g',0] },
  2:  { q1:['m',0], q2:['g',0], q3:['g',0,{wrong:'كرة تحت الصندوق'}], q4:['m',null], q5:['k'], q6:['M'], q7:['m',null], q8:['t',1], q9:['a'], q10:['g',0] },
  3:  { q1:['m',0], q2:['g',0], q3:['g',0,{wrong:'كرة اليسار الصندوق'}], q4:['m',null], q5:['k'], q6:['M'], q7:['m',null], q8:['t',1], q9:['a'], q10:['g',0] },
  4:  { q1:['m',0], q2:['g',0], q3:['g',0,{wrong:'كرة على يسار الصندوق'}], q4:['m',null], q5:['k'], q6:['M'], q7:['m',null], q8:['t',1], q9:['a'], q10:['g',0] },
  5:  { q1:['m',0], q2:['g',0], q3:['g',0,{wrong:'كرة خارج الصندوق'}], q4:['m',null], q5:['k'], q6:['M'], q7:['m',null], q8:['t',1], q9:['a'], q10:['g',0] },
  6:  { q1:['m',0], q2:['t',0], q3:['g',0], q4:['m',1], q5:['M'], q6:['a'], q7:['t',1], q8:['m',0], q9:['m',0], q10:['g',0] },
  7:  { q1:['a'], q2:['t',0], q3:['m',2], q4:['g',0], q5:['c',4], q6:['M'], q7:['m',0], q8:['a'], q9:['u',[0,2]], q10:['g',0] },
  8:  { q1:['m',null], q2:['m',0], q3:['w',3], q4:['t',0], q5:['M'], q6:['g',2], q7:['u',[0,2]], q8:['m',0], q9:['a'], q10:['t',0] },
  9:  { q1:['m',0,{opts:['∈','∉']}], q2:['t',1], q3:['m',null], q4:['u',[0,2]], q5:['M'], q6:['g',1], q7:['t',1], q8:['m',0,{opts:['∈','∉']}], q9:['m',2], q10:['m',0] },
  10: { q1:['m',0,{opts:['∈','∉']}], q2:['m',1,{opts:['∈','∉']}], q3:['t',0], q4:['m',0,{opts:['∈','∉']}], q5:['m',1,{opts:['∈','∉']}], q6:['M'], q7:['f',null,{rows:[['قطة','∈'],['تفاحة','∉'],['كلب','∈']]}], q8:['m',0], q9:['m',0,{opts:['∈','∉']}], q10:['t',1] },
  11: { q1:['m',0], q2:['a'], q3:['t',0], q4:['w',3], q5:['M'], q6:['u',[1,2]], q7:['g',0], q8:['a'], q9:['t',0], q10:['m',0] },
  12: { q1:['m',0], q2:['w',0], q3:['t',0], q4:['m',0], q5:['m',0,{opts:['{ }','∅']}], q6:['m',0], q7:['t',1], q8:['c',0], q9:['m',0], q10:['t',1] },
  13: { q1:['f',null,{rows:[['المجموعة الأولى','4'],['المجموعة الثانية','3']]}], q2:['m',2], q3:['m',0], q4:['t',0], q5:['M',null,{skipEmptyRight:true}], q6:['m',0], q7:['m',0], q8:['f',null,{rows:[['المجموعة الأولى','3'],['المجموعة الثانية','3']]}], q9:['m',0], q10:['m',2,{opts:['مجموعة بها 5 عناصر','مجموعة بها 5 عناصر أخرى','مجموعة بها 2 عناصر']}] },
  14: { q1:['m',0], q2:['M'], q3:['t',0], q4:['w',1], q5:['m',0], q6:['a'], q7:['t',1], q8:['w',0], q9:['M'], q10:['m',0] },
  15: { q1:['c',2], q2:['m',0], q3:['w',2], q4:['t',0], q5:['w',2], q6:['w',2], q7:['M'], q8:['o',[2,1,0]], q9:['m',0], q10:['w',3] },
  16: { q1:['c',3], q2:['m',0], q3:['w',3], q4:['t',0], q5:['w',3], q6:['w',3], q7:['M'], q8:['o',[1,0]], q9:['m',0], q10:['w',4] },
  17: { q1:['g',0,{captions:['1 مليم','2 مليم','5 مليم']}], q2:['g',2,{captions:['1 مليم','2 مليم','5 مليم']}], q3:['m',0], q4:['w',2], q5:['M'], q6:['o',[2,1,0]], q7:['w',3], q8:['g',2,{captions:['1 مليم','2 مليم','5 مليم']}], q9:['t',1], q10:['w',7] },
  18: { q1:['c',8], q2:['m',0], q3:['w',8], q4:['t',0], q5:['w',8], q6:['w',8], q7:['M'], q8:['o',[1,0]], q9:['m',0], q10:['w',9] },
  19: { q1:['c',9], q2:['m',0], q3:['w',9], q4:['t',0], q5:['w',9], q6:['w',9], q7:['M'], q8:['o',[1,0]], q9:['m',0], q10:['w',10] },
  20: { q1:['m',0], q2:['t',0], q3:['w',0], q4:['w',0], q5:['m',0], q6:['m',0], q7:['t',1], q8:['o',[1,2,0]], q9:['m',0], q10:['w',0] },
  21: { q1:['m',0], q2:['t',0], q3:['k'], q4:['M'], q5:['m',0], q6:['m',3], q7:['t',0], q8:['o',[1,2,0],{items:['الثالث','الأول','الثاني']}], q9:['m',0], q10:['k'] },
  22: { q1:['m',0], q2:['m',1], q3:['m',0], q4:['m',2], q5:['m',1], q6:['t',1], q7:['f',null,{rows:[['4 و6','<'],['9 و1','>'],['3 و3','=']]}], q8:['o',[3,1,0,2]], q9:['m',0], q10:['m',0] },
  23: { q1:['w',1], q2:['t',0], q3:['m',0], q4:['f',null,{rows:[['10','10'],['الوحدات','3']]}], q5:['w',15], q6:['w',2], q7:['t',0], q8:['f',null,{rows:[['10','10'],['الوحدات','7']]}], q9:['w',14], q10:['m',0] },
  24: { q1:['w',1], q2:['t',0], q3:['m',0], q4:['f',null,{rows:[['10','10'],['الوحدات','3']]}], q5:['w',15], q6:['w',2], q7:['t',0], q8:['f',null,{rows:[['10','10'],['الوحدات','7']]}], q9:['w',14], q10:['m',0] },
  25: { q1:['m',0], q2:['f',null,{rows:[['20','20'],['الوحدات','4']]}], q3:['w',36], q4:['t',0], q5:['f',null,{rows:[['15','1','5'],['23','2','3'],['40','4','0']]}], q6:['f',null,{rows:[['50','50'],['الوحدات','0']]}], q7:['w',60], q8:['m',0], q9:['f',null,{rows:[['90','90'],['الوحدات','9']]}], q10:['f',null,{rows:[['30','30'],['الوحدات','1']]}] },
  26: { q1:['w',5], q2:['t',0], q3:['a'], q4:['w',6], q5:['m',0], q6:['w',9], q7:['a'], q8:['w',4], q9:['t',1], q10:['w',9] },
  27: { q1:['w',13], q2:['c',13], q3:['m',0], q4:['w',18], q5:['M'], q6:['f',null,{rows:[['8+3','11'],['6+9','15']]}], q7:['w',5], q8:['o',[0,2,1]], q9:['m',0], q10:['w',17] },
  28: { q1:['c',10], q2:['w',10], q3:['w',10], q4:['t',0], q5:['m',0], q6:['m',2], q7:['f',null,{rows:[['5','5'],['5','5']]}], q8:['w',5], q9:['m',0], q10:['w',9] },
  29: { q1:['c',13], q2:['w',14], q3:['t',0], q4:['f',null,{rows:[['10','10'],['الوحدات','7']]}], q5:['o',[0,1,2,3]], q6:['M'], q7:['w',19], q8:['m',2], q9:['w',19], q10:['f',null,{rows:[['11','11'],['12','12'],['13','13'],['14','14']]}] },
  30: { q1:['w',5], q2:['w',8], q3:['f',null,{rows:[['2','2'],['3','3'],['4','4']]}], q4:['M'], q5:['w',9], q6:['f',null,{rows:[['5','5'],['6','6'],['7','7']]}], q7:['m',0], q8:['w',9], q9:['o',[1,0,2]], q10:['f',null,{rows:[['0','0'],['1','1'],['2','2'],['3','3'],['5','5']]}] },
  31: { q1:['w',5], q2:['w',8], q3:['f',null,{rows:[['2','2'],['3','3'],['4','4']]}], q4:['M'], q5:['w',9], q6:['f',null,{rows:[['5','5'],['6','6'],['7','7']]}], q7:['m',0], q8:['w',9], q9:['o',[1,0,2]], q10:['f',null,{rows:[['0','0'],['1','1'],['2','2'],['3','3'],['5','5']]}] },
  32: { q1:['w',5], q2:['w',8], q3:['f',null,{rows:[['2','2'],['3','3'],['4','4']]}], q4:['M'], q5:['w',9], q6:['f',null,{rows:[['5','5'],['6','6'],['7','7']]}], q7:['m',0], q8:['w',9], q9:['o',[1,0,2]], q10:['f',null,{rows:[['0','0'],['1','1'],['2','2'],['3','3'],['5','5']]}] },
  33: { q1:['w',8], q2:['w',8], q3:['t',0], q4:['m',0], q5:['M'], q6:['w',8], q7:['m',0], q8:['w',9], q9:['t',1], q10:['m',0,{opts:['نعم، النتيجة نفسها','لا، النتيجة تختلف']}] },
  34: { q1:['w',9], q2:['w',9], q3:['t',0], q4:['m',0], q5:['w',6], q6:['M'], q7:['t',0], q8:['w',12], q9:['m',0], q10:['w',11] },
  35: { q1:['c',16], q2:['w',18], q3:['M'], q4:['w',0], q5:['t',0], q6:['f',null,{rows:[['10','10'],['الوحدات','4']]}], q7:['o',[0,2,3,1]], q8:['w',10], q9:['m',0], q10:['w',18] },
  36: { q1:['m',0], q2:['m',2], q3:['m',0], q4:['o',[0,1,2,3]], q5:['t',1], q6:['f',null,{rows:[['13 و16','<'],['19 و19','='],['8 و15','<']]}], q7:['o',[1,2,3,0]], q8:['m',0], q9:['o',[0,2,1],{items:['8','18','13']}], q10:['m',0] },
  37: { q1:['f',null,{rows:[['10','10'],['الوحدات','5']]}], q2:['w',13], q3:['f',null,{rows:[['10','10'],['الوحدات','1']]}], q4:['w',7], q5:['t',1], q6:['w',19], q7:['M'], q8:['w',14], q9:['f',null,{rows:[['4','4'],['5','5']]}], q10:['w',20] },
  38: { q1:['w',30], q2:['w',50], q3:['M'], q4:['t',0], q5:['w',60], q6:['o',[0,1,2,3]], q7:['w',80], q8:['m',0], q9:['f',null,{rows:[['80','80'],['0','0']]}], q10:['w',50] },
  39: { q1:['f',null,{rows:[['40','40'],['0','0']]}], q2:['w',70], q3:['w',50], q4:['t',0], q5:['w',60], q6:['f',null,{rows:[['50','50'],['40','40']]}], q7:['M'], q8:['w',50], q9:['w',100], q10:['w',60] },
  40: { q1:['g',0,{captions:['10 مليم','20 مليم','50 مليم']}], q2:['g',2,{captions:['10 مليم','20 مليم','50 مليم']}], q3:['m',0], q4:['w',30], q5:['o',[1,2,0]], q6:['g',2,{captions:['10 مليم','20 مليم','50 مليم']}], q7:['w',40], q8:['M'], q9:['w',80], q10:['t',1] },
  41: { q1:['m',0], q2:['m',2], q3:['m',1], q4:['o',[0,1,2,3]], q5:['t',1], q6:['f',null,{rows:[['20 و40','<'],['90 و90','='],['60 و30','>']]}], q7:['o',[3,1,2,0]], q8:['m',0], q9:['o',[0,2,1],{items:['20','90','50']}], q10:['m',0] },
  42: { q1:['c',35], q2:['w',57], q3:['f',null,{rows:[['60','60'],['الوحدات','8']]}], q4:['M'], q5:['w',73], q6:['o',[1,2,3,0]], q7:['f',null,{rows:[['27','2','7'],['63','6','3'],['90','9','0']]}], q8:['w',60], q9:['m',0], q10:['w',10] },
  43: { q1:['w',38], q2:['w',67], q3:['t',0], q4:['w',57], q5:['w',86], q6:['m',0], q7:['w',79], q8:['m',0], q9:['w',99], q10:['w',78] },
  44: { q1:['m',0], q2:['m',2], q3:['m',2], q4:['o',[2,0,3,1]], q5:['t',1], q6:['f',null,{rows:[['28 و82','<'],['55 و55','='],['91 و19','>']]}], q7:['o',[0,2,3,1]], q8:['m',0], q9:['m',0], q10:['m',0] }
};

// ---------- أدوات ----------
function imgUrl(ref) {
  const norm = ref.startsWith('svg:') ? ref.slice(4) : ref.replace(/^media\//, '');
  const folder = ref.startsWith('svg:') ? 'svg' : 'media';
  const file = norm.endsWith('.svg') ? norm.replace(/\.svg$/, '.png') : `${norm}.png`;
  return `/${folder}/${file}`;
}
const stripTashkeel = (s) => (s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').trim();

// ---------- تحليل ----------
const periods = [];
const lessons = [];
let cur = null; // {num,title,objective,story,remember,questions,period,domain}
let inStory = false;
let storyBuf = [];
let qCur = null; // {num,text,imgs,options,captions,matchRows,blankCount,orderList,orderValues,fillPairs,hasCode}
let inCode = false;

for (let i = 0; i < lines.length; i += 1) {
  const l = line(i);
  if (/^# الفترة /.test(l)) {
    periods.push({ title: l.replace(/^#\s*/, '').trim() });
    cur = null; qCur = null;
    continue;
  }
  const lm = l.match(/^## الدرس (\d+):\s*(.+)$/);
  if (lm) {
    cur = {
      num: parseInt(lm[1], 10),
      title: lm[2].trim(),
      objective: '', story: '', remember: '',
      questions: [], domain: periods[periods.length - 1]?.title || ''
    };
    lessons.push(cur);
    qCur = null; inStory = false;
    continue;
  }
  if (!cur) continue;
  const om = l.match(/^\*\*الهدف من الدرس:\*\*\s*(.+)$/);
  if (om) { cur.objective = om[1].trim(); continue; }
  if (/^### 📖 مع أنيسي/.test(l)) { inStory = true; storyBuf = []; continue; }
  if (/^### /.test(l)) { inStory = false; continue; }
  if (/^> ⭐ \*\*تذكّر:\*\*\s*(.+)$/.test(l)) { cur.remember = l.match(/^> ⭐ \*\*تذكّر:\*\*\s*(.+)$/)[1].trim(); inStory = false; continue; }
  if (inStory) { storyBuf.push(l.trim().replace(/^#/, '')); continue; }
  if (/^\*\*(\d+)\.\s+(.+?)\s*<sub>\(L\d+-Q\d+\)<\/sub>/.test(l)) {
    const m = l.match(/^\*\*(\d+)\.\s+(.+?)\s*<sub>\(L\d+-Q\d+\)<\/sub>/);
    qCur = { num: parseInt(m[1], 10), text: m[2].trim(), imgs: [], options: [], captions: [], matchRows: [], blankCount: 0, orderList: [], orderValues: [], fillPairs: [], hasCode: false };
    cur.questions.push(qCur);
    inCode = false;
    continue;
  }
  if (!qCur) continue;
  const imgM = l.match(/^> 🖼️ \*\*\[صورة: `([^`]+)`\]\*\*/);
  if (imgM) { qCur.imgs.push(imgM[1]); continue; }
  if (/^```/.test(l)) { inCode = !inCode; if (inCode) qCur.hasCode = true; continue; }
  if (inCode) continue;
  if (l.includes('● ●')) {
    const cells = l.split('|').map((c) => c.trim()).filter(Boolean);
    qCur.matchRows.push(cells);
    continue;
  }
  if (/^\s*-\s*\[(\d+),\s*(\d+)\]/.test(l)) {
    qCur.fillPairs.push(l.match(/^\s*-\s*\[(\d+),\s*(\d+)\]/).slice(1));
    continue;
  }
  const blanks = (l.match(/`_+/g) || []).length;
  if (blanks > 0) {
    qCur.blankCount += blanks;
    const itemM = l.match(/^\s*-\s*(.+)$/);
    if (itemM && !/\[.*,.*\]/.test(l)) qCur.fillPairs.push([itemM[1].trim()]);
    continue;
  }
  const orderM = l.match(/^\s*الأعداد:\s*(.+)$/);
  if (orderM) { qCur.orderList = orderM[1].trim().split(/\s+/); continue; }
  const ov = l.match(/\[([^\]]+=?[^\]]*)\]/g);
  if (ov && /\[[^,\]]+=[^,\]]+\]/.test(l)) {
    qCur.orderValues = qCur.orderValues.concat(ov.map((t) => t.replace(/^\[|\]$/g, '')));
    continue;
  }
  const optM = l.match(/^\s*(?:[-•]\s*)?(?:⭕|\[[ x]\])\s*(.+)$/);
  if (optM) {
    const val = optM[1].trim();
    if (val.includes('⭕')) {
      for (const piece of val.split(/⭕\s*/)) {
        const p = piece.trim();
        if (!p) continue;
        const refM = p.match(/^`([^`]+)`$/);
        if (refM) qCur.imgs.push(refM[1]);
        else qCur.options.push(p.replace(/\*\*/g, ''));
      }
    } else if (/^\*.*\*$/.test(val)) qCur.captions.push(val.replace(/^\*|\*$/g, ''));
    else qCur.options.push(val.replace(/\*\*/g, ''));
    continue;
  }
}

// ---------- بناء الأسئلة ----------
const outLessons = [];
const problems = [];
for (const L of lessons) {
  const rules = RULES[L.num];
  if (!rules) { problems.push(`lesson ${L.num}: no rules`); continue; }
  if (L.questions.length !== 10) problems.push(`lesson ${L.num}: ${L.questions.length} questions`);
  const questions = L.questions.map((q) => {
    const r = rules[`q${q.num}`] || ['m', null];
    const [type, answer, extra] = r;
    const out = { num: q.num, type, text: q.text };
    if (q.imgs.length === 1) out.img = imgUrl(q.imgs[0]);
    if (type === 'm' || type === 't') {
      const opts = extra?.opts || q.options;
      if (!opts.length) problems.push(`L${L.num}-Q${q.num}: mcq without options`);
      out.options = opts;
      if (answer !== undefined && answer !== null) out.answer = answer;
    } else if (type === 'g') {
      const caps = extra?.captions || q.captions;
      const opts = q.imgs.map((ref, idx) => ({ img: imgUrl(ref), caption: caps[idx] || '' }));
      if (extra?.wrong) opts.push({ img: null, caption: extra.wrong });
      out.options = opts;
      if (answer !== undefined && answer !== null) out.answer = answer;
    } else if (type === 'c' || type === 'w') {
      if (answer !== undefined && answer !== null) out.answer = String(answer);
    } else if (type === 'k') {
      // لا تحقق تلقائي — مثل الكتاب (يرسم التلميذ X بنفسه)
    } else if (type === 'M') {
      const rows = q.matchRows.filter((r2) => r2.length >= 3 && r2[1] === '● ●' && !r2[0].includes('العمود'));
      const filtered = extra?.skipEmptyRight ? rows.filter((r2) => r2[2] && r2[2].trim()) : rows;
      out.left = filtered.map((r2) => r2[0]);
      out.right = filtered.map((r2) => r2[2]);
      if (!filtered.length) problems.push(`L${L.num}-Q${q.num}: match without rows`);
    } else if (type === 'o') {
      const items = extra?.items || (q.orderValues.length ? q.orderValues : q.orderList);
      if (!items.length) problems.push(`L${L.num}-Q${q.num}: order without items`);
      out.items = items;
      out.answer = answer;
    } else if (type === 'f') {
      const rows = extra.rows.map((row) => ({ label: row[0], answer: row.slice(1).map(String) }));
      out.rows = rows;
    } else if (type === 'u') {
      out.items = q.options;
      out.answer = answer;
      if (!q.options.length) problems.push(`L${L.num}-Q${q.num}: multi without items`);
    }
    return out;
  });
  outLessons.push({
    id: `math-y1-${String(L.num).padStart(2, '0')}`,
    num: L.num,
    title: L.title,
    domain: L.domain,
    objective: L.objective,
    story: storyBuf.length ? L.story : L.story, // story set below
    remember: L.remember,
    questions
  });
  const last = outLessons[outLessons.length - 1];
  last.story = L.story = (L.story || storyBuf.join(' ')).trim();
}

// جمع القصة من storyBuf ليس صحيحًا عبر الدروس — نصلحها لكل درس
for (let i = 0; i < lessons.length; i += 1) {
  const L = lessons[i];
  const start = lines.findIndex((l) => l.includes(`## الدرس ${L.num}:`) || (L.num === 1 && l.includes('## الدرس 1:')));
  const end = i + 1 < lessons.length ? lines.findIndex((l, idx) => idx > start && /^## الدرس /.test(l)) : lines.length;
  const slice = lines.slice(start, end);
  const si = slice.findIndex((l) => l.includes('### 📖 مع أنيسي'));
  const ei = slice.findIndex((l, idx) => idx > si && (/^> ⭐/.test(l) || /^### /.test(l)));
  const story = si >= 0 && ei > si ? slice.slice(si + 1, ei).map((s) => s.trim()).join(' ').replace(/\s+/g, ' ').trim() : '';
  outLessons[i].story = story;
}

const meta = {
  source: 'kitab-riyadiyat-anisi-v2.md',
  note: 'محتوى مأخوذ حرفيًا من كراس التمارين المقدّم من المستخدم (وفق تعليمات امر.txt). كل سؤال يُعرض كما في الكتاب؛ الإجابات مضبوطة للتحقق الآلي، وبعض أسئلة الاختيار بلا تحقق (يصححها المعلم) لأن الكتاب لا يحددها. خيارات المقارنة الخاطئة المولّدة في أسئلة الانتماء/المجموعة الفارغة استُبدلت بخيارات ذات معنى (∈/∉، { }/∅) ليقبل السؤال إجابة صحيحة.'
};

const out = {
  _meta: meta,
  units: periods.map((p, i) => ({ id: `p${i + 1}`, num: i + 1, title: p.title })),
  lessons: outLessons
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('written:', OUT);
console.log('lessons:', outLessons.length, '| periods:', periods.length);
console.log('problems:', problems.length);
problems.slice(0, 30).forEach((p) => console.log('  -', p));
const qCount = outLessons.reduce((s, l) => s + l.questions.length, 0);
const byType = {};
for (const l of outLessons) for (const q of l.questions) byType[q.type] = (byType[q.type] || 0) + 1;
console.log('questions:', qCount, JSON.stringify(byType));