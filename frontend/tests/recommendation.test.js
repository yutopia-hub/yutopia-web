import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendPlaces } from '../src/algorithm/recommendation/recommendationEngine.js';
import { normalizeCandidates } from '../src/algorithm/recommendation/normalizePlaces.js';
import {
  haversine,
  buildDistanceMatrix,
  distanceMetrics,
} from '../src/algorithm/recommendation/distanceCalculator.js';
import { analyzePreferences } from '../src/algorithm/recommendation/preferenceAnalyzer.js';
import { resolveConfig } from '../src/algorithm/recommendation/recommendationConfig.js';
import { weatherSuitability } from '../src/algorithm/recommendation/scoreCalculator.js';
import { createRecommendedCells } from '../src/algorithm/recommendation/boardPlacement.js';
import { createBoardState } from '../src/pages/board/state.js';
import { slots } from '../src/pages/board/config.js';

const place = (id, props = {}) => ({
  id: String(id),
  title: `여행지 ${id}`,
  category: '자연',
  lat: 37.5,
  lng: 127,
  ...props,
});
const ids = (result) => result.recommendations.map((p) => p.id);
const zero = { distance: 0, preference: 0, weather: 0, diversity: 0 };

test('empty, short, exact and duplicate input is safe, unique and capped at eight', () => {
  assert.equal(recommendPlaces().missingCount, 8);
  assert.deepEqual(ids(recommendPlaces()), []);
  assert.equal(
    recommendPlaces({ carrier: [place(1), place(1), null, {}, place(2)] }).missingCount,
    6,
  );
  for (const count of [8, 12]) {
    const result = recommendPlaces({ carrier: Array.from({ length: count }, (_, i) => place(i)) });
    assert.equal(result.recommendations.length, 8);
    assert.equal(new Set(ids(result)).size, 8);
    for (const p of result.recommendations) {
      assert.ok(p.score >= 0 && p.score <= 100);
      for (const score of Object.values(p.scores)) assert.ok(score >= 0 && score <= 100);
    }
  }
});

test('deterministic across repeat runs and carrier ordering, without input mutations', () => {
  const carrier = Array.from({ length: 16 }, (_, i) =>
    place(i, { lat: 37 + i * 0.01, category: ['자연', '문화', '레저'][i % 3], tags: ['산책'] }),
  );
  const board = [carrier[7], carrier[9]];
  const before = JSON.stringify({ carrier, board });
  const first = recommendPlaces({ carrier, board });
  assert.deepEqual(recommendPlaces({ carrier, board }), first);
  assert.deepEqual(recommendPlaces({ carrier: [...carrier].reverse(), board }), first);
  assert.equal(JSON.stringify({ carrier, board }), before);
});

test('board bonus retains comparable selections and permits replacement of extreme outlier', () => {
  const carrier = Array.from({ length: 12 }, (_, i) => place(i));
  const board = carrier.slice(4, 12);
  const result = recommendPlaces({ carrier, board });
  assert.equal(result.metrics.retainedCount, 8);
  assert.ok(result.recommendations.every((p) => p.retentionBonus === 10));
  const outlier = place('far', { lat: 33, lng: 126 });
  const optimized = recommendPlaces({ carrier: [...carrier, outlier], board: [outlier] });
  assert.ok(!ids(optimized).includes('far'));
});

test('existing board-only places remain eligible, with no external candidates', () => {
  const carrier = Array.from({ length: 7 }, (_, i) => place(i));
  const board = [place('existing')];
  const result = recommendPlaces({ carrier, board });
  assert.ok(ids(result).includes('existing'));
  assert.equal(result.recommendations.length, 8);
  assert.ok(result.warnings.some((w) => w.includes('보따리에서 빠진')));
});

