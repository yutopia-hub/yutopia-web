import { performance } from 'node:perf_hooks';
import { recommendPlaces } from '../src/algorithm/recommendation/recommendationEngine.js';

// Fixed fixture: interleaved Seoul/Jeju candidates, four categories, current board selections.
for (const count of [40, 200, 1000]) {
  const carrier = Array.from({ length: count }, (_, i) => ({
    id: String(i).padStart(4, '0'),
    title: `여행지 ${i}`,
    category: ['자연', '문화', '음식', '레저'][Math.floor(i / 2) % 4],
    lat: (i % 2 ? 33.4 : 37.5) + (i % 20) * 0.001,
    lng: (i % 2 ? 126.5 : 127) + (i % 17) * 0.001,
  }));
  const board = carrier.slice(0, 8);
  const start = performance.now();
  const result = recommendPlaces({ carrier, board });
  const elapsed = performance.now() - start;
  console.log(
    JSON.stringify({
      candidates: count,
      milliseconds: Number(elapsed.toFixed(1)),
      before: result.baselineMetrics,
      after: result.metrics,
      selected: result.recommendations.map((p) => p.id),
    }),
  );
}
