export const RECOMMENDATION_CONFIG = Object.freeze({
  size: 8,
  weights: Object.freeze({ distance: 0.3, preference: 0.35, weather: 0.2, diversity: 0.15 }),
  retentionBonus: 10,
  retentionTolerance: 5,
  boardSignal: 1.5,
  smoothing: 4,
  distanceScaleKm: 40,
  seedCount: 10,
  swapPasses: 2,
});

export const clampScore = (score) => Math.max(0, Math.min(100, score));
export const mean = (values, fallback = 50) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : fallback;

export function resolveConfig(options = {}) {
  const config = { ...RECOMMENDATION_CONFIG, ...options };
  const weights = { ...RECOMMENDATION_CONFIG.weights, ...options.weights };
  if (Object.keys(weights).some((key) => !(key in RECOMMENDATION_CONFIG.weights)))
    throw new Error('지원하지 않는 추천 가중치입니다.');
  if (Object.values(weights).some((v) => !Number.isFinite(v) || v < 0))
    throw new Error('추천 가중치는 0 이상의 숫자여야 합니다.');
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (!sum) throw new Error('추천 가중치의 합은 0보다 커야 합니다.');
  for (const key of Object.keys(weights)) weights[key] /= sum;
  for (const key of [
    'retentionBonus',
    'retentionTolerance',
    'boardSignal',
    'smoothing',
    'distanceScaleKm',
  ]) {
    if (
      !Number.isFinite(config[key]) ||
      config[key] < 0 ||
      (key === 'distanceScaleKm' && !config[key])
    )
      throw new Error(`추천 설정을 확인해주세요: ${key}`);
  }
  config.size = Math.max(1, Math.min(8, Math.floor(config.size) || 8));
  config.seedCount = Math.max(1, Math.min(12, Math.floor(config.seedCount) || 1));
  config.swapPasses = Math.max(0, Math.min(3, Math.floor(config.swapPasses) || 0));
  return { ...config, weights };
}
