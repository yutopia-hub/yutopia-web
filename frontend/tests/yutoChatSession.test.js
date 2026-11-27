import test from 'node:test';
import assert from 'node:assert/strict';
import { createYutoChatSession, makeYutoCourse } from '../src/api/yutoChatSession.js';
import { safeKakaoPlaceUrl, yutoMessagesHtml } from '../src/components/yutoChatMarkup.js';

const course = () => ({ title: '서울 코스', stops: [
  { id: 'kakao:1', title: '경복궁', lat: 37.57, lng: 126.98 },
  { id: 'kakao:2', title: '카페', lat: 37.58, lng: 126.99 },
] });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const failure = (status) => Object.assign(new Error('조회 실패'), { status });

function fixture() {
  let identity = { user: { id: 1 }, token: 'one' };
  let currentCourse;
  let history = [];
  const calls = { create: 0, send: 0, read: 0, remove: 0 };
  const snapshot = () => ({ conversationId: `conversation-${calls.create}`, course: currentCourse,
    turns: [...history], expiresAt: '2026-11-27T12:00:00Z' });
  const api = {
    available: true,
    async create(value) { calls.create++; currentCourse = value; history = []; return snapshot(); },
    async send(id, message) {
      calls.send++; history.push({ user: message, assistant: '예상 10분이에요.', evidence: [] });
      return { conversationId: id, answer: '예상 10분이에요.', evidence: [] };
    },
    async read() { calls.read++; return snapshot(); },
    async remove() { calls.remove++; },
  };
  const session = createYutoChatSession(course(), { api, getIdentity: () => identity });
  return { api, calls, session, snapshot, setIdentity(value) { identity = value; },
    setHistory(value) { history = value; } };
}

test('course context preserves visit order without mutating the recommendation', () => {
  const source = course();
  const original = structuredClone(source);
  const context = makeYutoCourse(source);
  assert.deepEqual(context.stops.map((s) => s.title), ['경복궁', '카페']);
  assert.deepEqual(context.stops.map((s) => s.id), ['stop-1', 'stop-2']);
  assert.deepEqual(source, original);
  assert.ok(Object.isFrozen(context.stops[0]));
  assert.notEqual(context.courseId, makeYutoCourse(source).courseId);
  assert.throws(() => makeYutoCourse({ stops: [] }));
  source.stops[0].lat = null;
  assert.throws(() => makeYutoCourse(source));
});

test('unavailable backend or missing login never creates fake replies or requests', async () => {
  const f = fixture();
  f.api.available = false;
  assert.equal(await f.session.open(), false);
  assert.equal(await f.session.send('질문'), false);
  f.api.available = true;
  f.setIdentity({ token: null, user: null });
  assert.equal(await f.session.open(), false);
  assert.equal(f.calls.create, 0);
  assert.deepEqual(f.session.getState().messages, []);
});

test('opening twice and consecutive questions reuse one conversation', async () => {
  const f = fixture();
  await f.session.open(); await f.session.open();
  await f.session.send('도보 시간'); await f.session.send('가는 길 경찰서');
  assert.equal(f.calls.create, 1);
  assert.equal(f.calls.send, 2);
  assert.deepEqual(f.session.getState().messages.map((m) => m.user), ['도보 시간', '가는 길 경찰서']);
});

test('double submission while pending does not create duplicate requests', async () => {
  const f = fixture();
  const gate = deferred();
  const create = f.api.create;
  f.api.create = async (...args) => { const value = await create(...args); await gate.promise; return value; };
  const first = f.session.send('첫 질문');
  assert.equal(await f.session.send('중복 질문'), false);
  assert.equal(await f.session.open(), false);
  gate.resolve();
  assert.equal(await first, true);
  assert.equal(f.calls.create, 1);
  assert.equal(f.calls.send, 1);
});

test('account switch during creation discards the old response and never sends its question', async () => {
  const f = fixture();
  const gate = deferred();
  const create = f.api.create;
  f.api.create = async (...args) => { const value = await create(...args); await gate.promise; return value; };
  const old = f.session.send('이전 회원 질문');
  f.setIdentity({ user: { id: 2 }, token: 'two' });
  f.session.syncIdentity();
  gate.resolve();
  assert.equal(await old, false);
  assert.equal(f.calls.send, 0);
  assert.equal(f.session.getState().conversationId, null);
  assert.deepEqual(f.session.getState().messages, []);
});

test('logout during a pending reply removes history and ignores late answers', async () => {
  const f = fixture(); await f.session.open();
  const gate = deferred();
  f.api.send = () => gate.promise;
  const old = f.session.send('이전 질문');
  f.setIdentity({ token: null, user: null }); f.session.syncIdentity();
  gate.resolve({ conversationId: 'conversation-1', answer: '이전 답변' });
  assert.equal(await old, false);
  assert.deepEqual(f.session.getState().messages, []);
  assert.equal(f.session.getState().pendingMessage, '');
});

