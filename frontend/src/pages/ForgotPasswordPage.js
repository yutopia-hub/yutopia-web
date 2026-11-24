import { t } from '../i18n/i18n.js';
import { requestPasswordReset, resetPassword } from '../api/authApi.js';
import { logout } from '../store/authStore.js';
import { escapeHtml } from '../utils/html.js';
import { on, render, setText, setFormBusy, isFormBusy } from '../utils/dom.js';
export async function ForgotPasswordPage({ token = '' } = {}) {
  return `<section class="auth-page card"><h1>${token ? t('새 비밀번호 설정') : t('비밀번호 찾기')}</h1>
    ${
      token
        ? `<form id="reset-password-form">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <label>${t('새 비밀번호')}<input type="password" name="password" minlength="8" maxlength="64" autocomplete="new-password" required /></label>
      <p class="hint">${t('공백 없이 영문과 숫자를 포함한 8~64자')}</p>
      <label>${t('새 비밀번호 확인')}<input type="password" name="passwordConfirm" autocomplete="new-password" required /></label>
      <button class="btn btn-primary" type="submit">${t('비밀번호 변경')}</button></form>`
        : `<p>${t('가입한 이메일로 비밀번호 재설정 링크를 요청하세요.')}</p>
      <form id="forgot-password-form"><label>${t('이메일')}<input type="email" name="email" autocomplete="email" required /></label>
      <button class="btn btn-primary" type="submit">${t('재설정 링크 요청')}</button></form>`
    }
    <p id="reset-error" class="error" role="alert"></p><div id="reset-result" role="status"></div>
    <a href="#/login">${t('로그인으로')}</a></section>`;
}
on(document, 'submit', '#forgot-password-form, #reset-password-form', async (event, form) => {
  event.preventDefault();
  if (isFormBusy(form)) return;
  setFormBusy(form, true);
  setText('#reset-error', '');
  render('#reset-result', '');
  try {
    const values = Object.fromEntries(new FormData(form));
    if (form.id === 'forgot-password-form') {
      const result = await requestPasswordReset(values);
      render(
        '#reset-result',
        `<p>가입된 이메일이면 재설정 안내가 제공됩니다.</p>${result.resetToken ? `<p>개발용 목업에서는 이메일 대신 아래 링크를 사용하세요. 유효시간은 15분입니다.</p><a href="#/forgot-password?token=${encodeURIComponent(result.resetToken)}">새 비밀번호 설정하기</a>` : ''}`,
      );
    } else {
      if (values.password !== values.passwordConfirm)
        throw new Error('비밀번호 확인이 일치하지 않습니다.');
      await resetPassword(values);
      logout();
      render(form, '<p>비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.</p>');
    }
  } catch (error) {
    setText('#reset-error', error.message);
  } finally {
    setFormBusy(form, false);
  }
});
