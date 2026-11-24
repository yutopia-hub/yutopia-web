import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  mockSignup,
  mockLogin,
  mockLogout,
  mockGetMember,
  mockUpdateMember,
  mockDeleteMember,
  mockRequestReset,
  mockResetPassword,
} from '../src/api/mock/mockMembers.js';
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: (key) => data.delete(key),
};
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const authenticate = ({ token }) =>
  localStorage.setItem('travel-notice:token', JSON.stringify(token));
test('member lifecycle', async () => {
  const account = { email: 'Member@Example.com', nickname: '<회원>', password: 'password123' };
  const signup = await mockSignup(account);
  assert.equal(signup.user.email, 'member@example.com');
  assert.equal('passwordHash' in signup.user, false);
  assert.equal(localStorage.getItem('travel-notice:mock-members').includes('password123'), false);
  await assert.rejects(mockSignup(account), /이미 가입/);
  await assert.rejects(mockLogin({ ...account, password: 'wrong' }), /올바르지|유효하지/);
  authenticate(signup);
  assert.equal(mockGetMember().nickname, '<회원>');
  assert.equal(mockUpdateMember({ nickname: ' 새이름 ' }).nickname, '새이름');
  mockLogout();
  assert.throws(mockGetMember, /로그인/);
  authenticate(await mockLogin(account));
  const first = mockRequestReset(account);
  const second = mockRequestReset(account);
  await assert.rejects(
    mockResetPassword({ token: first.resetToken, password: 'newpass123' }),
    /올바르지|유효하지/,
  );
  await mockResetPassword({ token: second.resetToken, password: 'newpass123' });
  await assert.rejects(
    mockResetPassword({ token: second.resetToken, password: 'newpass123' }),
    /올바르지|유효하지/,
  );
  assert.throws(mockGetMember, /로그인/);
  await assert.rejects(mockLogin(account), /올바르지|유효하지/);
  authenticate(await mockLogin({ ...account, password: 'newpass123' }));
  await assert.rejects(mockDeleteMember({ password: 'wrong' }), /올바르지|유효하지/);
  await mockDeleteMember({ password: 'newpass123' });
  assert.throws(mockGetMember, /로그인/);
  await assert.rejects(mockLogin({ ...account, password: 'newpass123' }), /올바르지|유효하지/);
  assert.deepEqual(mockRequestReset(account), {});
});
test('reset expiry', async () => {
  const account = { email: 'expired@example.com', nickname: '만료', password: 'password123' };
  await mockSignup(account);
  const { resetToken } = mockRequestReset(account);
  const resets = JSON.parse(localStorage.getItem('travel-notice:mock-resets'));
  resets[resetToken].expires = Date.now() - 1;
  localStorage.setItem('travel-notice:mock-resets', JSON.stringify(resets));
  await assert.rejects(mockResetPassword({ token: resetToken, password: 'newpass123' }), /만료/);
});

test('PBKDF2 uses unique salts and verifies independently', async () => {
  const password = 'sharedpass123';
  for (const email of ['salt-a@example.com', 'salt-b@example.com']) {
    await mockSignup({ email, nickname: '여행', password });
  }
  const members = JSON.parse(localStorage.getItem('travel-notice:mock-members'));
  const [a, b] = members.filter((member) => member.email.startsWith('salt-'));
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.passwordHash, b.passwordHash);
  assert.equal(a.passwordAlgorithm, 'PBKDF2-SHA256');
  assert.equal(a.passwordIterations, 600_000);
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await webcrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(a.salt),
      iterations: 600_000,
    },
    key,
    256,
  );
  assert.equal(a.passwordHash, Buffer.from(bits).toString('hex'));
});

test('legacy account migrates only after successful login', async () => {
  const member = {
    id: 'legacy-id',
    email: 'legacy@example.com',
    nickname: '기존',
    salt: 'old-salt',
  };
  const password = 'legacy123';
  member.passwordHash = Buffer.from(
    await webcrypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${member.salt}:${password}`),
    ),
  ).toString('hex');
  const members = JSON.parse(localStorage.getItem('travel-notice:mock-members'));
  localStorage.setItem('travel-notice:mock-members', JSON.stringify([...members, member]));
  const stored = () =>
    JSON.parse(localStorage.getItem('travel-notice:mock-members')).find(
      (item) => item.id === member.id,
    );
  await assert.rejects(mockLogin({ email: member.email, password: 'wrong' }), /올바르지/);
  assert.deepEqual(stored(), member);
  const result = await mockLogin({ email: member.email, password });
  assert.equal(result.user.id, member.id);
  assert.equal(stored().passwordAlgorithm, 'PBKDF2-SHA256');
  assert.notEqual(stored().salt, member.salt);
  assert.notEqual(stored().passwordHash, member.passwordHash);
  authenticate(await mockLogin({ email: member.email, password }));
  const { resetToken } = mockRequestReset({ email: member.email });
  await mockResetPassword({ token: resetToken, password: 'updated123' });
  await assert.rejects(mockLogin({ email: member.email, password }), /올바르지/);
  authenticate(await mockLogin({ email: member.email, password: 'updated123' }));
  await mockDeleteMember({ password: 'updated123' });
});
