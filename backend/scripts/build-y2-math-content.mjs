import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(process.argv[2]);
const MEDIA = path.join(process.env.TEMP || process.env.TMP, 'mg2x', 'word', 'media');
const mapping = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/BOOK_Y2_MATH_MAPPING.json'), 'utf8'));
const unitsPath = path.join(ROOT, 'backend/curriculum/year2/math-units.json');
const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));

const FE_DIR = path.join(ROOT, 'frontend/public/curriculum/y2/math');
const BE_DIR = path.join(ROOT, 'backend/uploads/curriculum/y2/math');
fs.mkdirSync(FE_DIR, { recursive: true });
fs.mkdirSync(BE_DIR, { recursive: true });

const ICONS = new Set(['media/image1.png', 'media/image2.png', 'media/image3.png', 'media/image4.png']);
const usage = {};
for (const m of mapping.mapping) for (const im of m.images || []) usage[im] = (usage[im] || 0) + 1;
for (const [k, v] of Object.entries(usage)) if (v >= 5) ICONS.add(k);

const SECTION_LABELS = {
  intro: null, warmup: 'أختبرُ ذهنيًّا', explore: 'أستكشفُ', recall: 'أتذكَّرُ',
  practice: 'أتدرَّبُ', apply: 'أوظِّفُ', challenge: 'تحدٍّ', assessment: 'أقوِّمُ',
  steps: 'خطواتي في حلّ الوضعيّة', situation: 'الوضعيّة'
};
const SECTION_ORDER = ['intro', 'warmup', 'explore', 'recall', 'practice', 'apply', 'challenge', 'steps', 'situation', 'assessment'];

function norm(s) {
  return String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[،؛:.!?ـ()\u200e\u200f\u2014\u2026\u27E6\u27E7\u201C\u201D]/g, ' ').replace(/\u0627\u0644/g, '\u0627').replace(/\s+/g, ' ').trim().toLowerCase();
}

const copied = [];
let totalBlocks = 0;
let lessonsWithImages = 0;

for (const m of mapping.mapping) {
  if (!m.code || !m.y2) continue;
  const lesson = units[m.y2];
  if (!lesson) continue;
  const sections = mapping.sectionsByCode[m.code] || {};
  const blocks = [];
  const imagesMeta = [];
  let imgSeq = 0;
  let lastText = '';

  for (const sec of SECTION_ORDER) {
    const items = sections[sec] || [];
    const label = SECTION_LABELS[sec];
    let textBuf = [];
    const flushText = () => {
      const joined = textBuf.join('\n').trim();
      textBuf = [];
      if (joined) blocks.push({ kind: 'concept', title: label || lesson.title, text: joined });
    };
    for (const it of items) {
      const t = String(it.text || '').trim();
      if (t && !it.images.length) {
        const nt = norm(t);
        if (t.length < 3 || /^\d+$/.test(t)) continue;
        if (label && nt === norm(label)) continue;
        if (nt === norm(lesson.title) || nt === norm(m.docTitle)) continue;
        const isQuestion = /^\d+\.\s/.test(t) || t.includes('؟') || (label === 'أختبرُ ذهنيًّا' || label === 'أقوِّمُ');
        if (isQuestion) {
          flushText();
          blocks.push({ kind: 'question', title: label ? `${label} (${t.match(/^\d+\./)?.[0] || ''})`.trim() : 'سؤال', text: t.replace(/^\d+\.\s*/, '') });
        } else {
          textBuf.push(t);
        }
        lastText = t;
        continue;
      }
      for (const im of it.images || []) {
        if (ICONS.has(im)) continue;
        const src = path.join(MEDIA, path.basename(im));
        if (!fs.existsSync(src)) continue;
        imgSeq += 1;
        const name = `${m.y2}-${imgSeq}`;
        for (const dir of [FE_DIR, BE_DIR]) {
          const dest = path.join(dir, `${name}.png`);
          if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
        }
        copied.push(`${name}.png`);
        const imageId = `img-${m.y2}-${imgSeq}`;
        const caption = lastText && lastText.length <= 160 ? lastText : (label || lesson.title);
        blocks.push({ kind: 'concept', title: label || 'صورة الدرس', image: `/curriculum/y2/math/${name}.png`, imageId, alt: caption });
        imagesMeta.push({ imageId, src: `/curriculum/y2/math/${name}.png`, section: sec, caption });
      }
    }
    flushText();
  }

  if (!blocks.length) continue;
  lesson.studentBlocks = blocks;
  lesson.images = imagesMeta;
  if (imagesMeta.length) {
    lesson.image = imagesMeta[0].src;
    lessonsWithImages += 1;
  }
  totalBlocks += blocks.length;
}

fs.writeFileSync(unitsPath, JSON.stringify(units, null, 1) + '\n', 'utf8');

const py = `
from PIL import Image
import os, sys
for d in [r"${FE_DIR}", r"${BE_DIR}"]:
    if not os.path.isdir(d): continue
    for f in os.listdir(d):
        if f.endswith('.png'):
            out = os.path.join(d, f[:-4] + '.webp')
            if not os.path.exists(out):
                im = Image.open(os.path.join(d, f)).convert('RGB')
                im.save(out, 'WEBP', quality=82)
                print('webp', f)
`;
const pyFile = path.join(process.env.TEMP || process.env.TMP, 'webp_y2.py');
fs.writeFileSync(pyFile, py, 'utf8');
try { execFileSync('python', [pyFile], { stdio: 'inherit' }); } catch (e) { console.log('webp step failed:', e.message); }

console.log('lessons updated with studentBlocks:', Object.values(units).filter((u) => u && u.studentBlocks).length);
console.log('lessons with images:', lessonsWithImages, '| images copied:', copied.length, '| total blocks:', totalBlocks);
console.log('icons excluded:', ICONS.size);
