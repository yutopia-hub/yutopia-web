import { authStore, logout } from '../store/authStore.js';
import { logoutRequest } from '../api/authApi.js';
import {
  on,
  render,
  setText,
  setFormBusy,
  qs,
  syncNavIndicator,
  observeSize,
} from '../utils/dom.js';
import { escapeHtml } from '../utils/html.js';
import { navigate } from '../router/router.js';
import '../styles/header.css';
import logo from '../assets/images/logo.png';
import { t, getLang, setLang } from '../i18n/i18n.js';
import { getTheme, toggleTheme } from '../utils/theme.js';
const navIcons = {
  yut: '<rect x="5" y="3" width="5" height="18" rx="2.5" transform="rotate(-18 7.5 12)"/><rect x="14" y="3" width="5" height="18" rx="2.5" transform="rotate(18 16.5 12)"/><path d="M6 9h3m6 6h3"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/>',
  luggage:
    '<rect x="5" y="6" width="14" height="14" rx="3"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M9 10v6m6-6v6M8 20v1m8-1v1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};
const navIcon = (name) =>
  `<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">${navIcons[name]}</svg></span>`;
let initialized = false;
export function renderHeader() {
  paint();
  if (initialized) return;
  initialized = true;
  authStore.subscribe(paint);
  on(window, 'hashchange', () => {
    paintAuth();
    updateSelection();
  });
  on(window, 'resize', updateSelection);
  // 언어가 바뀌면 탭 문구까지 새로 그린다
  on(window, 'langchange', () => paint(true));
  on(window, 'themechange', paintPrefs);
  on('#app-header', 'click', '#theme-toggle', () => toggleTheme());
  on('#app-header', 'click', '#lang-toggle', () => setLang(getLang() === 'ko' ? 'en' : 'ko'));
  observeSize('.nav-links', updateSelection);
  on('#app-header', 'click', '#logout-btn', async (event, button) => {
    event.preventDefault();
    if (button.disabled) return;
    setFormBusy(button.closest('nav'), true);
    try {
      await logoutRequest();
      logout();
      navigate('/');
    } catch (error) {
      setText('#header-error', error.message);
    } finally {
      setFormBusy(button.closest('nav'), false);
    }
  });
}
function paint(force = false) {
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  if (!force && qs('#app-header .nav-links')) {
    paintAuth();
    updateSelection();
    return;
  }

  const tabs = [
    { label: 'YUTOPIA', path: '/board', brand: true },
    { label: '윷 던지기', path: '/board', icon: 'yut' },
    { label: '여행지 찾기', path: '/map', icon: 'map' },
    { label: '나의 여행', path: '/mypage', icon: 'luggage' },
  ];

  const links = tabs
    .map((tab) => {
      const active =
        tab.path === '/' ? path === '/' : path === tab.path || path.startsWith(`${tab.path}/`);

      const content = tab.brand
        ? `<img src="${logo}" alt="윷토피아" class="nav-logo">`
        : `${navIcon(tab.icon)}<span>${t(tab.label)}</span>`;

      return `
        <a
          href="#${tab.path}"
          class="nav-tab${tab.brand ? ' nav-brand' : ''}${active ? ' is-active' : ''}"
          ${active ? ' aria-current="page"' : ''}
        >
          ${content}
        </a>
      `;
    })
    .join('');

  render(
    '#app-header',
    `
      <nav class="nav" aria-label="${t('주 메뉴')}">
        <div class="nav-links">
          ${links}
          <span class="nav-indicator" aria-hidden="true"></span>
        </div>

        <div class="nav-side">
          <div class="nav-auth"></div>
          <div class="nav-prefs">
            <button type="button" class="nav-pref" id="lang-toggle"></button>
            <button type="button" class="nav-pref" id="theme-toggle"></button>
          </div>
        </div>
      </nav>

      <p id="header-error" class="error" role="alert"></p>
    `,
  );
  paintAuth();
  paintPrefs();
  updateSelection();
}
const sunIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const moonIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
function paintPrefs() {
  const themeBtn = qs('#theme-toggle');
  const langBtn = qs('#lang-toggle');
  if (!themeBtn || !langBtn) return;
  const dark = getTheme() === 'dark';
  themeBtn.innerHTML = dark ? sunIcon : moonIcon;
  themeBtn.setAttribute('aria-label', t(dark ? '라이트 모드로 전환' : '다크 모드로 전환'));
  themeBtn.title = themeBtn.getAttribute('aria-label');
  const ko = getLang() === 'ko';
  langBtn.textContent = ko ? 'EN' : '한';
  langBtn.setAttribute('aria-label', ko ? 'Switch to English' : '한국어로 전환');
  langBtn.title = langBtn.getAttribute('aria-label');
}
function updateSelection() {
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  syncNavIndicator('#app-header .nav-links', path);
}
function paintAuth() {
  const { user, token } = authStore.getState();
  const path = window.location.hash.slice(1).split('?')[0] || '/';
  const isMyPage = path === '/mypage' || path.startsWith('/mypage/');
  render(
    '#app-header .nav-auth',
    user && token
      ? `<span class="nav-user">${navIcon('user')}<span class="nav-user-name" title="${escapeHtml(t('{name}님', { name: user.nickname }))}">${escapeHtml(t('{name}님', { name: user.nickname }))}</span></span><button type="button" class="btn" id="logout-btn">${t('로그아웃')}</button>`
      : isMyPage
        ? ''
        : `<a href="#/login">${t('로그인')}</a><a href="#/signup">${t('회원가입')}</a>`,
  );
}
