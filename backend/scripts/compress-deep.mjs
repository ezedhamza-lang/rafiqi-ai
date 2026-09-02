// ضغط صور القصص (assets) — إعادة ترميز عالية الجودة دون اتلاف ملحوظ
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ASSETS = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/backend/uploads/assets';
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)}MB`;

let imgBefore = 0;
let imgAfter = 0;
let imgCount = 0;

function walk(dir, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) walk(full, out);
    else out.push(full);
  }
}
const files = [];
walk(ASSETS, files);

for (const full of files) {
  const ext = path.extname(full).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
  const before = fs.statSync(full).size;
  if (before < 80 * 1024) continue;

  const tmp = full + '.tmp';
  try {
    if (ext === '.png') {
      await sharp(full).png({ compressionLevel: 9, palette: true, quality: 88 }).toFile(tmp);
    } else {
      await sharp(full).jpeg({ quality: 82, progressive: true, mozjpeg: true }).toFile(tmp);
    }
    const after = fs.statSync(tmp).size;
    if (after < before * 0.9) {
      fs.renameSync(tmp, full);
      imgBefore += before;
      imgAfter += after;
      imgCount += 1;
      if (imgCount % 25 === 0) console.log(`  ${imgCount}...`);
    } else {
      fs.unlinkSync(tmp);
    }
  } catch {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
console.log(`الصور: ${imgCount} ملفاً | ${mb(imgBefore)} -> ${mb(imgAfter)} (وفّرنا ${mb(imgBefore - imgAfter)})`);