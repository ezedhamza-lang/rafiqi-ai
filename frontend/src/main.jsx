import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { LocaleProvider } from './context/LocaleContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';

// Core styles
import './styles/tokens.css';
import './index.css';
import './styles/components.css';
import './styles/overrides.css';

// Batch 6: RTL/LTR support styles
import './styles/rtl.css';
import './styles/logical-properties.css';
import './styles/language-switcher.css';

// ترقية PWA (28-08-2026): كان Service Worker معطّلاً عمداً بعد حادثة سابقة
// (نسخة قديمة كانت تحجز ملفات الواجهة وتمنع وصول التحديثات للمستخدمين).
// السبب الجذري الأرجح: SW يُنصّب نسخة جديدة (skipWaiting) لكن المستخدم
// يبقى في التبويب القديم بلا معرفة أن هناك تحديثاً، فتتضارب الشيفرة
// القديمة المحمَّلة في الذاكرة مع الملفات الجديدة على الخادم.
//
// الحل هنا مقصود بعناية: نُعيد التسجيل، لكن بلا أي reload تلقائي إجباري —
// المنصة فيها امتحانات وتمارين، وreload فجائي ممكن يخسّر تقدم تلميذ في
// نص امتحان. بدل ذلك: بانر صغير غير مزعج "تحديث جديد متوفر" يترك القرار
// للمستخدم. صفحة /fix.html تبقى موجودة كخط دفاع أخير يدوي.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // "installed" + وجود controller حالي يعني: هذا تحديث لنسخة
          // موجودة (مش أول تثبيت) — الآن نعرض البانر.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(installing);
          }
        });
      });
    }).catch(() => {
      // فشل التسجيل لا يجب أن يكسر تحميل التطبيق — تجاهل بصمت
    });
  });
}

function showUpdateBanner(waitingWorker) {
  if (document.getElementById('rafiqi-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'rafiqi-update-banner';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:fixed;bottom:16px;inset-inline:16px;z-index:99999;background:#0f172a;color:#fff;padding:12px 16px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:Tajawal,sans-serif;direction:rtl;';
  banner.innerHTML = '<span style="font-size:14px;">يتوفر تحديث جديد للمنصة</span>';
  const btn = document.createElement('button');
  btn.textContent = 'تحديث الآن';
  btn.style.cssText = 'background:#0ea5e9;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;';
  btn.onclick = () => {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  };
  banner.appendChild(btn);
  document.body.appendChild(banner);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <LocaleProvider>
          <ThemeProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ThemeProvider>
        </LocaleProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
