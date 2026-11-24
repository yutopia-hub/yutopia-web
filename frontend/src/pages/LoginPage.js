import { t } from '../i18n/i18n.js';
import { loginRequest } from '../api/authApi.js';
import { login, isAuthenticated } from '../store/authStore.js';
import { navigate } from '../router/router.js';
import { validateLogin, normalizeEmail } from '../utils/validators.js';
import {
  on,
  setText,
  setFormBusy,
  isFormBusy,
  showFormErrors,
  bindFormValidation,
} from '../utils/dom.js';
export async function LoginPage({ registered = '' } = {}) {
  if (isAuthenticated()) {
    navigate('/mypage');
    return '';
  }
  return `<section class="auth-page card member-theme"><header class="member-heading"><p class="member-eyebrow">${t('윷토피아')}</p><h1>${t('로그인')}</h1><p class="member-description">${t('로그인하고 나만의 여행을 이어가세요.')}</p></header>
    ${registered === 'true' ? `<p class="member-notice" role="status">${t('회원가입이 완료되었습니다. 이메일과 비밀번호로 로그인해 주세요.')}</p>` : ''}
    <form id="login-form" novalidate>
      <label>${t('이메일')}<input type="email" name="email" autocomplete="username" maxlength="254" required aria-describedby="login-email-error" /></label>
      <p id="login-email-error" class="error field-error" data-error-for="email" aria-live="polite"></p>
      <label>${t('비밀번호')}<input type="password" name="password" autocomplete="current-password" required aria-describedby="login-password-error" /></label>
      <p id="login-password-error" class="error field-error" data-error-for="password" aria-live="polite"></p>
      <button class="btn btn-primary member-submit" type="submit">${t('로그인')}</button>
    </form><p class="error" id="login-error" role="alert"></p>
    <div class="form-links member-form-links"><a href="#/forgot-password">${t('비밀번호 찾기')}</a><a href="#/signup">${t('처음 오셨나요? 회원가입')}</a></div></section>`;
}
on(document, 'submit', '#login-form', async (event, form) => {
  event.preventDefault();
  if (isFormBusy(form)) return;
  setText('#login-error', '');
  const values = Object.fromEntries(new FormData(form));
  if (!showFormErrors(form, validateLogin(values), { focus: true })) return;
  values.email = normalizeEmail(values.email);
  setFormBusy(form, true);
  try {
    const { user, token } = await loginRequest(values);
    login(user, token);
    navigate('/mypage');
  } catch (error) {
    setText('#login-error', error.message);
  } finally {
    setFormBusy(form, false);
  }
});

bindFormValidation('#login-form', validateLogin);
