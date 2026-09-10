import fs from 'fs';

// تحقق من البنية السحرية (magic bytes) للملفات المرفوعة، لأن multer يقبل
// الملف بناءً على mimetype/الامتداد فقط — وكلاهما قابل للتزوير من العميل.
// يقرأ أول بايتات الملف على القرص ويطابقها مع الأنواع المسموح بها فعلياً.

const SIGNATURES = {
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  pdf: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  webp: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
  // docx/xlsx/zip عام (PK\x03\x04)
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
  // Word/Excel القدامى (OLE compound file)
  doc: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
};

export function detectFileType(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    if (bytesRead < 4) return null;
    for (const [type, test] of Object.entries(SIGNATURES)) {
      if (test(buf)) return type;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// يتحقق أن كل الملفات المرفوعة تطابق واحداً من الأنواع المسموحة.
// allowedTypes: مجموعة مثل ['jpeg','png','pdf','zip']. عند الفشل يحذف
// الملفات المكتوبة على القرص ويرجع قائمة الأخطاء.
export function validateUploadedFiles(files, allowedTypes) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  const errors = [];
  for (const f of list) {
    const type = detectFileType(f.path);
    if (!type || !allowedTypes.includes(type)) {
      errors.push(f.originalname || f.filename);
      try { fs.unlinkSync(f.path); } catch { /* ignore */ }
    }
  }
  return errors;
}
