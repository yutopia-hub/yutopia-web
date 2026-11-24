import { t } from '../i18n/i18n.js';
import { signupRequest } from '../api/authApi.js';
import { isAuthenticated } from '../store/authStore.js';
import { navigate } from '../router/router.js';
import { validateSignup, normalizeEmail } from '../utils/validators.js';
import {
  on,
  setText,
  setFormBusy,
  isFormBusy,
  showFormErrors,
  bindFormValidation,
} from '../utils/dom.js';
export async function SignupPage() {
  if (isAuthenticated()) {
    navigate('/mypage');
    return '';
  }
  return `<section class="auth-page card member-theme"><header class="member-heading"><p class="member-eyebrow">${t('윷토피아')}</p><h1>${t('회원가입')}</h1><p class="member-description">${t('회원가입하고 나만의 여행 기록을 시작하세요.')}</p></header>
    <form id="signup-form" novalidate>
      <label>${t('닉네임')}<input name="nickname" autocomplete="nickname" minlength="2" maxlength="30" required aria-describedby="nickname-help signup-nickname-error" /></label>
      <p id="nickname-help" class="hint">${t('한글·영문·숫자·_·-로 2~30자')}</p>
      <p id="signup-nickname-error" class="error field-error" data-error-for="nickname" aria-live="polite"></p>
      <label>${t('이메일')}<input type="email" name="email" autocomplete="username" maxlength="254" required aria-describedby="signup-email-error" /></label>
      <p id="signup-email-error" class="error field-error" data-error-for="email" aria-live="polite"></p>
      <label>${t('비밀번호')}<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="64" required aria-describedby="password-help signup-password-error" /></label>
      <p id="password-help" class="hint">${t('공백 없이 영문과 숫자를 포함한 8~64자')}</p>
      <p id="signup-password-error" class="error field-error" data-error-for="password" aria-live="polite"></p>
      <label>${t('비밀번호 확인')}<input type="password" name="passwordConfirm" autocomplete="new-password" maxlength="64" required aria-describedby="signup-confirm-error" /></label>
      <p id="signup-confirm-error" class="error field-error" data-error-for="passwordConfirm" aria-live="polite"></p>
      <button type="submit" class="btn btn-primary member-submit">${t('회원가입')}</button>
    </form><p class="error" id="signup-error" role="alert"></p><a class="member-back-link" href="#/login">${t('이미 계정이 있나요? 로그인')}</a></section>`;
}
on(document, 'submit', '#signup-form', async (event, form) => {
  event.preventDefault();
  if (isFormBusy(form)) return;
  setText('#signup-error', '');
  const values = Object.fromEntries(new FormData(form));
  if (!showFormErrors(form, validateSignup(values), { focus: true })) return;
  values.email = normalizeEmail(values.email);
  values.nickname = values.nickname.trim();
  setFormBusy(form, true);
  try {
    await signupRequest(values);
    navigate('/login?registered=true');
  } catch (error) {
    setText('#signup-error', error.message);
  } finally {
    setFormBusy(form, false);
  }
});

bindFormValidation('#signup-form', validateSignup);
