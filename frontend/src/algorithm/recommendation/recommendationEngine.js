import { normalizeCandidates } from './normalizePlaces.js';
import { buildDistanceMatrix, distanceScore, distanceMetrics } from './distanceCalculator.js';
import { analyzePreferences } from './preferenceAnalyzer.js';
import { diversityScore, diversityMetrics } from './diversityOptimizer.js';
import { weatherSuitability, calculateScore } from './scoreCalculator.js';
import { resolveConfig, mean } from './recommendationConfig.js';

/** Pure, deterministic set optimization. Catalog candidates never become preference signals. */
export function recommendPlaces({
  carrier = [],
  candidates,
  board = [],
  weatherById = {},
  visitedIds = [],
  config: options = {},
} = {}) {
  const config = resolveConfig(options);
  const boardPlaces = normalizeCandidates(board);
  const boardIds = new Set(boardPlaces.map((p) => p.id));
  const bagIds = new Set(normalizeCandidates(carrier).map((p) => p.id));
  const profilePlaces = normalizeCandidates([...normalizeCandidates(carrier), ...boardPlaces]);
  const places = normalizeCandidates([...profilePlaces, ...normalizeCandidates(candidates)]);
  const boardOrder = new Map(
    (Array.isArray(board) ? board : [])
      .filter((p) => p?.id != null)
      .map((p, i) => [String(p.id), i]),
  );
  const visited = new Set(visitedIds.map(String));
  const matrix = buildDistanceMatrix(places);
  const preference = analyzePreferences(profilePlaces, boardIds, config);
  const fixed = places.map((p) => ({
    preference: preference(p),
    weather: weatherSuitability(p, weatherById[p.id]),
  }));
  const stable = (a, b) =>
    Number(boardIds.has(places[b].id)) - Number(boardIds.has(places[a].id)) ||
    (boardOrder.get(places[a].id) ?? Infinity) - (boardOrder.get(places[b].id) ?? Infinity) ||
    a - b;

  function evaluate(indices, details = false) {
    const rows = indices.map((i) => {
      const others = indices.filter((j) => j !== i);
      const scores = {
        distance: distanceScore(i, others, matrix, config.distanceScaleKm),
        preference: fixed[i].preference,
        weather: fixed[i].weather.score,
        diversity: diversityScore(
          places[i],
          others.map((j) => places[j]),
          visited,
        ),
      };
      const retained = boardIds.has(places[i].id);
      const scored = calculateScore(scores, retained, config);
      if (!details) return scored.score;
      const reasons = [];
      if (scores.preference > 55)
        reasons.push('이 장소를 제외한 보따리·기존 윷판의 유형·지역·태그 선호와 잘 맞아요.');
      if (others.some((j) => matrix[i][j] !== null) && scores.distance >= 70)
        reasons.push('다른 추천 여행지들과 직선거리가 비교적 가까워요.');
      if (others.length && scores.diversity >= 70)
        reasons.push('추천 조합의 유형·태그 다양성에 기여해요.');
      if (retained) reasons.push('기존 윷판에 배치한 여행지라 유지 보너스를 반영했어요.');
      if (visited.has(places[i].id)) reasons.push('실제 방문 기록이 있어 새로움 점수를 낮췄어요.');
      reasons.push(fixed[i].weather.reason);
      if (places[i].lat === null || places[i].lng === null)
        reasons.push('좌표가 없어 거리 점수를 중립으로 반영했어요.');
      return { ...places[i], ...scored, scores, retained, reasons };
    });
    return {
      indices,
      objective: mean(details ? rows.map((p) => p.score) : rows),
      retained: indices.filter((i) => boardIds.has(places[i].id)).length,
      rows: details ? rows : undefined,
    };
  }

  // Compare against the actual maximum first: tolerance never uses a non-transitive sort.
  function choose(states, tolerance) {
    let max = -Infinity;
    for (const state of states) max = Math.max(max, state.objective);
    let best = null;
    for (const state of states) {
      if (state.objective < max - tolerance - 1e-9) continue;
      if (
        !best ||
        state.retained > best.retained ||
        (state.retained === best.retained && state.objective > best.objective)
      ) {
        best = state;
      } else if (state.retained === best.retained && state.objective === best.objective) {
        const a = [...state.indices].sort(stable),
          b = [...best.indices].sort(stable);
        if (a.reduce((diff, i, n) => diff || stable(i, b[n]), 0) < 0) best = state;
      }
    }
    return best;
  }

  const target = Math.min(config.size, places.length);
  let selected = [];
  if (target) {
    const singles = places.map((_, i) => evaluate([i]));
    const seeds = [choose(singles, config.retentionTolerance).indices[0]];
    // Spread starting points across the distance matrix to escape a single greedy cluster.
    while (seeds.length < Math.min(config.seedCount, places.length)) {
      const available = places.map((_, i) => i).filter((i) => !seeds.includes(i));
      const spread = (i) => Math.min(...seeds.map((j) => matrix[i][j] ?? 0));
      let next = available[0];
      for (const i of available) {
        if (
          spread(i) > spread(next) ||
          (spread(i) === spread(next) &&
            (singles[i].objective > singles[next].objective ||
              (singles[i].objective === singles[next].objective && stable(i, next) < 0)))
        )
          next = i;
      }
      seeds.push(next);
    }
    const runs = seeds.map((seed) => {
      let indices = [seed];
      while (indices.length < target) {
        const states = places.flatMap((_, i) =>
          indices.includes(i) ? [] : [evaluate([...indices, i])],
        );
        // One replacement may spend at most tolerance points, measured per changed place.
        indices = choose(states, config.retentionTolerance / (indices.length + 1)).indices;
      }
      return evaluate(indices);
    });
    if (boardIds.size)
      runs.push(
        evaluate(
          places
            .map((p, i) => (boardIds.has(p.id) ? i : -1))
            .filter((i) => i >= 0)
            .slice(0, target),
        ),
      );
    // Only complete combinations compete; incomplete board seeds are excluded.
    let best = choose(
      runs.filter((s) => s.indices.length === target),
      config.retentionTolerance / target,
    );
    for (let pass = 0; pass < config.swapPasses; pass++) {
      const states = [best];
      for (let position = 0; position < target; position++)
        for (let i = 0; i < places.length; i++) {
          if (best.indices.includes(i)) continue;
          const next = [...best.indices];
          next[position] = i;
          states.push(evaluate(next));
        }
      const next = choose(states, config.retentionTolerance / target);
      if (next.objective <= best.objective + 1e-9 && next.retained <= best.retained) break;
      best = next;
    }
    selected = best.indices;
  }
  const result = evaluate(selected, true);
  function metricsFor(indices, rows, objective, retained) {
    return {
      ...distanceMetrics(indices, matrix),
      ...diversityMetrics(rows),
      preferenceScore: mean(rows.map((p) => p.scores.preference)),
      combinationScore: objective,
      retainedCount: retained,
      retentionRate: boardIds.size ? retained / boardIds.size : null,
      candidateCount: places.length,
    };
  }
  const baseline = evaluate(
    places.flatMap((p, i) => (boardIds.has(p.id) ? [i] : [])),
    true,
  );
  result.rows.sort(
    (a, b) =>
      b.score - a.score ||
      stable(
        places.findIndex((p) => p.id === a.id),
        places.findIndex((p) => p.id === b.id),
      ),
  );
  const warnings = [];
  const missingCount = config.size - target;
  if (missingCount)
    warnings.push(`추천 가능한 여행지가 ${missingCount}곳 부족해요. 현재 확인된 장소만 표시해요.`);
  if (candidates === undefined && boardPlaces.some((p) => !bagIds.has(p.id)))
    warnings.push('보따리에서 빠진 기존 윷판 여행지도 유지 후보로 포함했어요.');
  if (places.some((p) => !p.setting))
    warnings.push('실내·야외 정보가 없는 장소의 날씨 점수는 중립(50점)이에요.');
  return {
    recommendations: result.rows,
    missingCount,
    warnings,
    weights: config.weights,
    metrics: metricsFor(selected, result.rows, result.objective, result.retained),
    baselineMetrics: metricsFor(
      baseline.indices,
      baseline.rows,
      baseline.objective,
      baseline.retained,
    ),
  };
}
