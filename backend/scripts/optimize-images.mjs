// ضغط صور المنصة الثقيلة في مكانها (نفس الاسم/المسار — لا تغيير في الروابط)
// sharp: تصغير للأبعاد القصوى + ضغط PNG بلوحة ألوان. يُطبع تقرير قبل/بعد.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BASE = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/uploads';
const FOLDERS = ['media', 'svg', 'islamic', 'tech', 'science', 'intaj'];
const MAX_DIM = 1024;
const MIN_SIZE = 120 * 1024; // لا نتعب مع الصغيرات

const fmt = (b) => `${(b / 1024 / 1024).toFixed(2)}MB`;

let totalBefore = 0;
let totalAfter = 0;
let count = 0;

for (const folder of FOLDERS) {
  const dir = path.join(BASE, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.png')) continue;
    const full = path.join(dir, file);
    const before = fs.statSync(full).size;
    if (before < MIN_SIZE) continue;

    const tmp = full + '.tmp.png';
    try {
      const img = sharp(full);
      const meta = await img.metadata();
      const resizeNeeded = Math.max(meta.width, meta.height) > MAX_DIM;
      let pipeline = sharp(full);
      if (resizeNeeded) pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside' });
      await pipeline
        .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
        .toFile(tmp);

      const after = fs.statSync(tmp).size;
      if (after < before * 0.9) {
        fs.renameSync(tmp, full);
        totalBefore += before;
        totalAfter += after;
        count += 1;
        console.log(`✓ ${folder}/${file}: ${fmt(before)} -> ${fmt(after)} (${Math.round((1 - after / before) * 100)}% أصغر${resizeNeeded ? `, ${meta.width}x${meta.height}->≤${MAX_DIM}` : ''})`);
      } else {
        fs.unlinkSync(tmp);
        console.log(`- ${folder}/${file}: بلا مكسب، أُبقي كما هو`);
      }
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.log(`✗ ${folder}/${file}: ${String(e).slice(0, 60)}`);
    }
  }
}

console.log('========================================');
console.log(`صور مضغوطة: ${count} | الحجم: ${fmt(totalBefore)} -> ${fmt(totalAfter)} (وفّرنا ${fmt(totalBefore - totalAfter)})`);