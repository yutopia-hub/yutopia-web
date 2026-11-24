import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecommendationWeatherLoader } from '../src/api/recommendationWeatherApi.js';
import { normalizeWeather } from '../src/api/weatherApi.js';

test('weather normalization retains wind in explicitly requested km/h', () => {
  const weather = normalizeWeather({
    current: { time: 1000, temperature_2m: 22, weather_code: 0, wind_speed_10m: 40 },
  });
  assert.equal(weather.windSpeed, 40);
  assert.equal(weather.kind, 'clear');
});

test('weather uses exact destination coordinates, merges duplicates, caches and expires', async () => {
  let calls = 0;
  let time = 0;
  const load = createRecommendationWeatherLoader(
    async (location) => {
      calls++;
      assert.deepEqual(location, { latitude: 37, longitude: 127 });
      return { kind: 'rain' };
    },
    () => time,
  );
  const places = [
    { id: 'a', lat: 37, lng: 127, setting: 'indoor' },
    { id: 'b', lat: 37, lng: 127, setting: 'outdoor' },
    { id: 'unknown', lat: 33, lng: 126 },
  ];
  assert.deepEqual((await load(places)).weatherById, { a: { kind: 'rain' }, b: { kind: 'rain' } });
  await load(places);
  assert.equal(calls, 1);
  time = 600001;
  await load(places);
  assert.equal(calls, 2);
});

test('weather failures are neutral, request count capped and abort propagates', async () => {
  let calls = 0;
  const load = createRecommendationWeatherLoader(async () => {
    calls++;
    throw new Error('offline');
  });
  const places = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    lat: 37 + i * 0.001,
    lng: 127,
    setting: 'outdoor',
  }));
  const result = await load(places);
  assert.equal(calls, 24);
  assert.equal(result.failed, 24);
  assert.equal(result.skipped, 6);
  assert.deepEqual(result.weatherById, {});
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(load(places, { signal: controller.signal }), { name: 'AbortError' });
});

test('in-flight weather work aborts when a recommendation becomes stale', async () => {
  const controller = new AbortController();
  let active = 0;
  let maximum = 0;
  const load = createRecommendationWeatherLoader(async (_location, { signal }) => {
    active++;
    maximum = Math.max(maximum, active);
    return new Promise((_resolve, reject) =>
      signal.addEventListener(
        'abort',
        () => {
          active--;
          reject(new DOMException('cancelled', 'AbortError'));
        },
        { once: true },
      ),
    );
  });
  const places = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    lat: 37 + i * 0.001,
    lng: 127,
    setting: 'outdoor',
  }));
  const pending = load(places, { signal: controller.signal });
  assert.equal(maximum, 4);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(active, 0);
});
