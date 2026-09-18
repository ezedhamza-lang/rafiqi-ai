import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, '..', '..', 'fonts');

/**
 * Generate a beautiful PDF certificate for a student.
 * @param {Object} opts
 * @param {string} opts.studentName - Full name of the student
 * @param {string} opts.title - Certificate title (e.g. "شهادة إتمام")
 * @param {string} opts.description - What the certificate is for
 * @param {string} opts.subject - Subject name (optional)
 * @param {number} opts.level - Student level (optional)
 * @param {number} opts.xp - XP earned (optional)
 * @param {string} opts.date - Date string (optional)
 * @param {string} opts.teacherName - Teacher/admin name (optional)
 * @returns {Buffer} PDF buffer
 */
export async function generateCertificate(opts) {
  const {
    studentName = 'تلميذ',
    title = 'شهادة إتمام',
    description = 'تم إتمام المادة بنجاح',
    subject = '',
    level = 1,
    xp = 0,
    date = new Date().toLocaleDateString('ar-TN'),
    teacherName = 'Ezeddine Hamza',
  } = opts;

  const pdfDoc = await PDFDocument.create();

  // Try to embed an Arabic-compatible font, fallback to Helvetica
  let font, boldFont;
  try {
    const fontPath = join(FONT_DIR, 'NotoSansArabic-Regular.ttf');
    const boldPath = join(FONT_DIR, 'NotoSansArabic-Bold.ttf');
    const fontBytes = readFileSync(fontPath);
    const boldBytes = readFileSync(boldPath);
    font = await pdfDoc.embedFont(fontBytes);
    boldFont = await pdfDoc.embedFont(boldBytes);
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const page = pdfDoc.addPage([595, 842]); // A4
  const w = page.getWidth();
  const h = page.getHeight();

  // === BACKGROUND ===
  // Light cream background
  page.drawRectangle({
    x: 0, y: 0, width: w, height: h,
    color: rgb(0.99, 0.98, 0.95),
  });

  // === DECORATIVE BORDER ===
  // Outer gold border
  page.drawRectangle({
    x: 25, y: 25, width: w - 50, height: h - 50,
    borderColor: rgb(0.85, 0.65, 0.13),
    borderWidth: 3,
  });

  // Inner decorative border
  page.drawRectangle({
    x: 35, y: 35, width: w - 70, height: h - 70,
    borderColor: rgb(0.85, 0.65, 0.13),
    borderWidth: 1,
  });

  // Corner stars
  const starPositions = [
    [55, h - 55], [w - 55, h - 55],
    [55, 55], [w - 55, 55],
  ];
  starPositions.forEach(([x, y]) => {
    page.drawText('★', {
      x: x - 8, y: y - 8, size: 16,
      font: boldFont,
      color: rgb(0.85, 0.65, 0.13),
    });
  });

  // === HEADER AREA ===
  // School logo area
  page.drawText('🏫', {
    x: w / 2 - 20, y: h - 100, size: 40,
    color: rgb(0.85, 0.65, 0.13),
  });

  // School name
  page.drawText('منصة رفيقي التعليمية', {
    x: w / 2 - 80, y: h - 140, size: 16,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  // === MAIN TITLE ===
  page.drawText('✦ ' + title + ' ✦', {
    x: w / 2 - 100, y: h - 200, size: 28,
    font: boldFont,
    color: rgb(0.85, 0.65, 0.13),
  });

  // Decorative line under title
  page.drawLine({
    start: { x: 100, y: h - 215 },
    end: { x: w - 100, y: h - 215 },
    thickness: 2,
    color: rgb(0.85, 0.65, 0.13),
  });

  // === STUDENT NAME ===
  page.drawText('تُمنح هذه الشهادة إلى', {
    x: w / 2 - 70, y: h - 260, size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Student name (large)
  const nameWidth = boldFont.widthOfTextAtSize(studentName, 26);
  page.drawText(studentName, {
    x: (w - nameWidth) / 2, y: h - 300, size: 26,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Underline for name
  page.drawLine({
    start: { x: 100, y: h - 305 },
    end: { x: w - 100, y: h - 305 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // === DESCRIPTION ===
  const descWidth = font.widthOfTextAtSize(description, 14);
  page.drawText(description, {
    x: (w - descWidth) / 2, y: h - 350, size: 14,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // === SUBJECT (if provided) ===
  if (subject) {
    const subjectText = 'المادة: ' + subject;
    const subWidth = font.widthOfTextAtSize(subjectText, 13);
    page.drawText(subjectText, {
      x: (w - subWidth) / 2, y: h - 380, size: 13,
      font,
      color: rgb(0.2, 0.5, 0.2),
    });
  }

  // === LEVEL & XP ===
  if (level > 1 || xp > 0) {
    const infoY = h - 410;
    const parts = [];
    if (level > 1) parts.push('المستوى: ' + level);
    if (xp > 0) parts.push('XP: ' + xp);
    const infoText = parts.join('  |  ');
    const infoWidth = font.widthOfTextAtSize(infoText, 12);
    page.drawText(infoText, {
      x: (w - infoWidth) / 2, y: infoY, size: 12,
      font,
      color: rgb(0.5, 0.4, 0.2),
    });
  }

  // === DECORATIVE MEDAL ===
  page.drawText('🏅', {
    x: w / 2 - 25, y: h - 480, size: 50,
    color: rgb(0.85, 0.65, 0.13),
  });

  // === SIGNATURES ===
  // Left signature
  page.drawLine({
    start: { x: 70, y: 150 },
    end: { x: 220, y: 150 },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });
  page.drawText(teacherName, {
    x: 80, y: 130, size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawText('المدير / الأستاذ', {
    x: 100, y: 115, size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Right signature
  page.drawLine({
    start: { x: w - 220, y: 150 },
    end: { x: w - 70, y: 150 },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });
  page.drawText('توقيع ولي الأمر', {
    x: w - 170, y: 130, size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // === DATE ===
  const dateText = 'التاريخ: ' + date;
  const dateWidth = font.widthOfTextAtSize(dateText, 10);
  page.drawText(dateText, {
    x: (w - dateWidth) / 2, y: 90, size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // === FOOTER ===
  page.drawText('منصة رفيقي — م designed by Ezeddine Hamza', {
    x: w / 2 - 100, y: 60, size: 8,
    font,
    color: rgb(0.7, 0.7, 0.7),
  });

  return pdfDoc.save();
}

/**
 * Generate a level-up certificate
 */
export async function generateLevelCertificate(studentName, level) {
  return generateCertificate({
    studentName,
    title: 'شهادة المستوى ' + level,
    description: 'تهانينا! لقد وصلت إلى المستوى ' + level,
    level,
  });
}

/**
 * Generate a subject completion certificate
 */
export async function generateSubjectCertificate(studentName, subject) {
  return generateCertificate({
    studentName,
    title: 'شهادة إتمام المادة',
    description: 'تم إتمام مادة ' + subject + ' بنجاح',
    subject,
  });
}

/**
 * Generate a weekly challenge winner certificate
 */
export async function generateChallengeCertificate(studentName, week) {
  return generateCertificate({
    studentName,
    title: 'شهادة الفائز بالتحدي الأسبوعي',
    description: 'الفائز بالتحدي الأسبوعي — الأسبوع ' + week,
  });
}
