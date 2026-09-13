/* Year2 digitized books: exercise columns repeat identical labels
   («الناتج أفقيًّا…», «أكمل العمليات العمودية…») — mark them (أ)(ب)(ج) so the screen
   doesn't look like accidental duplication, matching real worksheet layout. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../curriculum/year2/math-units.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
let changed = 0;

for (const key of Object.keys(d)) {
  if (key === '_meta') continue;
  const l = d[key];
  const bl = l.studentBlocks || l.blocks;
  if (!Array.isArray(bl)) continue;
  const groups = new Map();
  bl.forEach((b, i) => {
    if (!b || !['question', 'textarea', 'math-input', 'table'].includes(b.kind)) return;
    const sig = `${(b.title || '').trim()}|${(b.text || '').trim()}`;
    if (sig === '|') return;
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(i);
  });
  for (const [, idxs] of groups) {
    if (idxs.length < 2) continue;
    idxs.forEach((i, n) => {
      const b = bl[i];
      const suffix = ` (${LETTERS[n] || n + 1})`;
      if (b.kind === 'table' && (b.rows || []).length) {
        b.title = `${(b.title || 'أكمل العمليات العمودية').trim()}${suffix}`;
      } else {
        b.title = `${(b.title || 'الناتج').trim()}${suffix}`;
        if (!b.text && b.kind === 'question') b.text = bl[i - 1]?.text ? '' : b.text;
      }
      changed++;
    });
  }
}
fs.writeFileSync(FILE, JSON.stringify(d, null, 1) + '\n');
console.log('labeled blocks:', changed);
