// 라이트/다크 테마. 선택값이 없으면 OS 설정을 따른다(variables.css 의 prefers-color-scheme).
// 첫 페인트 깜빡임을 막는 초기 적용은 index.html 인라인 스크립트가 한다.
const STORAGE_KEY = 'travel-notice:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'dark' || forced === 'light') return forced;
  return media.matches ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* 저장 실패는 무시 */
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