test('dispose aborts the pending request and stops notifications from late replies', async () => {
  const f = fixture(); await f.session.open();
  const gate = deferred(); let signal;
  f.api.send = (_id, _text, options) => { signal = options.signal; return gate.promise; };
  let notifications = 0;
  f.session.subscribe(() => notifications++);
  const pending = f.session.send('질문');
  f.session.dispose(); const count = notifications;
  gate.resolve({ conversationId: 'conversation-1', answer: '늦은 답변' });
  assert.equal(await pending, false);
  assert.equal(signal.aborted, true);
  assert.equal(notifications, count);
});

test('uncertain delivery requires a history read before another send, without automatic resend', async () => {
  const f = fixture(); await f.session.open();
  f.api.send = async () => {
    f.calls.send++;
    f.setHistory([{ user: '도보 시간', assistant: '서버에서 완료된 답변', evidence: [] }]);
    throw new TypeError('network lost after server committed');
  };
  assert.equal(await f.session.send('도보 시간'), false);
  assert.equal(f.session.getState().needsRefresh, true);
  assert.equal(await f.session.send('도보 시간'), false);
  assert.equal(f.calls.send, 1);
  assert.equal(await f.session.refresh(), true);
  assert.equal(f.session.getState().needsRefresh, false);
  assert.equal(f.session.getState().messages[0].assistant, '서버에서 완료된 답변');
  assert.equal(f.calls.send, 1);
});

test('expired conversations require explicit restart and do not delete an expired ID', async () => {
  const f = fixture(); await f.session.open();
  f.api.send = async () => { throw failure(404); };
  await f.session.send('질문');
  assert.equal(f.session.getState().expired, true);
  assert.equal(await f.session.send('재전송'), false);
  assert.equal(f.calls.create, 1);
  await f.session.restart();
  assert.equal(f.calls.create, 2);
  assert.equal(f.calls.remove, 0);
  assert.equal(f.session.getState().expired, false);
});

test('explicit reset deletes the old conversation before creating a new one', async () => {
  const f = fixture(); await f.session.send('질문');
  const order = [];
  const create = f.api.create;
  f.api.remove = async () => { order.push('delete'); };
  f.api.create = async (...args) => { order.push('create'); return create(...args); };
  await f.session.restart();
  assert.deepEqual(order, ['delete', 'create']);
  assert.deepEqual(f.session.getState().messages, []);
});

test('authentication failures block further requests until identity changes', async () => {
  const f = fixture(); await f.session.open();
  f.api.send = async () => { throw failure(401); };
  await f.session.send('질문');
  assert.equal(f.session.getState().requiresLogin, true);
  assert.equal(await f.session.refresh(), false);
  f.setIdentity({ user: { id: 1 }, token: 'renewed' });
  await f.session.open();
  assert.equal(f.calls.create, 2);
  assert.equal(f.session.getState().requiresLogin, false);
});

test('refresh after an identity change creates a new conversation instead of reading the old member ID', async () => {
  const f = fixture(); await f.session.open();
  f.setIdentity({ user: { id: 2 }, token: 'two' });
  await f.session.refresh();
  assert.equal(f.calls.read, 0);
  assert.equal(f.calls.create, 2);
  assert.equal(f.session.getState().conversationId, 'conversation-2');
  assert.deepEqual(f.session.getState().messages, []);
});

test('invalid questions and separate course sessions do not share state', async () => {
  const first = fixture(); const second = fixture();
  assert.equal(await first.session.send('  '), false);
  assert.equal(await first.session.send('x'.repeat(2001)), false);
  await first.session.send('첫 코스 질문');
  assert.deepEqual(second.session.getState().messages, []);
  assert.equal(second.calls.create, 0);
});

test('chat markup escapes model, user and provider strings and rejects unsafe links', () => {
  const html = yutoMessagesHtml({ messages: [{ user: '<img src=x onerror=alert(1)>', assistant: '<script>bad()</script>', evidence: [
    { tool: 'searchPlacesAlongRoute', success: true, result: { partial: true, places: [
      { id: 'hidden-id', title: '<b>식당</b>', address: '<svg onload=bad()>', placeUrl: 'javascript:alert(1)' },
    ] } },
  ] }], pendingMessage: '' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('hidden-id'));
  assert.ok(html.includes('일부 정보만'));
  assert.equal(safeKakaoPlaceUrl('https://place.map.kakao.com/123'), 'https://place.map.kakao.com/123');
  for (const url of ['javascript:alert(1)', 'https://place.map.kakao.com.evil.test/123', 'https://place.map.kakao.com@evil.test/1']) {
    assert.equal(safeKakaoPlaceUrl(url), '');
  }
});
