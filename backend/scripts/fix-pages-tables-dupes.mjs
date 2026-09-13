/* Fix pages: convert flattened pseudo-tables to real table blocks, add missing place-value
   and drill tables, and drop duplicated section-divider blocks in digitized books. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUR = path.join(__dirname, '../curriculum');
let ops = 0;

function load(f) { return JSON.parse(fs.readFileSync(path.join(CUR, f), 'utf8')); }
function save(f, d) { fs.writeFileSync(path.join(CUR, f), JSON.stringify(d, null, 1) + '\n'); }

function findBlock(lesson, pred) {
  const bl = lesson.studentBlocks || lesson.blocks || [];
  return bl.map((b, i) => ({ b, i })).find(({ b }) => b && pred(b));
}

/* ── 1) year2/math-units.json : pseudo-tables (text pipes) → real tables ── */
{
  const f = 'year2/math-units.json';
  const d = load(f);

  // y2m05 #1: "قطعُ الشطرنجِ | البيدقُ | ... / العددُ | 25 | 13 | 16"
  const l5 = d.y2m05;
  const t5 = findBlock(l5, (b) => b.kind === 'concept' && /قطعُ الشطرنجِ\s*\|/.test(b.text || ''));
  if (t5) {
    Object.assign(t5.b, {
      kind: 'table',
      title: 'الوضعِيّةُ',
      text: 'أكمل جدول قطع الشطرنج:',
      columns: ['قطعُ الشطرنجِ', 'البيدقُ', 'الفرسُ', 'القلعةُ'],
      rows: [['العددُ', '25', '13', '16']]
    });
    ops++;
  }

  // y2m09 #12: "المبلغ المطلوب | القطع الممكنة / 40 مي | ....."
  const l9 = d.y2m09;
  const t9 = findBlock(l9, (b) => b.kind === 'concept' && /المبلغُ المطلوبُ\s*\|/.test(b.text || ''));
  if (t9) {
    Object.assign(t9.b, {
      kind: 'table',
      title: 'أتدرَّبُ',
      text: 'أكمل الجدول بالقطع المناسبة:',
      columns: ['المبلغ المطلوب', 'القطع الممكنة'],
      rows: [['40 مي', ''], ['60 مي', ''], ['85 مي', '']]
    });
    ops++;
  }
  save(f, d);
}

/* ── 2) year3/math-units.json : add missing real tables ── */
{
  const f = 'year3/math-units.json';
  const d = load(f);

  // y3m01 تمرين 1 «أكمل الجدول» → place-value decomposition table for the lesson number 2435
  const l1 = d.y3m01;
  const ex1 = findBlock(l1, (b) => /تمرين\s*1.*أكمل الجدول/.test(`${b.title || ''} ${b.text || ''}`));
  if (ex1 && ex1.b.kind !== 'table') {
    Object.assign(ex1.b, {
      kind: 'table',
      title: '✍️ تمرين 1: أكمل الجدول',
      text: 'فكّك العدد 2435 في جدول المنازل:',
      columns: ['الآلاف', 'المئات', 'العشرات', 'الآحاد'],
      rows: [['', '', '', '']]
    });
    ops++;
  }

  // y3m27 تمرين 1 «جدول الضرب السريع» → real drill table (empty answers)
  const l27 = d.y3m27;
  const ex27 = findBlock(l27, (b) => /جدول الضرب السريع/.test(`${b.title || ''} ${b.text || ''}`));
  if (ex27 && ex27.b.kind !== 'table') {
    Object.assign(ex27.b, {
      kind: 'table',
      title: '✏️ تمرين 1: جدول الضرب السريع',
      text: 'أُكمل الناتجات بسرعة:',
      columns: ['العملية', 'الناتج'],
      rows: [['2 × 3', ''], ['4 × 5', ''], ['3 × 7', ''], ['5 × 6', ''], ['4 × 8', ''], ['6 × 7', '']]
    });
    ops++;
  }
  save(f, d);
}

