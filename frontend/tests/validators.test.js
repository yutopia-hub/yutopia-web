import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail,
  isValidPassword,
  isValidNickname,
  normalizeEmail,
  validateLogin,
  validateSignup,
} from '../src/utils/validators.js';

test('email normalization and malformed address rejection', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  for (const email of ['user@example.com', 'user+trip@example.co.kr', ' user@example.com '])
    assert.equal(isValidEmail(email), true);
  for (const email of [
    '',
    'user',
    'user@localhost',
    'user@@example.com',
    '.user@example.com',
    'user..name@example.com',
    'user@example..com',
    'user@-example.com',
    'user@exam_ple.com',
    'u ser@example.com',
    'a'.repeat(65) + '@example.com',
    null,
  ])
    assert.equal(isValidEmail(email), false);
});

test('signup password boundaries and whitespace', () => {
  assert.equal(isValidPassword('abcd1234'), true);
  assert.equal(isValidPassword('a1' + 'x'.repeat(62)), true);
  for (const password of [
    'abc1234',
    'abcdefgh',
    '12345678',
    'abcd 1234',
    'abcd1234\n',
    'a1' + 'x'.repeat(63),
    null,
  ])
    assert.equal(isValidPassword(password), false);
});

test('nickname constraints', () => {
  for (const nickname of ['여행자', 'Trip_123', ' 여행자 ', 'a'.repeat(30)])
    assert.equal(isValidNickname(nickname), true);
  for (const nickname of ['', ' ', 'a', 'a'.repeat(31), '<회원>', '여행 자', '여행!'])
    assert.equal(isValidNickname(nickname), false);
});

test('required fields, confirmation and legacy login', () => {
  assert.deepEqual(Object.keys(validateSignup({})).sort(), [
    'email',
    'nickname',
    'password',
    'passwordConfirm',
  ]);
  const values = {
    email: 'trip@example.com',
    nickname: '여행자',
    password: 'abcd1234',
    passwordConfirm: 'abcd1234',
  };
  assert.deepEqual(validateSignup(values), {});
  assert.ok(validateSignup({ ...values, passwordConfirm: 'abcd1235' }).passwordConfirm);
  assert.deepEqual(validateLogin({ email: 'trip@example.com', password: 'legacy' }), {});
  assert.ok(validateLogin({ email: 'trip@example.com', password: '   ' }).password);
});