test('five-point retention tolerance is independent of the retention bonus', () => {
  const carrier = Array.from({ length: 9 }, (_, i) => place(i, { setting: 'indoor' }));
  // Indoor clear=70 vs indoor fog=50; a .2 weather weight makes the difference four points.
  const weatherById = Object.fromEntries(
    carrier.map((p, i) => [p.id, { kind: i === 0 ? 'fog' : 'clear', temperature: 22 }]),
  );
  const config = { retentionBonus: 0, weights: { ...zero, weather: 0.2, distance: 0.8 } };
  const retained = recommendPlaces({ carrier, board: [carrier[0]], weatherById, config });
  const strict = recommendPlaces({
    carrier,
    board: [carrier[0]],
    weatherById,
    config: { ...config, retentionTolerance: 0 },
  });
  assert.ok(ids(retained).includes('0'));
  assert.ok(!ids(strict).includes('0'));
  for (const p of retained.recommendations) {
    const weighted = Object.entries(retained.weights).reduce(
      (sum, [key, weight]) => sum + p.scores[key] * weight,
      0,
    );
    assert.ok(Math.abs(weighted - p.baseScore) < 1e-9);
    assert.equal(p.retentionBonus, 0);
  }
});

test('cluster distance is preferred to interleaved distant input', () => {
  const carrier = Array.from({ length: 16 }, (_, i) =>
    place(i, { lat: i % 2 ? 33.4 + i * 0.001 : 37.5 + i * 0.001 }),
  );
  const baseline = distanceMetrics(
    [...Array(8).keys()],
    buildDistanceMatrix(normalizeCandidates(carrier.slice(0, 8))),
  );
  const result = recommendPlaces({ carrier });
  assert.ok(result.metrics.averageDistanceKm < 2);
  assert.ok(result.metrics.averageDistanceKm < baseline.averageDistanceKm / 10);
});

test('diversity weighting softens category concentration, including detailed subtypes', () => {
  const carrier = [
    ...Array.from({ length: 10 }, (_, i) => place(i, { cat3: '해수욕장' })),
    place('culture', { category: '문화', cat3: '박물관' }),
    place('sport', { category: '레저', cat3: '자전거' }),
  ];
  const noDiversity = recommendPlaces({ carrier, config: { weights: { ...zero, preference: 1 } } });
  const diverse = recommendPlaces({ carrier, config: { weights: { ...zero, diversity: 1 } } });
  assert.ok(diverse.metrics.categoryCount > noDiversity.metrics.categoryCount);
  assert.ok(diverse.recommendations.some((p) => p.subtype === '박물관'));
});

test('preferences are smoothed, candidate-excluded and board signal is bounded', () => {
  const carrier = normalizeCandidates([
    place('one'),
    place('two'),
    place('three'),
    place('culture', { category: '문화' }),
  ]);
  const config = resolveConfig();
  const preference = analyzePreferences(carrier, new Set(), config);
  assert.ok(
    preference(carrier.find((p) => p.id === 'one')) >
      preference(carrier.find((p) => p.id === 'culture')),
  );
  const singleton = normalizeCandidates([place('solo')]);
  assert.equal(analyzePreferences(singleton, new Set(['solo']), config)(singleton[0]), 50);
  const normal = recommendPlaces({ carrier: [place('one'), place('two')], board: [place('one')] });
  const duplicate = recommendPlaces({
    carrier: [place('one'), place('one'), place('two')],
    board: [place('one'), place('one')],
  });
  assert.deepEqual(
    normal.recommendations.map((p) => p.scores),
    duplicate.recommendations.map((p) => p.scores),
  );
});

test('weather changes recommendations only with known indoor/outdoor evidence', () => {
  const carrier = Array.from({ length: 16 }, (_, i) =>
    place(i, { setting: i < 8 ? 'indoor' : 'outdoor' }),
  );
  const weather = (kind) =>
    Object.fromEntries(carrier.map((p) => [p.id, { kind, temperature: 22 }]));
  const config = { weights: { ...zero, weather: 1 } };
  const rain = recommendPlaces({ carrier, weatherById: weather('rain'), config });
  const clear = recommendPlaces({ carrier, weatherById: weather('clear'), config });
  assert.ok(rain.recommendations.every((p) => p.setting === 'indoor'));
  assert.ok(clear.recommendations.every((p) => p.setting === 'outdoor'));
  assert.equal(weatherSuitability(place('unknown'), { kind: 'rain' }).score, 50);
  assert.equal(weatherSuitability(place('in', { setting: 'indoor' }), null).score, 50);
  assert.equal(
    weatherSuitability(place('in', { setting: 'indoor' }), { kind: 'rain', isMock: true }).score,
    50,
  );
  assert.ok(weatherSuitability(place('out', { setting: 'outdoor' }), { windSpeed: 40 }).score < 50);
  assert.ok(
    weatherSuitability(place('in', { setting: 'indoor', airConditioned: true }), {
      temperature: 35,
    }).score > 50,
  );
  assert.equal(
    weatherSuitability(place('in', { setting: 'indoor' }), { temperature: 35 }).score,
    50,
  );
});

