import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { renderPdfFromHtml } from './browserPdf.js';
import { rewardCertificateHtml } from './pdfTemplates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Preferred location for the optional pdf-lib fonts, then the shared assets folder
// that the rest of the platform already uses (pdfUtils.js). Both are probed so the
// service works whichever copy is deployed.
const FONT_DIRS = [
  join(__dirname, '..', '..', 'fonts'),
  join(__dirname, '..', 'assets', 'fonts')
];
const FONT_FILES = [
  { regular: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' },
  { regular: 'Amiri-Regular.ttf', bold: 'Amiri-Bold.ttf' }
];

const BLUE = rgb(0.13, 0.37, 0.65);
const BLUE_DARK = rgb(0.08, 0.25, 0.50);
const GOLD = rgb(0.85, 0.65, 0.13);
const GOLD_LIGHT = rgb(0.95, 0.85, 0.55);
const CREAM = rgb(0.99, 0.97, 0.93);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.5, 0.5, 0.5);

/**
 * Finds the first Arabic TTF pair that actually exists on disk and embeds it.
 * Returns null (never throws) when no pair is present.
 */
async function embedArabicFonts(pdfDoc) {
  // pdf-lib refuses custom (non-standard) fonts until a fontkit implementation is
  // registered — without this it throws "no fontkit instance was found" and the
  // service silently fell back to a Latin-1 font.
  pdfDoc.registerFontkit(fontkit);
  for (const dir of FONT_DIRS) {
    for (const names of FONT_FILES) {
      const regularPath = join(dir, names.regular);
      const boldPath = join(dir, names.bold);
      if (!existsSync(regularPath) || !existsSync(boldPath)) continue;
      try {
        const font = await pdfDoc.embedFont(readFileSync(regularPath));
        const boldFont = await pdfDoc.embedFont(readFileSync(boldPath));
        return { font, boldFont };
      } catch (err) {
        console.error(`[certificate] could not embed ${names.regular}: ${err.message}`);
      }
    }
  }
  return null;
}

