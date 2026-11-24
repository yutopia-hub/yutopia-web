import { mean } from './recommendationConfig.js';

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const hasCoordinates = (p) =>
  Number.isFinite(p?.lat) &&
  Math.abs(p.lat) <= 90 &&
  Number.isFinite(p?.lng) &&
  Math.abs(p.lng) <= 180;

export function haversine(a, b) {
  if (!hasCoordinates(a) || !hasCoordinates(b)) return null;
  const h =
    Math.sin(toRadians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(toRadians(b.lng - a.lng) / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

export function buildDistanceMatrix(places) {
  const matrix = places.map(() => Array(places.length).fill(null));
  for (let i = 0; i < places.length; i++) {
    matrix[i][i] = 0;
    for (let j = i + 1; j < places.length; j++)
      matrix[i][j] = matrix[j][i] = haversine(places[i], places[j]);
  }
  return matrix;
}

export function distanceScore(index, others, matrix, scale) {
  // Missing pairs receive neutral scores; do not turn missing coordinates into zero distance.
  const distances = others.map((j) => matrix[index][j]);
  const known = distances.filter((v) => v !== null);
  const scores = distances.map((d) => (d === null ? 50 : 100 / (1 + d / scale)));
  const farthest = known.length ? 100 / (1 + Math.max(...known) / scale) : 50;
  return (
    0.75 * mean(scores) +
    0.25 *
      (known.length
        ? (farthest * known.length) / Math.max(1, others.length) +
          50 * (1 - known.length / Math.max(1, others.length))
        : 50)
  );
}

export function distanceMetrics(indices, matrix) {
  const pairs = [];
  for (let a = 0; a < indices.length; a++)
    for (let b = a + 1; b < indices.length; b++) {
      const d = matrix[indices[a]][indices[b]];
      if (d !== null) pairs.push(d);
    }
  return {
    averageDistanceKm: mean(pairs, null),
    knownPairs: pairs.length,
    totalPairs: (indices.length * (indices.length - 1)) / 2,
  };
}
