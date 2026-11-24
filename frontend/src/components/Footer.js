import { t } from '../i18n/i18n.js';

export function renderFooter() {
  if (!renderFooter.bound) {
    renderFooter.bound = true;
    window.addEventListener('langchange', renderFooter);
  }
  const footer = document.getElementById('app-footer');
  footer.innerHTML = `
    <div class="footer-inner">
      <p>${t('© 2026 윷토피아 YUTOPIA · SSAFY 팀 프로젝트')}</p>
    </div>
  `;
}
