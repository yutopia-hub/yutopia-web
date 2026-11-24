import { t } from '../i18n/i18n.js';
import { isAuthenticated, updateUser } from '../store/authStore.js';
import { getMyProfile, updateMyProfile } from '../api/memberApi.js';
import { navigate } from '../router/router.js';
import { escapeHtml } from '../utils/html.js';
import { on, setText, setFormBusy, isFormBusy } from '../utils/dom.js';
export async function MemberEditPage() {
  if (!isAuthenticated()) {
    navigate('/login');
    return '';
  }
  try {
    const user = await getMyProfile();
    return `<section class="auth-page card member-theme"><header class="member-heading"><p class="member-eyebrow">${t('윷토피아 · 계정 관리')}</p><h1>${t('내 정보 수정')}</h1></header>

      <p>${t('이메일: {email}', { email: escapeHtml(user.email) })}</p><form id="member-edit-form">
      <label>${t('닉네임')}<input name="nickname" autocomplete="nickname" maxlength="30" value="${escapeHtml(user.nickname)}" required /></label>
      <button class="btn btn-primary" type="submit">${t('저장')}</button></form>
      <p id="member-edit-error" class="error" role="alert"></p><a href="#/mypage">${t('취소')}</a></section>`;
  } catch (error) {
    return `<section class="card"><p class="error" role="alert">${escapeHtml(error.message)}</p><a href="#/mypage">${t('마이페이지로')}</a></section>`;
  }
}
on(document, 'submit', '#member-edit-form', async (event, form) => {
  event.preventDefault();
  if (isFormBusy(form)) return;
  setFormBusy(form, true);
  setText('#member-edit-error', '');
  try {
    updateUser(await updateMyProfile(Object.fromEntries(new FormData(form))));
    navigate('/mypage');
  } catch (error) {
    setText('#member-edit-error', error.message);
  } finally {
    setFormBusy(form, false);
  }
});
