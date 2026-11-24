import { collectCandidates, categoryByKey } from './coursePlaces.js';
import { planCourse, formatCourse, mergeRoadMatrix, roadLeg } from '../algorithm/tsp.js';
import { weatherProfile, pickByWeather, PLACE_SETTING } from '../algorithm/weatherPolicy.js';
import { fetchRoadMatrix, fetchRoadPath } from './kakaoRoute.js';
import { fetchCourseWeather } from './courseWeather.js';

// AI 코스 추천 전체 흐름
//   0) (선택) 지역의 현재 날씨 → 야외 적합도/걷는 한계 거리로 요약 (weatherPolicy.js)
//   1) 카카오 로컬 검색으로 지역 주변 후보 장소 수집
//   2) 날씨 점수로 후보를 정렬해 카테고리별 상위만 남기고, 서버(/api/ai-course)의 OpenAI 가
//      그중에서 코스에 넣을 장소 + 체류 시간 선택 (키가 없거나 실패하면 날씨 점수 상위 장소로 대체)
//   3) 카카오 길찾기로 장소들 사이 실제 도로 거리 행렬 n×n 생성
//   4) TSP 비트마스킹 DP 로 도로 거리 기준 최단 방문 순서 계산
//   5) 정해진 순서로 구간별 길찾기 → 지도에 그릴 실제 도로 경로 + 구간 시간 (날씨에 따라 도보 한계 조정)

const WEATHER_LABEL = {
  clear: '맑음',
  cloudy: '구름 조금',
  overcast: '흐림',
  fog: '안개',
  rain: '비',
  snow: '눈',
  thunder: '천둥번개',
};

const GUIDANCE = {
  bad: '실내 장소(식당·카페·쇼핑·숙박) 위주로 고르고 야외 명소는 최소화하세요.',
  caution: '야외 장소는 적게, 실내와 섞어서 고르세요.',
  good: '야외 명소를 적극 넣고 실내 장소와 균형을 맞추세요.',
};

/** 화면/AI 프롬프트에 쓰는 날씨 한 줄 요약 */
export function describeWeather(weather) {
  if (!weather) return '';
  const label = WEATHER_LABEL[weather.kind] ?? weather.kind;
  const feels = Math.round(weather.feelsLike ?? weather.temperature);
  return `${label}, ${Math.round(weather.temperature)}°C (체감 ${feels}°C), 바람 ${(weather.windSpeed ?? 0).toFixed(1)}m/s`;
}

async function askAi(region, categoryLabels, candidates, weather, profile) {
  const response = await fetch('/api/ai-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      region,
      categories: categoryLabels,
      weather: weather
        ? { summary: describeWeather(weather), guidance: GUIDANCE[profile.level] }
        : undefined,
      candidates: candidates.map(({ id, title, categoryLabel, category, address, distanceM }) => ({
        id,
        title,
        categoryLabel,
        setting: PLACE_SETTING[category],
        address,
        distanceM,
      })),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI 서버 오류 (${response.status})`);
  if (!data.stops?.length) throw new Error('AI 가 장소를 고르지 못했어요.');
  return data;
}

/**
 * @param {string} region        "강남구 역삼동"
 * @param {string[]} categoryKeys ['food', 'cafe', ...]
 * @param {{ weather?: object|null }} [options]  이미 불러온 날씨. 없으면 지역 중심 좌표로 새로 불러온다
 */
export async function buildAiCourse(region, categoryKeys, { weather: given } = {}) {
  const { center, candidates: found } = await collectCandidates(region, categoryKeys);
  const labels = categoryKeys.map((key) => categoryByKey(key)?.label).filter(Boolean);

  // 날씨는 있으면 좋은 정보라서 실패해도 코스 추천은 계속한다
  let weather = given ?? null;
  if (!weather) weather = await fetchCourseWeather(center).catch(() => null);
  const profile = weatherProfile(weather);

  // 날씨 점수 순위 + 카테고리별 상위만 AI 에게 준다. AI 를 못 쓰면 picks 가 그대로 코스가 된다
  const { picks, shortlist } = pickByWeather(found, profile, categoryKeys);
  const candidates = shortlist;

  let picked;
  let aiUsed = true;
  let notice = '';
  try {
    picked = await askAi(region, labels, candidates, weather, profile);
  } catch (error) {
    aiUsed = false;
    notice = error.message;
    picked = {
      title: '',
      summary: '',
      stops: picks.map((c) => ({ id: c.id, stayMinutes: c.stayMinutes, reason: '' })),
    };
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const places = picked.stops
    .map((stop) => {
      const place = byId.get(stop.id);
      if (!place) return null;
      return {
        ...place,
        stayMinutes: stop.stayMinutes ?? place.stayMinutes,
        reason: stop.reason ?? '',
      };
    })
    .filter(Boolean);
  if (places.length < 2) throw new Error('코스를 만들 만큼 장소가 모이지 않았어요.');

  // 숙소가 있으면 하루 일정의 마지막으로 고정 (TSP 의 end 조건)
  const stayIndex = places.findIndex((p) => p.category === 'stay');
  const endIndex = stayIndex === -1 ? undefined : stayIndex;

  // 실제 도로 거리 행렬로 TSP. 길찾기가 안 되면 직선거리 추정으로 푼다
  let road;
  let routeNotice = '';
  try {
    road = mergeRoadMatrix(places, await fetchRoadMatrix(places));
  } catch (error) {
    routeNotice = error.message;
  }
  const course = planCourse(places, { endIndex, road, walkLimitKm: profile.walkLimitKm });

  // 정해진 순서대로 실제 도로 경로를 받아 구간마다 붙인다
  try {
    const { sections } = await fetchRoadPath(course.stops);
    if (sections.length === course.legs.length) {
      course.legs = course.legs.map((leg, k) => {
        const km = sections[k].meters / 1000;
        return {
          ...leg,
          km,
          ...roadLeg(km, sections[k].seconds / 60, sections[k].taxiFare, profile.walkLimitKm),
          path: sections[k].path,
        };
      });
      course.totalKm = course.legs.reduce((sum, leg) => sum + leg.km, 0);
      course.moveMinutes = course.legs.reduce((sum, leg) => sum + leg.minutes, 0);
      course.totalMinutes = course.moveMinutes + course.stayMinutes;
      course.hasRoadPath = true;
    }
  } catch (error) {
    routeNotice = error.message;
  }

  if (import.meta.env.DEV) console.info(`[AI 코스]\n${formatCourse(course)}`);

  return {
    region: center.name || region,
    center,
    title: picked.title || `${region} 추천 코스`,
    summary: picked.summary || '',
    aiUsed,
    notice,
    routeNotice,
    weather,
    weatherProfile: profile,
    ...course,
  };
}
