import fs from 'fs';
import path from 'path';

/**
 * استخراج متسلسل أمين من Math_Grade2_Tunisia.docx:
 * يمشي على عناصر <w:body> بالترتيب (فقرة / جدول) ويحتفظ بجداول الصف/العمود
 * وبصور داخل الجدول — ثم يفصل الدروس بعلامات [Pn-k] في Titre2.
 * المخرج: docs/y2-math-source-seq.json
 */
const ROOT = process.argv[2];
const X = process.env.TEMP || process.env.TMP;
const xml = fs.readFileSync(path.join(X, 'mg2x/word/document.xml'), 'utf8');
const rels = fs.readFileSync(path.join(X, 'mg2x/word/_rels/document.xml.rels'), 'utf8');
const relMap = {};
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)[1];
const tokens = [...body.matchAll(/<w:p [^>]*>[\s\S]*?<\/w:p>|<w:p>[\s\S]*?<\/w:p>|<w:p\/>|<w:tbl>[\s\S]*?<\/w:tbl>/g)];

function decode(t) {
  return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
}
function paraItem(p) {
  const style = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '';
  const texts = decode([...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
  const imgs = [...p.matchAll(/r:embed="([^"]+)"/g)].map((m) => (relMap[m[1]] || m[1]).replace('media/', ''));
  return { type: 'p', style, t: texts, imgs };
}
function tableItem(tbl) {
  const rows = [...tbl.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>|<w:tr>[\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>|<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => {
      const texts = decode([...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''));
      const imgs = [...c[0].matchAll(/r:embed="([^"]+)"/g)].map((m) => (relMap[m[1]] || m[1]).replace('media/', ''));
      return { t: texts, imgs };
    })
  );
  return { type: 'tbl', rows };
}

const lessons = [];
let cur = null;
const preItems = [];
for (const tk of tokens) {
  const raw = tk[0];
  if (raw.startsWith('<w:tbl>')) {
    if (cur) cur.items.push(tableItem(raw));
    else preItems.push(tableItem(raw));
    continue;
  }
  const it = paraItem(raw);
  const codeM = it.t.match(/\[(P\d-\d+)\]/);
  if (it.style === 'Titre2' && codeM) {
    cur = { code: codeM[1], title: it.t.replace(/\[(P\d-\d+)\]/g, '').replace(/^\s*\d+\.\s*/, '').trim(), items: [] };
    lessons.push(cur);
    continue;
  }
  if (cur && (it.t || it.imgs.length)) cur.items.push(it);
  else if (!cur && (it.t || it.imgs.length)) preItems.push(it);
}

// خريطة أيقونات الأقسام من جدول «كيف أستعمل كتابي؟» (صورة ↔ عنوان القسم)
const legendIcons = {};
const SEC = [
  [/ختبر/iu, 'warmup'], [/ستكشف/iu, 'explore'], [/تذكر/iu, 'recall'], [/تدر/iu, 'practice'],
  [/وظ/iu, 'apply'], [/تحد/iu, 'challenge'], [/قو/iu, 'assessment'], [/وضع|خطو/iu, 'situation']
];
for (const pi of preItems) {
  if (pi.type !== 'tbl') continue;
  for (const r of pi.rows) {
    const imgs = r.flatMap((c) => c.imgs || []);
    const txt = r.map((c) => c.t).join(' ');
    const head = txt.split(':')[0] || txt;
    const n = head
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه');
    for (const [re, key] of SEC) {
      if (imgs.length && re.test(n)) { for (const im of imgs) if (!(im in legendIcons)) legendIcons[im] = key; }
    }
  }
}

fs.writeFileSync(path.join(ROOT, 'docs/y2-math-source-seq.json'), JSON.stringify({ lessons, legendIcons }, null, 1), 'utf8');
const tbl = lessons.map((l) => ({ code: l.code, tables: l.items.filter((i) => i.type === 'tbl').length }));
console.log('lessons:', lessons.length, '| with tables:', tbl.filter((t) => t.tables).length);
console.log('per-lesson table counts:', tbl.filter((t) => t.tables).map((t) => t.code + ':' + t.tables).join(' '));
