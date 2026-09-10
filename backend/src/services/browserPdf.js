import fs from 'fs';

// ===== خدمة PDF بمحرك متصفح (chromium/microsoft-edge/chrome) =====
// pdfkit لا يدعم العربية (لا إعادة ترتيب Bidi ولا توصيل الحروف)، لذا تُرسم وثائق
// المنصة الرسمية من HTML (dir=rtl) عبر متصفح headless. عند غياب المحرك أو تعذّر
// التشغيل تُرجع الدالة null ليلتصق المستدعي بالمسار القديم (fallback) بلا كسر.

const IS_WIN = process.platform === 'win32';
const IS_TEST = process.env.NODE_ENV === 'test';

const CANDIDATES = IS_WIN
  ? [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ]
  : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];

function findExecutable() {
  if (process.env.PDF_CHROMIUM_PATH && fs.existsSync(process.env.PDF_CHROMIUM_PATH)) {
    return process.env.PDF_CHROMIUM_PATH;
  }
  return CANDIDATES.find((c) => fs.existsSync(c)) || null;
}

let puppeteerMod = null;
async function loadPuppeteer() {
  if (puppeteerMod !== null) return puppeteerMod;
  try {
    puppeteerMod = await import('puppeteer-core');
  } catch {
    puppeteerMod = false;
  }
  return puppeteerMod;
}

let browser = null;
let launching = null;
let warnedOnce = false;

// طابور تسلسل: مستند واحد في الذاكرة في آنٍ واحد (ودّ مع Render المجاني 512MB)
let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(() => {}, () => {});
  return run;
}

async function getBrowser(exe) {
  if (browser && browser.connected) return browser;
  if (launching) return launching;
  const ppt = await loadPuppeteer();
  if (!ppt) return null;
  launching = ppt
    .default.launch({
      executablePath: exe,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--font-render-hinting=none'
      ]
    })
    .then((b) => {
      browser = b;
      launching = null;
      b.on('disconnected', () => {
        if (browser === b) browser = null;
      });
      return b;
    })
    .catch((e) => {
      launching = null;
      throw e;
    });
  return launching;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('pdf-timeout')), ms))
  ]);
}

/**
 * يرسم HTML إلى PDF. يرجّع Buffer أو null عند أي تعذر (المحرك غير متوفر/فشل).
 */
export async function renderPdfFromHtml(html, { timeoutMs = 25000 } = {}) {
  // في الاختبارات: مغلق افتراضيًا (هرميونتيك+سريع) إلا لو فُعّل صراحةً
  const mode = process.env.PDF_ENGINE || 'auto';
  if (mode === 'off' || (IS_TEST && mode === 'auto' && !process.env.PDF_BROWSER_TESTS)) return null;

  const exe = findExecutable();
  if (!exe) {
    if (!warnedOnce) {
      console.warn('[pdf] no chromium/edge found — falling back to legacy pdfkit');
      warnedOnce = true;
    }
    return null;
  }

  return enqueue(async () => {
    try {
      const b = await getBrowser(exe);
      if (!b) return null;
      return await withTimeout(
        (async () => {
          const page = await b.newPage();
          try {
            await page.setContent(html, { waitUntil: 'load' });
            const buf = await page.pdf({
              format: 'A4',
              printBackground: true,
              margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
              preferCSSPageSize: true
            });
            return Buffer.from(buf);
          } finally {
            await page.close().catch(() => {});
          }
        })(),
        timeoutMs
      );
    } catch (e) {
      if (!warnedOnce) {
        console.warn('[pdf] browser render failed — falling back to legacy pdfkit:', e.message);
        warnedOnce = true;
      }
      // كسر المتصفح المعطوب حتى يُعاد إطلاقه في الطلب التالي
      try {
        if (browser && !browser.connected) browser = null;
      } catch { /* ignore */ }
      return null;
    }
  });
}

export function browserPdfStatus() {
  const mode = process.env.PDF_ENGINE || 'auto';
  return { mode, executable: findExecutable(), testEnv: IS_TEST };
}