test('unknown coordinates/categories stay neutral, no zero-distance fabrication', () => {
  const carrier = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    title: `장소 ${i}`,
    lat: i ? '' : 100,
    lng: null,
  }));
  const result = recommendPlaces({ carrier });
  assert.equal(result.metrics.averageDistanceKm, null);
  assert.equal(result.metrics.knownPairs, 0);
  assert.ok(
    result.recommendations.every((p) => p.scores.distance === 50 && p.scores.preference === 50),
  );
  assert.equal(haversine({ lat: null, lng: null }, place('p')), null);
  assert.ok(
    Math.abs(haversine({ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 }) - 325) < 5,
  );
});

test('explicit visits affect novelty; gameplay visited slots are never used', () => {
  const carrier = [place('a'), place('b')];
  const normal = recommendPlaces({ carrier });
  const visited = recommendPlaces({ carrier, visitedIds: ['a'] });
  assert.ok(
    visited.recommendations.find((p) => p.id === 'a').scores.diversity <
      normal.recommendations.find((p) => p.id === 'a').scores.diversity,
  );
});

test('config validates weights and score/bonus remain separate and bounded', () => {
  assert.throws(() => recommendPlaces({ config: { weights: { preference: -1 } } }));
  assert.throws(() => recommendPlaces({ config: { weights: zero } }));
  assert.throws(() => recommendPlaces({ config: { weights: { unknown: 1 } } }));
  assert.throws(() => recommendPlaces({ config: { distanceScaleKm: 0 } }));
});

test('placement preserves retained positions and never touches special cells', () => {
  const recommendations = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));
  const filled = { 2: '4', 10: '7' };
  const cells = createRecommendedCells(recommendations, filled, slots);
  assert.deepEqual(
    cells.find((c) => c.index === 2),
    { index: 2, placeId: '4' },
  );
  assert.deepEqual(
    cells.find((c) => c.index === 10),
    { index: 10, placeId: '7' },
  );
  assert.deepEqual(
    cells.map((c) => c.index),
    slots,
  );
  assert.deepEqual(filled, { 2: '4', 10: '7' });
  assert.equal(createRecommendedCells(recommendations.slice(0, 7), filled, slots), null);
});

test('atomic apply rejects stale or active games; leaves mileage/rewards/storage intact', () => {
  const storage = new Map([
    ['travel-notice:board-progress', JSON.stringify({ mileage: 3, rewards: 2 })],
  ]);
  globalThis.localStorage = {
    getItem: (key) => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  };
  const state = createBoardState();
  const places = Array.from({ length: 8 }, (_, i) => ({ id: String(i), n: `여행지 ${i}` }));
  state.load(places);
  const cells = slots.map((index, i) => ({ index, placeId: String(i) }));
  const revision = state.get().revision;
  state.put(slots[0], '0');
  assert.equal(state.applyRecommendation(cells, places, revision), false);
  let notifications = 0;
  state.subscribe(() => notifications++);
  assert.equal(state.applyRecommendation(cells, places, state.get().revision), true);
  assert.equal(notifications, 1);
  assert.equal(state.get().mileage, 3);
  assert.equal(state.get().rewards, 2);
  assert.equal(storage.size, 1);
  state.start();
  assert.equal(state.applyRecommendation(cells, places, state.get().revision), false);
  state.reset();
  state.busy(true);
  assert.equal(state.applyRecommendation(cells, places, state.get().revision), false);
  state.busy(false);
  assert.equal(
    state.applyRecommendation(
      [{ index: 0, placeId: '0' }, ...cells.slice(1)],
      places,
      state.get().revision,
    ),
    false,
  );
});
