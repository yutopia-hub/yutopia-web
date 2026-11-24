import { mean } from './recommendationConfig.js';

export function similarity(a, b) {
  const signals = [];
  if (a.category && b.category) signals.push(a.category === b.category ? 0.7 : 0);
  if (a.subtype && b.subtype) signals.push(a.subtype === b.subtype ? 1 : 0);
  if (a.tags.length && b.tags.length) {
    const union = new Set([...a.tags, ...b.tags]);
    signals.push(a.tags.filter((t) => b.tags.includes(t)).length / union.size);
  }
  return signals.length ? Math.max(...signals) : null;
}

export function diversityScore(place, others, visitedIds) {
  const similarities = others.map((p) => similarity(place, p)).filter((s) => s !== null);
  // MMR: the most similar selected place determines the redundancy penalty.
  const novelty = similarities.length
    ? 100 * (1 - 0.7 * Math.max(...similarities) - 0.3 * mean(similarities))
    : 50;
  // Only an explicitly supplied real-world visit record can incur this penalty.
  return visitedIds.has(place.id) ? Math.max(0, novelty - 15) : novelty;
}

export function diversityMetrics(places) {
  const known = places.filter((p) => p.category);
  const categoryCounts = new Map();
  for (const { category } of known)
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  return {
    categoryCount: categoryCounts.size,
    categoryCoverage: known.length,
    categoryDiversity: mean(
      known.map((p) => 100 / categoryCounts.get(p.category)),
      50,
    ),
  };
}
