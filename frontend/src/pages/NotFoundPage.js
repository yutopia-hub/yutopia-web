import { t } from '../i18n/i18n.js';
export async function NotFoundPage() {
  return `
    <section class="card">
      <h2>404</h2>
      <p>${t('페이지를 찾을 수 없습니다.')}</p>
      <a href="#/" class="btn btn-primary">${t('홈으로')}</a>
    </section>
  `;
}
