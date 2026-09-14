import sharp from 'sharp';
import { readdirSync, unlinkSync, statSync } from 'fs';
import { resolve } from 'path';

const DIR = resolve('frontend/public/assets/books/y2french');
const files = readdirSync(DIR).filter(f => f.endsWith('.png')).sort();

console.log(`Converting ${files.length} PNGs to WebP...`);

for (const f of files) {
  const src = resolve(DIR, f);
  const dst = resolve(DIR, f.replace('.png', '.webp'));
  const before = statSync(src).size;
  
  await sharp(src)
    .webp({ quality: 85 })
    .toFile(dst);
  
  const after = statSync(dst).size;
  const pct = Math.round((1 - after / before) * 100);
  console.log(`${f} → ${f.replace('.png', '.webp')} (${Math.round(before/1024)}KB → ${Math.round(after/1024)}KB, -${pct}%)`);
  
  // Remove original PNG
  unlinkSync(src);
}

console.log('Done!');
