function coordinate(value, limit) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function normalizeCandidates(items = []) {
  const unique = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id ?? item.contentid ?? '').trim();
    const title = String(item.title ?? item.name ?? item.n ?? '').trim();
    if (!id || !title || unique.has(id)) continue;
    const tags = Array.isArray(item.tags)
      ? [
          ...new Set(
            item.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()),
          ),
        ].sort()
      : [];
    unique.set(id, {
      id,
      title,
      category: String(
        item.cat2 ||
          item.cat1 ||
          item.category ||
          item.c ||
          item.contentTypeId ||
          item.typeName ||
          '',
      ),
      subtype: String(item.cat3 || item.subtype || ''),
      region: String(
        item.areaCode ||
          item.region ||
          item.r ||
          String(item.address || '')
            .trim()
            .split(/\s+/)[0] ||
          '',
      ),
      tags,
      lat: coordinate(item.lat ?? item.mapy, 90),
      lng: coordinate(item.lng ?? item.mapx, 180),
      setting: ['indoor', 'outdoor'].includes(item.setting) ? item.setting : null,
      airConditioned: item.airConditioned === true,
    });
  }
  return [...unique.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
