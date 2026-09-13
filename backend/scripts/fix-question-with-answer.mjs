/* Final targeted fix: short standalone exercise blocks that pose a question AND print its
   computed answer (the user's example: «كم لاعبًا شارك في المباراة كلها؟ 11 + 3 = 14»).
   The question stays visible; the solution moves to server-side answer/explanation.
   Story/dialogue blocks («سألت الأستاذه… أجابت فاطمة…») are legitimate worked narratives
   and are left untouched. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUR = path.join(__dirname, '../curriculum');

const FULL_CALC = /[0-9٠-٩]\s*[+×*:−–-]\s*[0-9٠-٩]+[^؟?=\n]{0,15}?=\s*[0-9٠-٩]/;
const STORY_MARK = /سَأَلَتْ|سألت|كَتَبَتِ|كتبت|أَجَابَ|اجابت|أجاب|قَالَت|قالت|الأُسْتَاذَة|الاستاذة|نلاحظ|نَجْمَعُ|نجمع|نَطْرَح|نطرح/;
const strip = (t) => String(t || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

function finalResult(sol) {
  const parts = String(sol).split(/=/);
  let r = parts[parts.length - 1].trim().replace(/[.!۔\s•]+$/, '');
  r = r.replace(/^(فإنَّ?|فان|إذن|اذن|فالناتج|الناتج)\s*/, '');
  return r.length <= 45 ? r : String(sol).trim().slice(0, 45);
}

let fixed = 0;
const touched = [];

function fixFile(rel) {
  const f = path.join(CUR, rel);
  if (!fs.existsSync(f)) return;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let changed = 0;
  const eachLesson = (l) => {
    const bl = l && (l.studentBlocks || l.blocks);
    if (!Array.isArray(bl)) return;
    bl.forEach((b, idx) => {
      if (!b || b.kind !== 'concept' || b.teacherOnly || idx === 0) return;
      const t = String(b.text || '').trim();
      if (t.length > 200) return;
      const s = strip(t);
      if (STORY_MARK.test(s)) return;
      const qms = [...t.matchAll(/[؟?]/g)].map((m) => m.index);
      for (const qi of qms.slice().reverse()) {
        const sol = t.slice(qi + 1).trim();
        const q = t.slice(0, qi + 1).trim();
        if (q.length >= 10 && sol.length >= 4 && FULL_CALC.test(strip(sol))) {
          b.kind = 'question';
          b.text = q;
          b.answer = finalResult(sol);
          b.explanation = sol;
          if (!b.section) b.section = 'practice';
          fixed++; changed++;
          return;
        }
      }
      // variant: «أوجد/أحسب …: (…)» — الحل كله داخل قوسين بعد نقطتين
      const TASK_HEAD = /^(?:\d+\s*[)])?\s*(أوجد|اوجد|أحسب|احسب|أحسبي|كم\s|ما\s|أكمِل|اكمل|احسبي|قدِّر|قدّر)/;
      const paren = t.match(/^(.{10,160}?)[:؟?]?\s*\((.+[0-9٠-٩].+)\)\s*[.!]*\s*$/);
      if (paren && TASK_HEAD.test(strip(paren[1])) && FULL_CALC.test(strip(paren[2]))) {
        b.kind = 'question';
        b.text = paren[1].replace(/[:؟?]\s*$/, '').trim() + '؟';
        b.answer = finalResult(paren[2]);
        b.explanation = paren[2];
        if (!b.section) b.section = 'practice';
        fixed++; changed++;
      }
    });
  };
  const walk = (o) => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      if (o.studentBlocks || o.blocks) eachLesson(o);
      for (const k of Object.keys(o)) if (k !== '_meta' && typeof o[k] === 'object') walk(o[k]);
    }
  };
  walk(d);
  if (changed) { fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n'); touched.push(`${rel} (${changed})`); }
}

const files = [];
for (const g of fs.readdirSync(CUR)) {
  const gd = path.join(CUR, g);
  if (!fs.statSync(gd).isDirectory() || !/^year/.test(g)) continue;
  for (const f of fs.readdirSync(gd)) if (f.endsWith('.json')) files.push(`${g}/${f}`);
}
files.forEach(fixFile);
console.log(`converted question-with-answer blocks: ${fixed}`);
console.log(touched.join(', ') || '(none)');