export async function generateCertificate(opts) {
  const {
    studentName = 'تلميذ',
    title = 'شهادة إتمام الدروس',
    description = 'قد أتم بنجاح الدروس والأنشطة التعليمية المقررة.',
    subject = '',
    className = '',
    date = new Date().toLocaleDateString('ar-TN'),
    teacherName = 'Ezeddine Hamza',
  } = opts;

  // Primary path: the browser engine renders the Arabic correctly (letter joining +
  // right-to-left order). pdf-lib below cannot shape Arabic, so it stays as the
  // fallback for hosts without a chromium binary — and only with a real Arabic TTF.
  const viaBrowser = await renderPdfFromHtml(
    rewardCertificateHtml({ studentName, title, description, subject, className, date, teacherName })
  );
  if (viaBrowser) return viaBrowser;

  const pdfDoc = await PDFDocument.create();
  let font, boldFont;
  const embedded = await embedArabicFonts(pdfDoc);
  if (embedded) {
    font = embedded.font;
    boldFont = embedded.boldFont;
  } else {
    // A Latin-1 font cannot encode Arabic: drawing Arabic with it throws
    // `WinAnsi cannot encode 0x0631`, which used to surface as HTTP 500 for every
    // certificate. Log it loudly and keep the document Latin-only rather than fake
    // Arabic glyphs.
    console.error(
      '[certificate] no Arabic TTF found in ' + FONT_DIRS.join(' | ') +
      ' — drawing a Latin-only certificate. Install NotoSansArabic-*.ttf or Amiri-*.ttf to restore Arabic text.'
    );
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const page = pdfDoc.addPage([842, 595]);
  const w = page.getWidth();
  const h = page.getHeight();

  // A font only carries the glyphs it was built with: the Arabic TTFs have no
  // emoji, and the standard PDF fonts have no Arabic at all. Measure before
  // drawing — try the other face, and skip an ornament as a last resort — so one
  // missing glyph can never abort the whole document (that is what used to turn
  // every Arabic certificate into HTTP 500).
  const skippedGlyphs = new Set();
  function draw(text, { x, y, size = 12, weight = 'regular', color = GRAY }) {
    if (!text) return;
    const preferred = weight === 'bold' ? boldFont : font;
    const alternate = weight === 'bold' ? font : boldFont;
    let face = null;
    for (const candidate of [preferred, alternate]) {
      try {
        candidate.widthOfTextAtSize(String(text), size);
        face = candidate;
        break;
      } catch {
        // this face cannot encode the string — try the other one
      }
    }
    if (!face) {
      const key = String(text);
      if (!skippedGlyphs.has(key)) {
        skippedGlyphs.add(key);
        console.warn(`[certificate] glyph unavailable in the embedded font, ornament skipped: ${JSON.stringify(key)}`);
      }
      return;
    }
    page.drawText(String(text), { x, y, size, font: face, color });
  }

  /** widthOfTextAtSize that tolerates an unencodable string (returns 0). */
  function measure(text, size) {
    for (const candidate of [font, boldFont]) {
      try {
        return candidate.widthOfTextAtSize(String(text), size);
      } catch {
        // fall through to the other face
      }
    }
    return 0;
  }

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: CREAM });

  page.drawRectangle({ x: 0, y: h - 80, width: w, height: 80, color: BLUE });
  page.drawRectangle({ x: 0, y: h - 84, width: w, height: 4, color: GOLD });

  page.drawRectangle({ x: 0, y: 0, width: w, height: 50, color: BLUE });
  page.drawRectangle({ x: 0, y: 50, width: w, height: 3, color: GOLD });

  page.drawRectangle({ x: 0, y: h - 84, width: 60, height: 4, color: GOLD });
  page.drawRectangle({ x: 0, y: h - 84, width: 4, height: 60, color: GOLD });
  page.drawRectangle({ x: w - 60, y: h - 84, width: 60, height: 4, color: GOLD });
  page.drawRectangle({ x: w - 4, y: h - 84, width: 4, height: 60, color: GOLD });
  page.drawRectangle({ x: 0, y: 50, width: 60, height: 3, color: GOLD });
  page.drawRectangle({ x: 0, y: 0, width: 4, height: 53, color: GOLD });
  page.drawRectangle({ x: w - 60, y: 50, width: 60, height: 3, color: GOLD });
  page.drawRectangle({ x: w - 4, y: 0, width: 4, height: 53, color: GOLD });

  draw('رفيقي', { x: w / 2 - 25, y: h - 45, size: 18, weight: 'bold', color: WHITE });
  draw('للحياة المدرسية', { x: w / 2 - 40, y: h - 62, size: 10, color: GOLD_LIGHT });

  draw('https://rafiqi-platform.onrender.com', { x: w / 2 - 80, y: 18, size: 8, color: GOLD_LIGHT });

  draw(title, { x: w / 2 - 140, y: h - 130, size: 36, weight: 'bold', color: BLUE_DARK });

  page.drawRectangle({
    x: w / 2 - 150, y: h - 140, width: 300, height: 3, color: GOLD,
  });

  const subText = 'منفوها منصة رفيقي للحياة المدرسية';
  const subW = measure(subText, 12);
  page.drawRectangle({
    x: (w - subW - 40) / 2, y: h - 165, width: subW + 40, height: 22,
    color: GOLD,
  });
  draw(subText, { x: (w - subW) / 2, y: h - 160, size: 12, color: BLUE_DARK });

  draw('تشهد منصة رفيقي للحياة المدرسية بأن التلميذ/التلميذة', {
    x: w / 2 - 160, y: h - 200, size: 11, color: GRAY,
  });

  page.drawRectangle({
    x: w / 2 - 180, y: h - 245, width: 360, height: 35,
    borderColor: BLUE, borderWidth: 1.5,
  });
  const nameW = measure(studentName, 22);
  draw(studentName, { x: (w - nameW) / 2, y: h - 237, size: 22, weight: 'bold', color: BLUE_DARK });

  const descW = measure(description, 11);
  draw(description, { x: (w - descW) / 2, y: h - 270, size: 11, color: GRAY });

  const detailsY = h - 310;
  const leftCol = w / 2 - 180;
  const rightCol = w / 2 + 30;

  draw('القسم:', { x: rightCol, y: detailsY, size: 12, weight: 'bold', color: BLUE });
  draw(className || '...', { x: rightCol - 60, y: detailsY, size: 12, color: GRAY });

  draw('المادة:', { x: leftCol + 130, y: detailsY, size: 12, weight: 'bold', color: BLUE });
  draw(subject || '...', { x: leftCol + 70, y: detailsY, size: 12, color: GRAY });

  const row2Y = detailsY - 35;
  draw('التاريخ:', { x: rightCol, y: row2Y, size: 12, weight: 'bold', color: BLUE });
  draw(date, { x: rightCol - 60, y: row2Y, size: 12, color: GRAY });

  draw('الأستاذ(ة):', { x: leftCol + 130, y: row2Y, size: 12, weight: 'bold', color: BLUE });
  draw(teacherName, { x: leftCol + 70, y: row2Y, size: 12, color: GRAY });

  const stars = [
    [80, h - 130], [w - 80, h - 130],
    [60, h - 250], [w - 60, h - 250],
    [100, 100], [w - 100, 100],
  ];
  stars.forEach(([x, y]) => {
    draw('\u2605', { x: x - 6, y: y - 6, size: 14, weight: 'bold', color: GOLD });
  });

  draw('\u{1F4DA}', { x: 50, y: h / 2 - 20, size: 30, color: BLUE });
  draw('\u{1F4D6}', { x: 55, y: h / 2 - 60, size: 25, color: GOLD });
  draw('\u270F\uFE0F', { x: w - 80, y: h / 2 - 20, size: 30, color: BLUE });
  draw('\u{1F4DD}', { x: w - 75, y: h / 2 - 60, size: 25, color: GOLD });
  draw('\u2708\uFE0F', { x: w - 100, y: h - 110, size: 20, color: BLUE });
  draw('\u{1F33F}', { x: 30, y: 60, size: 18, color: rgb(0.2, 0.6, 0.3) });
  draw('\u{1F33F}', { x: w - 50, y: 60, size: 18, color: rgb(0.2, 0.6, 0.3) });

  page.drawCircle({
    x: w / 2, y: 100, size: 28,
    color: WHITE, borderColor: GOLD, borderWidth: 3,
  });
  draw('\u{1F393}', { x: w / 2 - 10, y: 93, size: 18, color: BLUE });

  draw('رفيقي ... رفيقك في التعلم والحياة المدرسية', {
    x: w / 2 - 100, y: 20, size: 9, color: GOLD_LIGHT,
  });
  draw('\u2665', { x: w / 2 - 5, y: 8, size: 10, color: GOLD });

  page.drawRectangle({ x: 20, y: 60, width: 2, height: h - 150, color: GOLD_LIGHT });
  page.drawRectangle({ x: w - 22, y: 60, width: 2, height: h - 150, color: GOLD_LIGHT });

  return pdfDoc.save();
}

export async function generateLevelCertificate(studentName, level) {
  return generateCertificate({
    studentName,
    title: 'شهادة المستوى ' + level,
    description: 'تهانينا! لقد وصلت إلى المستوى ' + level + ' بنجاح.',
    level,
  });
}

export async function generateSubjectCertificate(studentName, subject) {
  return generateCertificate({
    studentName,
    title: 'شهادة إتمام الدروس',
    subject,
  });
}

export async function generateChallengeCertificate(studentName, week) {
  return generateCertificate({
    studentName,
    title: 'شهادة الفائز بالتحدي الأسبوعي',
    description: 'الفائز بالتحدي الأسبوعي — الأسبوع ' + week,
  });
}
