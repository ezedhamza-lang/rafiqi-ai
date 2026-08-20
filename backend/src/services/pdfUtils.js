import path from 'path';
import { fileURLToPath } from 'url';
import { Writable } from 'stream';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = path.join(__dirname, '../assets/fonts');

export const FONT_REGULAR = path.join(FONT_DIR, 'Amiri-Regular.ttf');
export const FONT_BOLD = path.join(FONT_DIR, 'Amiri-Bold.ttf');

export const PAGE = { width: 595.28, height: 841.89, margin: 48 };
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

export const COLORS = {
  cyan: '#0FA6E8',
  dark: '#1F1F1F',
  gray: '#595959',
  white: '#FFFFFF',
  light: '#FAFAFA',
  lightCyan: '#E6F6FD'
};

export function createDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
  doc.registerFont('Amiri', FONT_REGULAR);
  doc.registerFont('AmiriBold', FONT_BOLD);
  return doc;
}

export function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      }
    });
    doc.pipe(sink);
    sink.on('finish', () => resolve(Buffer.concat(chunks)));
    sink.on('error', reject);
    doc.end();
  });
}

export class PdfLayout {
  constructor(doc) {
    this.doc = doc;
    this.y = PAGE.margin;
    this.pageNo = 1;
  }

  ensure(needed = 24) {
    if (this.y + needed > PAGE.height - PAGE.margin) {
      this.doc.addPage();
      this.pageNo += 1;
      this.y = PAGE.margin;
      return true;
    }
    return false;
  }

  footer(extra = '') {
    const range = this.doc.bufferedPageRange();
    const count = range.count;
    for (let i = 0; i < count; i += 1) {
      this.doc.switchToPage(range.start + i);
      const savedBottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      this.doc.font('Amiri').fontSize(9).fillColor(COLORS.gray);
      const text = extra ? `صفحة ${i + 1} من ${count} — ${extra}` : `صفحة ${i + 1} من ${count}`;
      this.doc.text(text, PAGE.margin, PAGE.height - 36, { width: CONTENT_WIDTH, align: 'center' });
      this.doc.page.margins.bottom = savedBottom;
    }
    this.doc.switchToPage(range.start + count - 1);
  }

  heading(text, { size = 18, color = COLORS.cyan, gap = 14 } = {}) {
    this.ensure(40);
    this.doc.font('AmiriBold').fontSize(size).fillColor(color).text(text, PAGE.margin, this.y, { width: CONTENT_WIDTH, align: 'right' });
    this.y = this.doc.y + gap;
  }

  line(text, { size = 11, font = 'Amiri', color = COLORS.dark, gap = 16, align = 'right' } = {}) {
    this.ensure(22);
    this.doc.font(font).fontSize(size).fillColor(color).text(text, PAGE.margin, this.y, { width: CONTENT_WIDTH, align });
    this.y = this.doc.y + gap;
  }

  rule(gap = 10) {
    this.ensure(14);
    this.doc.moveTo(PAGE.margin, this.y).lineTo(PAGE.width - PAGE.margin, this.y).strokeColor(COLORS.gray).lineWidth(0.7).stroke();
    this.y += gap;
  }

  tableRow(cells, widths, { header = false, highlight = false, rowH = 20 } = {}) {
    this.ensure(rowH);
    const startY = this.y;
    this.doc.save();
    if (header) {
      this.doc.rect(PAGE.margin, startY, CONTENT_WIDTH, rowH).fill(COLORS.cyan);
    } else if (highlight) {
      this.doc.rect(PAGE.margin, startY, CONTENT_WIDTH, rowH).fill(COLORS.lightCyan);
    }
    this.doc.restore();
    let xRight = PAGE.width - PAGE.margin;
    cells.forEach((cell, i) => {
      const w = widths[i] * CONTENT_WIDTH;
      const text = String(cell ?? '');
      this.doc.font(header ? 'AmiriBold' : 'Amiri').fontSize(header ? 11 : 10.5).fillColor(header ? COLORS.white : highlight ? COLORS.cyan : COLORS.dark);
      this.doc.text(text, xRight - w, startY + 2, { width: w, align: 'right' });
      xRight -= w;
    });
    this.y = startY + rowH;
  }
}
