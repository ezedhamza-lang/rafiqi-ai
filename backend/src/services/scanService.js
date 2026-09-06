import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EXAMS_UPLOAD_DIR = path.join(__dirname, '../../uploads/exams');
export const MAX_SCAN_PAGES = 10;
export const MAX_SCAN_BYTES = 25 * 1024 * 1024;

export function ensureUploadDir() {
  if (!fs.existsSync(EXAMS_UPLOAD_DIR)) {
    fs.mkdirSync(EXAMS_UPLOAD_DIR, { recursive: true });
  }
}

function detectImageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  return 'jpeg';
}

export async function mergeImagesToPdf(imagePaths) {
  ensureUploadDir();
  const pdfDoc = await PDFDocument.create();

  for (const filePath of imagePaths) {
    const buffer = fs.readFileSync(filePath);
    let image;
    const type = detectImageType(buffer);
    try {
      image = type === 'png' ? await pdfDoc.embedPng(buffer) : await pdfDoc.embedJpg(buffer);
    } catch {
      image = await pdfDoc.embedJpg(buffer);
    }

    const page = pdfDoc.addPage([595.28, 841.89]);
    const margin = 12;
    const availW = page.getWidth() - margin * 2;
    const availH = page.getHeight() - margin * 2;

    const scale = Math.min(availW / image.width, availH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (page.getWidth() - w) / 2;
    const y = (page.getHeight() - h) / 2;

    page.drawImage(image, { x, y, width: w, height: h });
  }

  const bytes = await pdfDoc.save();
  const outName = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const outPath = path.join(EXAMS_UPLOAD_DIR, outName);
  fs.writeFileSync(outPath, bytes);
  return { path: outPath, url: `/uploads/exams/${outName}`, fileName: outName };
}