/* ── 3) year4 & year5 math-situations.json : add جدول المنازل ── */
{
  const HOUSE_COLS = ['الفئات', 'المئات', 'العشرات', 'الآحاد'];
  const houseRows = () => [['الآحاد', '', '', ''], ['الآلاف', '', '', ''], ['الملايين', '', '', '']];

  for (const [f, lid, marker, num] of [
    ['year4/math-situations.json', null, 'ضَعِ الْعَدَدَ 82 453 فِي جَدْوَلِ الْمَنَازِلِ', '82 453'],
    ['year5/math-situations.json', null, 'ضَعِ الْعَدَدَ 8 245 671 فِي جَدْوَلِ الْمَنَازِلِ', '8 245 671']
  ]) {
    const d = load(f);
    const lessons = d.lessons || d;
    let done = false;
    const each = Array.isArray(lessons) ? lessons : Object.values(lessons).filter((x) => x && typeof x === 'object');
    for (const l of each) {
      const bl = l.studentBlocks || l.blocks || [];
      const hit = bl.map((b, i) => ({ b, i })).find(({ b }) => b && String(b.text || '').includes(marker));
      if (!hit) continue;
      // rewrite the instruction to reference the table below it, then insert a real table block after it
      hit.b.text = `ضَعِ الْعَدَدَ ${num} فِي جَدْوَلِ الْمَنَازِلِ التَّالِي، ثُمَّ حَدِّدْ مَنْزِلَةَ الرَّقْمِ ${num.includes('82 453') ? '2' : '4'}.`;
      const table = {
        kind: 'table',
        title: 'جدول المنازل',
        text: '',
        columns: HOUSE_COLS,
        rows: houseRows()
      };
      bl.splice(hit.i + 1, 0, table);
      ops++;
      done = true;
      break;
    }
    if (done) save(f, d);
    else console.log(`marker not found in ${f}`);
  }
}

/* ── 4) drop duplicated empty section-divider concepts (r5m01, r5m23, r5m02, y6m54) ── */
{
  // year5 rafiqi-math5-lessons.json is a lessons dict
  const f = 'year5/rafiqi-math5-lessons.json';
  const d = load(f);
  let removed = 0;
  for (const key of Object.keys(d)) {
    if (key === '_meta') continue;
    const l = d[key];
    const bl = l.studentBlocks || l.blocks;
    if (!Array.isArray(bl)) continue;
    const seen = new Set();
    const kept = [];
    for (const b of bl) {
      if (b && b.kind === 'concept' && !(b.text || '').trim() && !(b.image) && !(b.rows)) {
        const k = (b.title || '').trim();
        if (k) {
          if (seen.has(k)) { removed++; continue; }
          seen.add(k);
        }
      }
      kept.push(b);
    }
    if (l.studentBlocks) l.studentBlocks = kept; else l.blocks = kept;
  }
  if (removed) save(f, d);
  ops += removed;
  console.log('year5 duplicate dividers removed:', removed);
}
{
  const f = 'year6/math-lessons.json';
  const d = load(f);
  let removed = 0;
  for (const key of Object.keys(d)) {
    if (key === '_meta') continue;
    const l = d[key];
    const bl = l.studentBlocks || l.blocks;
    if (!Array.isArray(bl) || bl.length < 2) continue;
    for (let i = 1; i < bl.length; i++) {
      const a = bl[i - 1]; const b = bl[i];
      if (a && b && a.kind === b.kind && b.kind !== 'question' && String(a.text || '').trim() && String(a.text || '').trim() === String(b.text || '').trim() && !b.rows) {
        bl.splice(i, 1); removed++; i--;
      }
    }
  }
  if (removed) save(f, d);
  ops += removed;
  console.log('year6 adjacent exact duplicates removed:', removed);
}

console.log('table/dupe fixes applied:', ops);
