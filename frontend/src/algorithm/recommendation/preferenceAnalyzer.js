import { mean } from './recommendationConfig.js';

export function analyzePreferences(places, boardIds, config) {
  const features = ['category', 'region', 'tags'];
  const weights = [0.7, 0.2, 0.1];
  const counts = Object.fromEntries(features.map((f) => [f, new Map()]));
  const values = (p, f) => (f === 'tags' ? p.tags : p[f] ? [p[f]] : []);
  const weight = (p) => (boardIds.has(p.id) ? config.boardSignal : 1);
  const signalIds = new Set(places.map((p) => p.id));
  for (const p of places)
    for (const f of features)
      for (const v of values(p, f)) {
        counts[f].set(v, (counts[f].get(v) || 0) + weight(p));
      }
  // Leave the candidate's own signal out, including its board increment.
  return (p) => {
    const scores = features.map((f) => {
      const own = values(p, f);
      if (!own.length) return null;
      const adjusted = new Map(
        [...counts[f]].map(([v, n]) => [
          v,
          n - (signalIds.has(p.id) && own.includes(v) ? weight(p) : 0),
        ]),
      );
      const max = Math.max(0, ...adjusted.values());
      const support = mean(
        own.map((v) => adjusted.get(v) || 0),
        0,
      );
      return 50 + (50 * support) / (max + config.smoothing || 1);
    });
    const total = weights.reduce((sum, w, i) => sum + (scores[i] === null ? 0 : w), 0);
    return total ? scores.reduce((sum, s, i) => sum + (s ?? 0) * weights[i], 0) / total : 50;
  };
}
