import test from 'node:test';
import assert from 'node:assert/strict';
import { getMyActivity } from '../src/api/myActivityApi.js';
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
const save = (id, value) =>
  storage.set('travel-notice:mypage-activity:' + id, JSON.stringify(value));

test('unconnected activity uses clearly tagged examples without writing storage', async () => {
  const activity = await getMyActivity('demo');
  assert.equal(activity.isMock, true);
  assert.deepEqual(activity.summary, { bagCount: 6, completionCount: 3, rewardCount: 2 });
  assert.equal(activity.bag.length, 3);
  assert.equal(storage.size, 0);
});
test('empty connected activity remains empty and separate per member', async () => {
  save('empty', { bag: [], completions: [], rewards: [] });
  const empty = await getMyActivity('empty');
  assert.equal(empty.isMock, false);
  assert.deepEqual(empty.summary, { bagCount: 0, completionCount: 0, rewardCount: 0 });
  assert.equal((await getMyActivity('other')).isMock, true);
});
test('latest records, complete counts and invalid shapes', async () => {
  save('records', {
    bag: [
      null,
      { name: 'old', savedAt: '2026-09-01' },
      { name: 'new', savedAt: '2026-10-02' },
      { name: 'second', savedAt: '2026-10-01' },
      { name: 'third', savedAt: '2026-09-30' },
    ],
    completions: 'invalid',
    rewards: [{ name: 'reward', status: 'expired' }],
  });
  const activity = await getMyActivity('records');
  assert.equal(activity.summary.bagCount, 4);
  assert.deepEqual(
    activity.bag.map((item) => item.name),
    ['new', 'second', 'third'],
  );
  assert.deepEqual(activity.completions, []);
  assert.equal(activity.rewards[0].status, 'expired');
  await assert.rejects(getMyActivity(null), /회원/);
});
