import { getFavoritePlaces } from '../../api/favoriteApi.js';

export function normalizePlaces(items) {
  const places = items.map((p) => ({
    ...p,
    id: String(p.id ?? ''),
    n: String(p.name ?? p.n ?? ''),
    r: String(p.region ?? p.r ?? ''),
    c: String(p.category ?? p.c ?? ''),
    imageUrl: String(p.imageUrl ?? ''),
    e: String(p.emoji ?? p.e ?? '📍'),
    col: /^#[\da-f]{6}$/i.test(p.color ?? p.col ?? '') ? (p.color ?? p.col) : '#f3c9a0',
  }));
  return places.filter((p, i) => p.id && p.n && places.findIndex((q) => q.id === p.id) === i);
}

export async function loadPlaces() {
  return normalizePlaces(await getFavoritePlaces());
}
