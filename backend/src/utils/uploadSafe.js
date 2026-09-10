import crypto from 'crypto';
import { ApiError } from '../middleware/errorHandler.js';

// تقوية الرفع: multer وحده يثق بـmimetype/originalname وكلاهما يزوّره العميل.
// نفحص الامتدادَ الأخير الفعلي للاسم (وليس «يحتوي على pdf») ونستبدل الاسم
// دائماً باسم عشوائي ثابت الامتداد — فلا يصل القرصَ اسمٌ متحكم به العميل.

export function finalExt(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : '';
}

export function strictExtFilter(allowedExts) {
  const set = new Set(allowedExts.map((e) => String(e).toLowerCase().replace(/^\./, '')));
  return (_req, file, cb) => {
    const ext = finalExt(file.originalname);
    if (!ext || !set.has(ext)) {
      return cb(new ApiError(400, 'نوع الملف غير مسموح — يُقبل فقط: ' + [...set].join(', ')));
    }
    cb(null, true);
  };
}

export function safeFilename(prefix) {
  return (_req, file, cb) => {
    const ext = finalExt(file.originalname) || 'bin';
    cb(null, `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`);
  };
}
