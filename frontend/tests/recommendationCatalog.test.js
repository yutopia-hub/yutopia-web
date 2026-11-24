import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecommendationCatalogLoader } from '../src/api/recommendationCatalogApi.js';

test('national catalog covers every supplied region, deduplicates, limits concurrency and caches', async () => {
  let calls = 0,
    active = 0,
    maximum = 0,
    now = 0;
  const areas = Array.from({ length: 7 }, (_, i) => ({ code: String(i) }));
  const requested = [];
  const load = createRecommendationCatalogLoader({
    getAreas: async () => areas,
    listPlaces: async ({ areaCode, numOfRows, pageNo, signal }) => {
      calls++;
      active++;
      maximum = Math.max(maximum, active);
      assert.equal(numOfRows, 24);
      assert.equal(pageNo, 1);
      assert.ok(signal instanceof AbortSignal);
      requested.push(areaCode);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return [
        { id: areaCode, title: `지역 ${areaCode}` },
        { id: 'shared', title: '중복 장소' },
      ];
    },
    now: () => now,
  });
  const result = await load();
  assert.equal(result.places.length, 8);
  assert.deepEqual(
    requested.sort(),
    areas.map((a) => a.code),
  );
  assert.equal(maximum, 4);
  assert.equal((await load()).places.length, 8);
  assert.equal(calls, 7);
  now = 600001;
  await load();
  assert.equal(calls, 14);
});

test('partial failures retain successful areas and are retryable; complete failure is explicit', async () => {
  let fail = true;
  const load = createRecommendationCatalogLoader({
    getAreas: async () => [{ code: 'a' }, { code: 'b' }],
    listPlaces: async ({ areaCode }) => {
      if (fail && areaCode === 'a') throw new Error('offline');
      return [{ id: areaCode, title: areaCode }];
    },
  });
  const partial = await load();
  assert.equal(partial.failedAreas, 1);
  assert.deepEqual(
    partial.places.map((p) => p.id),
    ['b'],
  );
  fail = false;
  assert.equal((await load()).places.length, 2);
  await assert.rejects(
    createRecommendationCatalogLoader({ getAreas: async () => [], listPlaces: async () => [] })(),
    /불러오지 못했어요/,
  );
});

test('aborted catalog work propagates cancellation instead of falling back to bag or examples', async () => {
  const controller = new AbortController();
  const load = createRecommendationCatalogLoader({
    getAreas: async () => [{ code: 'a' }],
    listPlaces: async ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        controller.abort();
      }),
  });
  await assert.rejects(load({ signal: controller.signal }), { name: 'AbortError' });
});
