export function isRequired(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) return false;
  const [local, domain] = email.split('@');
  return (
    local.length <= 64 &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !local.includes('..') &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) &&
    domain.includes('.') &&
    domain
      .split('.')
      .every(
        (part) =>
          part.length > 0 &&
          part.length <= 63 &&
          /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(part),
      )
  );
}

export function isValidNickname(value) {
  return typeof value === 'string' && /^[가-힣A-Za-z0-9_-]{2,30}$/.test(value.trim());
}

export function isValidPassword(value) {
  return typeof value === 'string' && /^(?=.*[A-Za-z])(?=.*\d)[^\s]{8,64}$/.test(value);
}

export function validateLogin({ email = '', password = '' } = {}) {
  const errors = {};
  if (!isRequired(email)) errors.email = '이메일을 입력해 주세요.';
  else if (!isValidEmail(email)) errors.email = '올바른 이메일 형식을 입력해 주세요.';
  if (!isRequired(password)) errors.password = '비밀번호를 입력해 주세요.';
  return errors;
}

export function validateSignup({
  nickname = '',
  email = '',
  password = '',
  passwordConfirm = '',
} = {}) {
  const errors = validateLogin({ email, password });
  if (!isRequired(nickname)) errors.nickname = '닉네임을 입력해 주세요.';
  else if (!isValidNickname(nickname))
    errors.nickname = '닉네임은 한글·영문·숫자·_·-로 2~30자 입력해 주세요.';
  if (isRequired(password) && !isValidPassword(password))
    errors.password = '비밀번호는 공백 없이 영문과 숫자를 포함한 8~64자여야 합니다.';
  if (!isRequired(passwordConfirm)) errors.passwordConfirm = '비밀번호 확인을 입력해 주세요.';
  else if (password !== passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
  return errors;
}
