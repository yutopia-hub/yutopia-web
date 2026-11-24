import { en } from './en.js';

// 한국어/영문 전환. 한국어 문구 자체를 키로 쓰고, 영문은 en.js 에서 찾는다(없으면 한국어 그대로).
// 언어를 바꾸면 hashchange 를 다시 보내 현재 페이지를 새로 그린다(라우터 수정 없이).
const STORAGE_KEY = 'travel-notice:lang';
const dictionaries = { ko: {}, en };

function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dictionaries[saved]) return saved;
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  return 'ko';
}

let lang = readLang();
document.documentElement.lang = lang;

export const getLang = () => lang;

/** 한국어 문구를 현재 언어로 바꾼다. {name} 자리표시자는 params 로 채운다. */
export function t(key, params) {
  const text = dictionaries[lang][key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

/** root 안의 [data-i18n] 텍스트와 [data-i18n-placeholder]/[data-i18n-aria-label] 속성을 번역한다. */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.dataset.i18n ||= el.textContent.trim();
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.dataset.i18nPlaceholder ||= el.getAttribute('placeholder') ?? '';
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.dataset.i18nAriaLabel ||= el.getAttribute('aria-label') ?? '';
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

export function setLang(next) {
  if (!dictionaries[next] || next === lang) return;
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* 무시 */
  }
  window.dispatchEvent(new CustomEvent('langchange', { detail: next }));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
