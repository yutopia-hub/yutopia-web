import { clampScore } from './recommendationConfig.js';

export function weatherSuitability(place, weather) {
  if (!weather || weather.isMock || !place.setting)
    return {
      score: 50,
      reason: '날씨 또는 실내·야외 근거가 없어 날씨 점수를 중립으로 반영했어요.',
    };
  const indoor = place.setting === 'indoor';
  if (weather.temperature >= 33)
    return {
      score: indoor ? (place.airConditioned ? 95 : 50) : 15,
      reason:
        indoor && place.airConditioned
          ? '현재 폭염에 냉방 가능한 실내 장소예요.'
          : '현재 폭염과 확인된 실내·야외 정보를 반영했어요.',
    };
  if (weather.windSpeed >= 36)
    return { score: indoor ? 90 : 15, reason: '현재 강풍과 확인된 실내·야외 정보를 반영했어요.' };
  if (weather.kind === 'rain')
    return {
      score: indoor ? 95 : 20,
      reason: indoor
        ? '현재 비가 내려 실내 장소를 우대했어요.'
        : '현재 비가 내려 야외 활동 적합도를 낮췄어요.',
    };
  if (weather.kind === 'snow')
    return {
      score: indoor ? 90 : 30,
      reason: '현재 눈이 내려 확인된 실내·야외 정보를 반영했어요.',
    };
  if (weather.kind === 'clear')
    return {
      score: indoor ? 70 : 95,
      reason: indoor
        ? '현재 맑은 날씨의 실내 활동 적합도를 반영했어요.'
        : '현재 맑은 날씨에 적합한 야외 장소예요.',
    };
  return { score: 50, reason: '현재 날씨의 활동 적합도는 중립으로 반영했어요.' };
}

export function calculateScore(scores, retained, config) {
  const baseScore = Object.entries(config.weights).reduce(
    (sum, [key, weight]) => sum + weight * scores[key],
    0,
  );
  const retentionBonus = retained ? Math.min(10, config.retentionBonus) : 0;
  return { baseScore, retentionBonus, score: clampScore(baseScore + retentionBonus) };
}
