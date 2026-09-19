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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch(() => {});
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
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

// Reveal Material Icons only when the icon font is ready (prevents icon-name
// flash as text on slow networks). Falls back to visible after 3s.
try {
  const markIconsReady = () => document.documentElement.classList.add('mi-ready');
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(markIconsReady).catch(markIconsReady);
    setTimeout(markIconsReady, 3000);
  } else {
    markIconsReady();
  }
} catch {}

// Remove the static loading splash as soon as React has mounted,
// without waiting for window 'load' (external fonts may hang it).
try {
  const fallback = document.getElementById('loading-fallback');
  if (fallback) fallback.remove();
} catch {}
