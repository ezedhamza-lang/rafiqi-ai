import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, '..', '..', 'fonts');

const BLUE = rgb(0.13, 0.37, 0.65);
const BLUE_DARK = rgb(0.08, 0.25, 0.50);
const GOLD = rgb(0.85, 0.65, 0.13);
const GOLD_LIGHT = rgb(0.95, 0.85, 0.55);
const CREAM = rgb(0.99, 0.97, 0.93);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

export async function generateCertificate(opts) {
  const {
    studentName = 'تلميذ',
    title = 'شهادة إتمام الدروس',
    description = 'ت见证 منصة رفيقي للحياة المدرسية بأن التلميذ/التلميذة قد أتم بنجاح الدروس والأنشطة التعليمية المقررة.',
    subject = '',
    className = '',
    level = 1,
    xp = 0,
    date = new Date().toLocaleDateString('ar-TN'),
    teacherName = 'Ezeddine Hamza',
  } = opts;

  const pdfDoc = await PDFDocument.create();
  let font, boldFont;
  try {
    const fontPath = join(FONT_DIR, 'NotoSansArabic-Regular.ttf');
    const boldPath = join(FONT_DIR, 'NotoSansArabic-Bold.ttf');
    font = await pdfDoc.embedFont(readFileSync(fontPath));
    boldFont = await pdfDoc.embedFont(readFileSync(boldPath));
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const page = pdfDoc.addPage([842, 595]);
  const w = page.getWidth();
  const h = page.getHeight();

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

  page.drawText('رفيقي', {
    x: w / 2 - 25, y: h - 45, size: 18, font: boldFont, color: WHITE,
  });
  page.drawText('للحياة المدرسية', {
    x: w / 2 - 40, y: h - 62, size: 10, font, color: GOLD_LIGHT,
  });

  page.drawText('https://rafiqi-platform.onrender.com', {
    x: w / 2 - 80, y: 18, size: 8, font, color: GOLD_LIGHT,
  });

  page.drawText(title, {
    x: w / 2 - 140, y: h - 130, size: 36, font: boldFont, color: BLUE_DARK,
  });

  page.drawRectangle({
    x: w / 2 - 150, y: h - 140, width: 300, height: 3, color: GOLD,
  });

  const subText = 'منفوها منصة رفيقي للحياة المدرسية';
  const subW = font.widthOfTextAtSize(subText, 12);
  page.drawRectangle({
    x: (w - subW - 40) / 2, y: h - 165, width: subW + 40, height: 22,
    color: GOLD,
  });
  page.drawText(subText, {
    x: (w - subW) / 2, y: h - 160, size: 12, font, color: BLUE_DARK,
  });

  page.drawText('تشهد منصة رفيقي للحياة المدرسية بأن التلميذ/التلميذة', {
    x: w / 2 - 160, y: h - 200, size: 11, font, color: GRAY,
  });

  page.drawRectangle({
    x: w / 2 - 180, y: h - 245, width: 360, height: 35,
    borderColor: BLUE, borderWidth: 1.5,
  });
  const nameW = boldFont.widthOfTextAtSize(studentName, 22);
  page.drawText(studentName, {
    x: (w - nameW) / 2, y: h - 237, size: 22, font: boldFont, color: BLUE_DARK,
  });

  const descText = 'قد أتم بنجاح الدروس والأنشطة التعليمية المقررة.';
  const descW = font.widthOfTextAtSize(descText, 11);
  page.drawText(descText, {
    x: (w - descW) / 2, y: h - 270, size: 11, font, color: GRAY,
  });

  const detailsY = h - 310;
  const leftCol = w / 2 - 180;
  const rightCol = w / 2 + 30;

  page.drawText('القسم:', { x: rightCol, y: detailsY, size: 12, font: boldFont, color: BLUE });
  page.drawText(className || '...', { x: rightCol - 60, y: detailsY, size: 12, font, color: GRAY });

  page.drawText('المادة:', { x: leftCol + 130, y: detailsY, size: 12, font: boldFont, color: BLUE });
  page.drawText(subject || '...', { x: leftCol + 70, y: detailsY, size: 12, font, color: GRAY });

  const row2Y = detailsY - 35;
  page.drawText('التاريخ:', { x: rightCol, y: row2Y, size: 12, font: boldFont, color: BLUE });
  page.drawText(date, { x: rightCol - 60, y: row2Y, size: 12, font, color: GRAY });

  page.drawText('الأستاذ(ة):', { x: leftCol + 130, y: row2Y, size: 12, font: boldFont, color: BLUE });
  page.drawText(teacherName, { x: leftCol + 70, y: row2Y, size: 12, font, color: GRAY });

  const stars = [
    [80, h - 130], [w - 80, h - 130],
    [60, h - 250], [w - 60, h - 250],
    [100, 100], [w - 100, 100],
  ];
  stars.forEach(([x, y]) => {
    page.drawText('\u2605', { x: x - 6, y: y - 6, size: 14, font: boldFont, color: GOLD });
  });

  page.drawText('\u{1F4DA}', { x: 50, y: h / 2 - 20, size: 30, color: BLUE });
  page.drawText('\u{1F4D6}', { x: 55, y: h / 2 - 60, size: 25, color: GOLD });
  page.drawText('\u270F\uFE0F', { x: w - 80, y: h / 2 - 20, size: 30, color: BLUE });
  page.drawText('\u{1F4DD}', { x: w - 75, y: h / 2 - 60, size: 25, color: GOLD });
  page.drawText('\u2708\uFE0F', { x: w - 100, y: h - 110, size: 20, color: BLUE });
  page.drawText('\u{1F33F}', { x: 30, y: 60, size: 18, color: rgb(0.2, 0.6, 0.3) });
  page.drawText('\u{1F33F}', { x: w - 50, y: 60, size: 18, color: rgb(0.2, 0.6, 0.3) });

  page.drawCircle({
    x: w / 2, y: 100, size: 28,
    color: WHITE, borderColor: GOLD, borderWidth: 3,
  });
  page.drawText('\u{1F393}', { x: w / 2 - 10, y: 93, size: 18, color: BLUE });

  page.drawText('رفيقي ... رفيقك في التعلم والحياة المدرسية', {
    x: w / 2 - 100, y: 20, size: 9, font, color: GOLD_LIGHT,
  });
  page.drawText('\u2665', { x: w / 2 - 5, y: 8, size: 10, font, color: GOLD });

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
