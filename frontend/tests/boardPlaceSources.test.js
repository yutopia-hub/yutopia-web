import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardState } from '../src/pages/board/state.js';
import { getVisiblePlaces } from '../src/pages/board/placeList.js';
import { recommendPlaces } from '../src/algorithm/recommendation/recommendationEngine.js';

const place = (id, category = '자연') => ({ id, n: id, title: id, category, lat: 37.5, lng: 127 });

test('catalog suggestions work without a bag and do not manufacture user preferences', () => {
  const candidates = Array.from({ length: 12 }, (_, i) =>
    place(String(i), i < 10 ? '자연' : '문화'),
  );
  const result = recommendPlaces({ candidates });
  assert.equal(result.recommendations.length, 8);
  assert.ok(result.recommendations.every((p) => p.scores.preference === 50));
});

test('external candidates use only the actual saved preference signals', () => {
  const carrier = [place('saved1'), place('saved2')];
  const candidates = [
    ...Array.from({ length: 12 }, (_, i) => place(`culture${i}`, '문화')),
    place('nature'),
  ];
  const result = recommendPlaces({
    carrier,
    candidates,
    config: { weights: { distance: 0, preference: 1, weather: 0, diversity: 0 } },
  });
  assert.ok(result.recommendations.some((p) => p.id === 'nature'));
  const nature = result.recommendations.find((p) => p.id === 'nature');
  assert.ok(nature.scores.preference > 50);
  assert.ok(
    result.recommendations
      .filter((p) => p.id.startsWith('culture'))
      .every((p) => p.scores.preference === 50),
  );
});

test('source switching preserves placements, displays only each list and never fills automatically', () => {
  const state = createBoardState();
  state.load([place('bag')]);
  const before = state.get().filled;
  state.recommendations({ places: [place('new')], status: 'loaded' });
  state.source('recommended');
  assert.deepEqual(
    getVisiblePlaces(state.get()).map((p) => p.id),
    ['new'],
  );
  assert.equal(state.get().filled, before);
  assert.equal(state.put(1, 'new'), true);
  assert.equal(state.put(2, 'new'), false);
  state.source('carrier');
  assert.deepEqual(
    getVisiblePlaces(state.get()).map((p) => p.id),
    ['bag'],
  );
  assert.deepEqual(state.get().filled, { 1: 'new' });
  state.load([]);
  assert.deepEqual(getVisiblePlaces(state.get()), []);
  assert.equal(state.get().places.find((p) => p.id === 'new').title, 'new');
});

test('recommended destinations survive save and restore without entering the bag', () => {
  const state = createBoardState();
  state.load([place('bag')]);
  state.recommendations({ places: [place('external')], status: 'loaded' });
  state.put(1, 'external');
  const payload = state.payload('test');
  assert.deepEqual(
    payload.places.map((p) => p.id),
    ['external'],
  );
  const reloaded = createBoardState();
  reloaded.load([place('bag')]);
  reloaded.restore(payload.cells, payload.places);
  assert.deepEqual(reloaded.get().filled, { 1: 'external' });
  assert.deepEqual(
    getVisiblePlaces(reloaded.get()).map((p) => p.id),
    ['bag'],
  );
  assert.equal(reloaded.get().places.find((p) => p.id === 'external').title, 'external');
  reloaded.restore([{ index: 2, placeId: 'bag' }]);
  assert.deepEqual(reloaded.get().filled, { 2: 'bag' });
});
