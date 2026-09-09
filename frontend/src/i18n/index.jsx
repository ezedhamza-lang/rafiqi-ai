import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ar from './ar.json';
import en from './en.json';

const dictionaries = { ar, en };
const FALLBACK_LANG = 'ar';
const RTL_LANGS = ['ar'];
const STORAGE_KEY = 'rafiqi-lang';

const I18nContext = createContext(null);

function lookup(obj, path) {
  return path.split('.').reduce((acc, key) => (
    acc && acc[key] !== undefined ? acc[key] : undefined
  ), obj);
}

function interpolate(value, params) {
  if (!params) return value;
  return String(value).replace(/\{\{(\w+)\}\}/g, (match, key) => (
    params[key] !== undefined ? params[key] : match
  ));
}

function getInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && dictionaries[stored]) return stored;
  } catch {}
  return FALLBACK_LANG;
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', RTL_LANGS.includes(lang) ? 'rtl' : 'ltr');
    const titles = {
      ar: ar.app.name,
      en: en.app.name
    };
    document.title = titles[lang] || ar.app.name;
  }, [lang]);

  const t = useCallback((path, params) => {
    let value = lookup(dictionaries[lang], path);
    if (value === undefined) value = lookup(dictionaries[FALLBACK_LANG], path);
    if (value === undefined) {
      // لا نعرض أي مفتاح برمجي للمستخدم: نرجع آخر مقطع من المسار
      // (وهو غالباً القيمة الحقيقية مثل اسم المستوى)، وإلا سلسلة فارغة إن كان المقطع مفتاحاً.
      const segs = String(path).split('.');
      const last = segs[segs.length - 1] ?? '';
      const looksLikeKey = /^[a-z][a-zA-Z0-9]*$/.test(last) && /[a-z][A-Z]/.test(last);
      const fallback = looksLikeKey ? '' : last;
      return params ? interpolate(fallback, params) : fallback;
    }
    return interpolate(value, params);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
