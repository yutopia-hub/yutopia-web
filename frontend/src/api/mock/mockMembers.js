import { getItem, setItem } from '../../utils/storage.js';

// 브라우저 개발용 목업. 실제 인증과 이메일 전송은 서버가 담당한다.
const users = () => getItem('mock-members', []);
const save = (members) => setItem('mock-members', members);
const publicUser = ({ id, email, nickname }) => ({ id, email, nickname });
const normalizeEmail = (email) => String(email).trim().toLowerCase();

const PASSWORD_ALGORITHM = 'PBKDF2-SHA256';
const PASSWORD_ITERATIONS = 600_000;

const toHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');

async function hash(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return toHex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
      key,
      256,
    ),
  );
}

async function legacyHash(password, salt) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${password}`),
  );
  return toHex(digest);
}

async function passwordFields(password) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return {
    salt,
    passwordHash: await hash(password, salt),
    passwordAlgorithm: PASSWORD_ALGORITHM,
    passwordIterations: PASSWORD_ITERATIONS,
  };
}

async function verifyPassword(member, password) {
  if (member.passwordAlgorithm === undefined) {
    return member.passwordHash === (await legacyHash(password, member.salt));
  }
  if (
    member.passwordAlgorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(member.passwordIterations) ||
    member.passwordIterations < PASSWORD_ITERATIONS ||
    member.passwordIterations > 2_000_000
  )
    return false;
  return member.passwordHash === (await hash(password, member.salt, member.passwordIterations));
}
function session(member) {
  const token = crypto.randomUUID();
  const sessions = getItem('mock-sessions', {});
  sessions[token] = member.id;
  setItem('mock-sessions', sessions);
  return { user: publicUser(member), token };
}
function currentMember() {
  const id = getItem('mock-sessions', {})[getItem('token')];
  const member = users().find((item) => item.id === id);
  if (!member) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  return member;
}
export async function mockSignup({ email, password, nickname }) {
  email = normalizeEmail(email);
  const credentials = await passwordFields(password);
  const members = users();
  if (members.some((member) => member.email === email))
    throw new Error('이미 가입된 이메일입니다.');
  const member = { id: crypto.randomUUID(), email, nickname: nickname.trim(), ...credentials };
  save([...members, member]);
  return session(member);
}
export async function mockLogin({ email, password }) {
  const member = users().find((item) => item.email === normalizeEmail(email));
  if (!member || !(await verifyPassword(member, password)))
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  // 기존 SHA-256 계정은 비밀번호 확인에 성공한 뒤에만 전환한다.
  if (member.passwordAlgorithm === undefined) {
    Object.assign(member, await passwordFields(password));
    save(users().map((item) => (item.id === member.id ? member : item)));
  }
  return session(member);
}
export function mockLogout() {
  const sessions = getItem('mock-sessions', {});
  delete sessions[getItem('token')];
  setItem('mock-sessions', sessions);
}
export function mockGetMember() {
  return publicUser(currentMember());
}
export function mockUpdateMember({ nickname }) {
  const member = currentMember();
  member.nickname = nickname.trim();
  save(users().map((item) => (item.id === member.id ? member : item)));
  return publicUser(member);
}
function revokeSessions(id) {
  const sessions = getItem('mock-sessions', {});
  Object.keys(sessions).forEach((token) => {
    if (sessions[token] === id) delete sessions[token];
  });
  setItem('mock-sessions', sessions);
}
export async function mockDeleteMember({ password }) {
  const member = currentMember();
  if (!(await verifyPassword(member, password))) throw new Error('비밀번호가 올바르지 않습니다.');
  save(users().filter((item) => item.id !== member.id));
  revokeSessions(member.id);
}
export function mockRequestReset({ email }) {
  const member = users().find((item) => item.email === normalizeEmail(email));
  if (!member) return {};
  const token = crypto.randomUUID();
  const resets = getItem('mock-resets', {});
  Object.keys(resets).forEach((key) => {
    if (resets[key].id === member.id) delete resets[key];
  });
  resets[token] = { id: member.id, expires: Date.now() + 15 * 60 * 1000 };
  setItem('mock-resets', resets);
  return { resetToken: token };
}
export async function mockResetPassword({ token, password }) {
  const resets = getItem('mock-resets', {});
  const reset = resets[token];
  const member = users().find((item) => item.id === reset?.id);
  if (!member || reset.expires < Date.now())
    throw new Error('재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.');
  Object.assign(member, await passwordFields(password));
  save(users().map((item) => (item.id === member.id ? member : item)));
  delete resets[token];
  setItem('mock-resets', resets);
  revokeSessions(member.id);
}
