// Bound browser work while including every available region, rather than a single search term.
export function createRecommendationCatalogLoader({ getAreas, listPlaces, now = Date.now }) {
  let cached = null;
  return async function load({ signal } = {}) {
    signal?.throwIfAborted();
    if (cached && now() - cached.at < 10 * 60 * 1000) return cached.value;
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000);
    const areas = await getAreas({ signal: requestSignal });
    const results = Array(areas.length);
    let cursor = 0;
    let failedAreas = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, areas.length) }, async () => {
        while (cursor < areas.length) {
          signal?.throwIfAborted();
          const i = cursor++;
          try {
            const areaSignal = signal
              ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000);
            results[i] = await listPlaces({
              areaCode: areas[i].code,
              numOfRows: 24,
              pageNo: 1,
              signal: areaSignal,
            });
          } catch (error) {
            if (signal?.aborted) throw error;
            failedAreas++;
            results[i] = [];
          }
        }
      }),
    );
    signal?.throwIfAborted();
    const places = [
      ...new Map(
        results
          .flat()
          .filter((p) => p?.id && p.title)
          .map((p) => [String(p.id), p]),
      ).values(),
    ];
    if (!places.length)
      throw new Error('전국 여행지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    const value = { places, failedAreas };
    // Partial failures can be retried immediately; successful catalogs are cached for ten minutes.
    if (!failedAreas) cached = { value, at: now() };
    return value;
  };
}
