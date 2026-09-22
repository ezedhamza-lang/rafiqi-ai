(function () {
  try {
    // Theme initialization
    var stored = localStorage.getItem('rafiqi-theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);

    // Language/Direction initialization to prevent FOUC
    var langStorage = localStorage.getItem('rafiqi-lang');
    var validLangs = ['ar', 'en'];
    var lang = validLangs.indexOf(langStorage) >= 0 ? langStorage : 'ar';
    var dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.className = document.documentElement.className.replace(/\b(dir-\w+)\b/g, '') + ' dir-' + dir;
  } catch (e) {
    // Silently fail - defaults in HTML will be used
  }
})();

function hideFallback() {
  try {
    var fallback = document.getElementById('loading-fallback');
    if (fallback) {
      fallback.style.opacity = '0';
      fallback.style.transition = 'opacity 0.3s ease';
      setTimeout(function () {
        var el = document.getElementById('loading-fallback');
        if (el) el.remove();
      }, 300);
    }
  } catch (e) {}
}

window.addEventListener('load', function () {
  setTimeout(hideFallback, 100);
});

setTimeout(function () {
  try {
    var root = document.getElementById('root');
    if (!root || !root.hasChildNodes()) {
      var fallback = document.getElementById('loading-fallback');
      if (fallback) {
        fallback.innerHTML = '<div style="text-align:center;padding:2rem;font-family:Tajawal,sans-serif;color:#0369a1;">'
          + '<p>تعذر تحميل التطبيق. يرجى تحديث الصفحة (Ctrl+F5).</p>'
          + '<p>Impossible de charger. Veuillez actualiser (Ctrl+F5).</p></div>';
      }
    } else {
      hideFallback();
    }
  } catch (e) {}
}, 15000);
