import { getCurrentWeather } from './weatherApi.js';
import { hasCoordinates } from '../algorithm/recommendation/distanceCalculator.js';

// Exact-coordinate cache, bounded size and concurrent requests. No user's location is used.
export function createRecommendationWeatherLoader(
  fetchWeather = getCurrentWeather,
  now = Date.now,
) {
  const cache = new Map();
  return async function load(places, { signal } = {}) {
    signal?.throwIfAborted();
    const groups = new Map();
    for (const p of places) {
      if (!hasCoordinates(p) || !p.setting) continue;
      const key = `${p.lat},${p.lng}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const weatherById = {};
    let failed = 0;
    const entries = [...groups.entries()];
    const pending = entries.filter(([key, group]) => {
      const saved = cache.get(key);
      if (!saved || now() - saved.at >= 10 * 60 * 1000) return true;
      for (const p of group) weatherById[p.id] = saved.weather;
      return false;
    });
    const queue = pending.slice(0, 24);
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (cursor < queue.length) {
          signal?.throwIfAborted();
          const [key, group] = queue[cursor++];
          try {
            const p = group[0];
            const weather = await fetchWeather({ latitude: p.lat, longitude: p.lng }, { signal });
            signal?.throwIfAborted();
            cache.delete(key);
            cache.set(key, { weather, at: now() });
            if (cache.size > 256) cache.delete(cache.keys().next().value);
            for (const p of group) weatherById[p.id] = weather;
          } catch (error) {
            if (signal?.aborted) throw error;
            failed++;
          }
        }
      }),
    );
    return { weatherById, failed, skipped: Math.max(0, pending.length - queue.length) };
  };
}

export const getRecommendationWeather = createRecommendationWeatherLoader();
