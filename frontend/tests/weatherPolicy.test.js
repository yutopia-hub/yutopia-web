import test from 'node:test';
import assert from 'node:assert/strict';
import {
  weatherProfile,
  weatherFit,
  rankCandidates,
  pickByWeather,
  proximityScore,
} from '../src/algorithm/weatherPolicy.js';
import { kindFromOwm } from '../api/_weather.js';
import { estimateLeg, planCourse, buildDistanceMatrix } from '../src/algorithm/tsp.js';

const sunny = { kind: 'clear', temperature: 22, feelsLike: 22, windSpeed: 2 };
const rainy = { kind: 'rain', temperature: 12, feelsLike: 10, windSpeed: 3 };

test('OpenWeatherMap 코드 → 날씨 종류', () => {
  assert.equal(kindFromOwm(211), 'thunder');
  assert.equal(kindFromOwm(300), 'rain');
  assert.equal(kindFromOwm(502), 'rain');
  assert.equal(kindFromOwm(601), 'snow');
  assert.equal(kindFromOwm(741), 'fog');
  assert.equal(kindFromOwm(800), 'clear');
  assert.equal(kindFromOwm(801), 'cloudy');
  assert.equal(kindFromOwm(804), 'overcast');
});

test('날씨 요약: 비·폭염·강풍은 실내 우선, 맑으면 야외 우선', () => {
  assert.equal(weatherProfile(rainy).preferIndoor, true);
  assert.equal(weatherProfile(rainy).walkLimitKm, 0.4);
  assert.equal(weatherProfile({ kind: 'clear', temperature: 35, feelsLike: 37 }).reasonKey, 'hot');
  assert.equal(
    weatherProfile({ kind: 'clear', temperature: -8, feelsLike: -12 }).reasonKey,
    'cold',
  );
  assert.equal(weatherProfile({ kind: 'clear', temperature: 20, windSpeed: 12 }).level, 'caution');
  assert.equal(weatherProfile(sunny).preferIndoor, false);
  assert.equal(weatherProfile(sunny).walkLimitKm, 1.2);
  assert.equal(weatherProfile(null).level, 'good'); // 날씨를 못 불러와도 동작
});

test('날씨 적합도: 비 오면 실내 > 야외, 맑으면 야외 > 실내', () => {
  const rain = weatherProfile(rainy);
  const sun = weatherProfile(sunny);
  assert.ok(weatherFit('cafe', rain) > weatherFit('sight', rain));
  assert.ok(weatherFit('sight', sun) > weatherFit('cafe', sun));
  assert.ok(weatherFit('food', rain) >= 60, '실내는 어떤 날씨에도 60점 이상');
});

test('근접 점수: 중심 100, 반경 끝 0, 값 없으면 50', () => {
  assert.equal(proximityScore(0), 100);
  assert.equal(proximityScore(2000), 0);
  assert.equal(proximityScore(undefined), 50);
});

const candidates = [
  { id: 'a', title: '궁', category: 'sight', distanceM: 100 },
  { id: 'b', title: '공원', category: 'sight', distanceM: 300 },
  { id: 'c', title: '식당', category: 'food', distanceM: 900 },
  { id: 'd', title: '카페', category: 'cafe', distanceM: 400 },
  { id: 'e', title: '카페2', category: 'cafe', distanceM: 1500 },
];

test('순위: 맑은 날은 가까운 야외 명소가 1위, 비 오는 날은 실내가 앞선다', () => {
  assert.equal(rankCandidates(candidates, weatherProfile(sunny))[0].category, 'sight');
  const rainRank = rankCandidates(candidates, weatherProfile(rainy));
  assert.notEqual(rainRank[0].category, 'sight');
  assert.ok(rainRank.findIndex((p) => p.id === 'd') < rainRank.findIndex((p) => p.id === 'a'));
});

test('후보 선택: 비 오면 관광명소 1곳, 맑으면 2곳 + 고른 카테고리 각 1곳', () => {
  const sun = pickByWeather(candidates, weatherProfile(sunny), ['food', 'cafe']);
  const rain = pickByWeather(candidates, weatherProfile(rainy), ['food', 'cafe']);
  assert.equal(sun.picks.filter((p) => p.category === 'sight').length, 2);
  assert.equal(rain.picks.filter((p) => p.category === 'sight').length, 1);
  assert.equal(sun.picks.filter((p) => p.category === 'food').length, 1);
  assert.deepEqual(
    candidates.map((c) => c.id),
    ['a', 'b', 'c', 'd', 'e'],
    '입력 배열은 그대로',
  );
});

test('걷는 한계: 0.8km 는 맑으면 도보, 비 오면 대중교통', () => {
  assert.equal(estimateLeg(0.8, weatherProfile(sunny).walkLimitKm).mode, 'walk');
  assert.equal(estimateLeg(0.8, weatherProfile(rainy).walkLimitKm).mode, 'transit');
});

test('planCourse: 비 오는 날은 같은 코스에서 도보 구간이 줄어든다', () => {
  const places = [
    { title: 'A', lat: 37.5, lng: 127.0 },
    { title: 'B', lat: 37.505, lng: 127.0 },
    { title: 'C', lat: 37.51, lng: 127.0 },
    { title: 'D', lat: 37.515, lng: 127.0 },
  ];
  assert.ok(buildDistanceMatrix(places)[0][1] > 0.4);
  const walks = (limit) =>
    planCourse(places, { walkLimitKm: limit }).legs.filter((l) => l.mode === 'walk').length;
  assert.ok(walks(0.4) < walks(1.2));
});
