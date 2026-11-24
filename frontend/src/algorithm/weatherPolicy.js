/**
 * 날씨 기반 코스 추천 정책 (규칙 기반 점수화 + 정렬 Top-K 선택)
 *
 * 하는 일
 *   1) 현재 날씨 → "야외 활동 적합도"(0~100)와 "걸어도 되는 한계 거리"로 요약한다  (weatherProfile)
 *   2) 후보 장소를 실내/야외로 나눠 날씨 적합도 점수를 매기고, 가까운 정도와 합쳐 순위를 만든다 (rankCandidates)
 *   3) 카테고리마다 상위 K 곳만 골라 AI 에게 줄 후보 / AI 를 못 쓸 때의 기본 코스를 만든다  (pickByWeather)
 *   4) 걷는 한계 거리는 TSP 구간의 이동 수단(도보 ↔ 대중교통/택시)을 정할 때 쓴다 (tsp.js)
 *
 * 복잡도: 후보 n 개 점수화 O(n), 정렬 O(n log n), 카테고리 c 개에서 상위 K 선택 O(n log n + cK)
 */

// 장소 종류별 실내/야외 구분 (카테고리 키는 coursePlaces.js 와 같다)
export const PLACE_SETTING = {
  sight: 'outdoor',
  festival: 'outdoor',
  transit: 'neutral',
  food: 'indoor',
  cafe: 'indoor',
  shopping: 'indoor',
  medical: 'indoor',
  stay: 'indoor',
};

const WALK_NORMAL_KM = 1.2;
const WALK_BAD_KM = 0.4;
const WALK_HARSH_KM = 0.6;

/**
 * @param {{ kind: string, temperature: number, feelsLike?: number, windSpeed?: number }|null} weather
 * @returns {{ level: 'good'|'caution'|'bad', outdoorScore: number, walkLimitKm: number,
 *             preferIndoor: boolean, reasonKey: string, reason: string }}
 */
export function weatherProfile(weather) {
  if (!weather) {
    return {
      level: 'good',
      outdoorScore: 70,
      walkLimitKm: WALK_NORMAL_KM,
      preferIndoor: false,
      reasonKey: 'unknown',
      reason: '',
    };
  }
  const feels = weather.feelsLike ?? weather.temperature;
  const wind = weather.windSpeed ?? 0;

  // 심한 날씨부터 순서대로 판단한다 (먼저 맞는 규칙이 이긴다)
  if (weather.kind === 'thunder') return make('bad', 10, WALK_BAD_KM, 'thunder');
  if (weather.kind === 'rain') return make('bad', 20, WALK_BAD_KM, 'rain');
  if (weather.kind === 'snow') return make('bad', 25, WALK_BAD_KM, 'snow');
  if (feels >= 33) return make('bad', 25, WALK_HARSH_KM, 'hot');
  if (feels <= -5) return make('bad', 25, WALK_HARSH_KM, 'cold');
  if (wind >= 10) return make('caution', 35, WALK_HARSH_KM, 'wind');
  if (weather.kind === 'fog') return make('caution', 55, 0.9, 'fog');
  if (weather.kind === 'overcast') return make('good', 72, WALK_NORMAL_KM, 'overcast');
  if (weather.kind === 'cloudy') return make('good', 85, WALK_NORMAL_KM, 'cloudy');
  return make('good', 95, WALK_NORMAL_KM, 'clear');
}

function make(level, outdoorScore, walkLimitKm, reasonKey) {
  return {
    level,
    outdoorScore,
    walkLimitKm,
    preferIndoor: outdoorScore < 50,
    reasonKey,
    reason: REASONS[reasonKey],
  };
}

// 화면에 보여 줄 한국어 설명 (영문은 i18n 에서 같은 문구를 키로 번역)
export const REASONS = {
  unknown: '',
  thunder: '천둥·번개가 쳐서 실내 위주로, 이동은 걷지 않게 짰어요.',
  rain: '비가 와서 실내 위주로 고르고, 걷는 구간은 줄였어요.',
  snow: '눈이 와서 실내 위주로 고르고, 걷는 구간은 줄였어요.',
  hot: '무더운 날씨라 실내(시원한 곳) 위주로 고르고, 걷는 구간은 줄였어요.',
  cold: '매우 추운 날씨라 실내 위주로 고르고, 걷는 구간은 줄였어요.',
  wind: '바람이 강해서 야외 장소를 줄였어요.',
  fog: '안개가 껴서 야외 장소를 조금 줄였어요.',
  overcast: '흐리지만 야외 활동도 괜찮아요.',
  cloudy: '구름이 조금 있지만 야외 활동하기 좋아요.',
  clear: '맑은 날씨라 야외 명소를 적극 넣었어요.',
};

/** 장소 하나의 날씨 적합도 (0~100). 실내는 어떤 날씨에도 기본 60점 이상, 야외는 날씨를 그대로 따른다 */
export function weatherFit(category, profile) {
  const setting = PLACE_SETTING[category] ?? 'neutral';
  if (setting === 'outdoor') return profile.outdoorScore;
  if (setting === 'indoor') return 60 + (100 - profile.outdoorScore) * 0.4; // 나쁜 날씨일수록 실내가 더 좋다
  return 60;
}

const RADIUS_M = 2000;
const W_WEATHER = 0.6;
const W_NEAR = 0.4;

/** 가까운 정도 점수: 중심에 가까울수록 100, 반경(2km) 끝이면 0 */
export function proximityScore(distanceM) {
  if (!Number.isFinite(distanceM)) return 50;
  return Math.max(0, 100 * (1 - distanceM / RADIUS_M));
}

/** 날씨 60% + 가까움 40% 로 점수를 매겨 높은 순으로 정렬 (원본은 건드리지 않는다) */
export function rankCandidates(candidates, profile) {
  return candidates
    .map((place) => {
      const fit = weatherFit(place.category, profile);
      const near = proximityScore(place.distanceM);
      return { ...place, weatherFit: fit, score: W_WEATHER * fit + W_NEAR * near };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/**
 * 카테고리마다 점수 상위 perCategory 곳씩 남긴다 (AI 에게 줄 후보 줄이기 + AI 실패 시 대체 코스).
 * 관광명소(sight)와 사용자가 고른 카테고리만 대상으로 한다.
 */
export function pickByWeather(
  candidates,
  profile,
  categoryKeys,
  { perCategory = 4, max = 7 } = {},
) {
  const ranked = rankCandidates(candidates, profile);
  const wanted = ['sight', ...categoryKeys];
  const picks = [];
  for (const key of wanted) {
    // 나쁜 날씨의 관광명소는 1곳만, 맑으면 2곳
    const quota = key === 'sight' ? (profile.preferIndoor ? 1 : 2) : 1;
    ranked
      .filter((p) => p.category === key && !picks.includes(p))
      .slice(0, quota)
      .forEach((p) => picks.push(p));
  }
  return { ranked, picks: picks.slice(0, max), shortlist: topPerCategory(ranked, perCategory) };
}

function topPerCategory(ranked, k) {
  const count = new Map();
  return ranked.filter((p) => {
    const n = (count.get(p.category) ?? 0) + 1;
    count.set(p.category, n);
    return n <= k;
  });
}
