// توليد أيقونات PWA من SVG بسيط (شعار رفيقي) بأحجام البيان المطلوبة
import sharp from 'sharp';
import fs from 'fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b6fd4"/>
      <stop offset="100%" stop-color="#7b3fa0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="300" text-anchor="middle" font-size="230" font-weight="800"
        font-family="Segoe UI, Arial" fill="#ffffff">ر</text>
  <circle cx="392" cy="128" r="34" fill="#ffd54f"/>
</svg>`;

const out = 'C:/Users/ezedd/OneDrive - ANETI/Bureau/rafiqi/frontend/public';
fs.mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${out}/icon-${size}.png`);
  console.log(`icon-${size}.png ✓`);
}
console.log('PWA icons generated');