import { request, HAS_BACKEND } from './http.js';
import {
  mockLogin,
  mockSignup,
  mockLogout,
  mockRequestReset,
  mockResetPassword,
} from './mock/mockMembers.js';
import {
  isValidEmail,
  isValidPassword,
  isRequired,
  validateLogin,
  validateSignup,
  normalizeEmail,
} from '../utils/validators.js';
// VITE_API_BASE_URL 이 있으면 Spring 백엔드(/api/auth/*), 없으면 브라우저 저장소 목업.
const USE_MOCK = !HAS_BACKEND;
export async function loginRequest({ email, password }) {
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  email = normalizeEmail(email);
  return USE_MOCK
    ? mockLogin({ email, password })
    : request('/api/auth/login', { method: 'POST', body: { email, password } });
}
export async function signupRequest({ email, password, nickname }) {
  const errors = validateSignup({ email, password, nickname, passwordConfirm: password });
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  email = normalizeEmail(email);
  nickname = nickname.trim();
  return USE_MOCK
    ? mockSignup({ email, password, nickname })
    : request('/api/auth/signup', { method: 'POST', body: { email, password, nickname } });
}
export async function logoutRequest() {
  if (USE_MOCK) return mockLogout();
  // 토큰이 이미 만료됐어도 로컬 로그아웃은 진행돼야 하므로 서버 오류는 무시한다.
  return request('/api/auth/logout', { method: 'POST', auth: true }).catch(() => null);
}
export async function requestPasswordReset({ email }) {
  if (!isValidEmail(email)) throw new Error('올바른 이메일을 입력해 주세요.');
  return USE_MOCK
    ? mockRequestReset({ email })
    : request('/api/auth/password-reset', { method: 'POST', body: { email } });
}
export async function resetPassword({ token, password }) {
  if (!isRequired(token) || !isValidPassword(password))
    throw new Error('비밀번호는 공백 없이 영문과 숫자를 포함한 8~64자여야 합니다.');
  return USE_MOCK
    ? mockResetPassword({ token, password })
    : request('/api/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
}
