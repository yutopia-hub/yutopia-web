/**
 * AI 추천 코스의 방문 순서 최적화 — TSP(외판원 문제) + 비트마스킹 DP
 *
 * 문제
 *   장소 n개를 한 번씩 모두 들르는 경로 중 총 이동 거리가 가장 짧은 순서를 찾는다.
 *   거리는 카카오모빌리티 길찾기로 구한 "실제 도로 거리" 행렬을 쓴다 (실패하면 직선거리×1.3 추정).
 *   일방통행 때문에 dist[i][j] ≠ dist[j][i] 일 수 있는데(비대칭 TSP), 아래 DP 는 방향을
 *   그대로 따르므로 비대칭 행렬에서도 정확한 최적해를 준다.
 *   여행 코스는 출발지로 돌아올 필요가 없으므로 "열린 경로(open path)" TSP 이다.
 *   (start / end 를 지정하면 출발지·도착지를 고정한 경로를 찾는다. 예: 숙소를 마지막으로)
 *
 * 상태 정의
 *   dp[mask][i] = mask 에 포함된 장소들을 모두 방문했고, 지금 i 에 있을 때의 최소 이동 거리
 *     - mask: n비트 정수. k번째 비트가 1이면 장소 k 를 이미 방문했다는 뜻
 *     - i   : 마지막으로 방문한 장소 (항상 mask 안에 있어야 함)
 *
 * 초기값
 *   dp[1 << s][s] = 0      (s = 출발 가능한 장소. start 가 정해져 있으면 그 하나만)
 *
 * 점화식 (i 에서 아직 안 간 j 로 이동)
 *   dp[mask | (1 << j)][j] = min( dp[mask | (1 << j)][j],  dp[mask][i] + dist[i][j] )
 *
 * 정답
 *   min over i ( dp[FULL][i] )   (FULL = (1 << n) - 1, end 가 정해져 있으면 dp[FULL][end])
 *   parent[mask][i] 에 직전 장소를 기록해 두었다가 거꾸로 따라가며 순서를 복원한다.
 *
 * 복잡도
 *   시간 O(2^n · n^2), 공간 O(2^n · n).  n ≤ 12 정도면 브라우저에서 즉시 끝난다.
 *   (완전탐색 n! 과 비교: n = 10 → 3,628,800 vs 102,400)
 */

export const MAX_TSP_NODES = 12;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

/** 두 좌표 사이의 직선(대권) 거리, km. 하버사인 공식 */
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// 실제 길은 직선보다 돌아가므로 보정 계수를 곱한다 (도심 도로망 평균 약 1.3배)
const ROAD_FACTOR = 1.3;

/** n×n 거리 행렬 (km, 도로 보정 포함) */
export function buildDistanceMatrix(points) {
  return points.map((a) => points.map((b) => (a === b ? 0 : haversineKm(a, b) * ROAD_FACTOR)));
}

/**
 * 비트마스킹 DP 로 최단 방문 순서를 구한다.
 * @param {number[][]} dist  n×n 거리 행렬
 * @param {{ start?: number, end?: number }} [options]  고정할 출발/도착 인덱스
 * @returns {{ order: number[], distance: number }}  방문 순서(인덱스)와 총 거리
 */
export function solveTsp(dist, { start, end } = {}) {
  const n = dist.length;
  if (n === 0) return { order: [], distance: 0 };
  if (n === 1) return { order: [0], distance: 0 };
  if (n > MAX_TSP_NODES) throw new Error(`장소는 최대 ${MAX_TSP_NODES}곳까지 계산할 수 있어요.`);

  const FULL = (1 << n) - 1;
  const size = 1 << n;
  // 2차원 배열 대신 1차원 Float64Array 로 [mask * n + i] 를 써서 메모리와 속도를 아낀다
  const dp = new Float64Array(size * n).fill(Infinity);
  const parent = new Int8Array(size * n).fill(-1);

  // 초기값: 출발 가능한 장소에서 시작
  for (let s = 0; s < n; s++) {
    if (start !== undefined && s !== start) continue;
    if (end !== undefined && s === end && n > 1) continue; // 도착지로 출발할 수는 없다
    dp[(1 << s) * n + s] = 0;
  }

  // mask 를 작은 수부터 키워가면, 부분집합(더 작은 mask)은 항상 먼저 계산돼 있다
  for (let mask = 1; mask < size; mask++) {
    for (let i = 0; i < n; i++) {
      const cur = dp[mask * n + i];
      if (cur === Infinity || !(mask & (1 << i))) continue;

      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue; // 이미 방문
        const nextMask = mask | (1 << j);
        // 도착지는 마지막에만 들어갈 수 있다
        if (end !== undefined && j === end && nextMask !== FULL) continue;
        const candidate = cur + dist[i][j];
        const nextIndex = nextMask * n + j;
        if (candidate < dp[nextIndex]) {
          dp[nextIndex] = candidate;
          parent[nextIndex] = i;
        }
      }
    }
  }

  // 정답: 모든 장소를 방문한 상태 중 최솟값
  let last = -1;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    if (end !== undefined && i !== end) continue;
    if (dp[FULL * n + i] < best) {
      best = dp[FULL * n + i];
      last = i;
    }
  }
  if (last === -1) throw new Error('조건을 만족하는 경로가 없어요.');

  // 경로 복원: parent 를 따라 거꾸로 올라간다
  const order = [];
  let mask = FULL;
  let node = last;
  while (node !== -1) {
    order.push(node);
    const prev = parent[mask * n + node];
    mask &= ~(1 << node);
    node = prev;
  }
  order.reverse();

  return { order, distance: best };
}

/* ---------- 이동 시간 추정 ---------- */

const WALK_KMH = 4.5;
const TRANSIT_KMH = 18;
const TRANSIT_WAIT_MIN = 6;
const TAXI_KMH = 30;
export const WALK_LIMIT_KM = 1.2;

export const walkMinutes = (km) => Math.max(1, Math.round((km / WALK_KMH) * 60));
export const transitMinutes = (km) => Math.round((km / TRANSIT_KMH) * 60 + TRANSIT_WAIT_MIN);
const taxiMinutesEstimate = (km) => Math.max(1, Math.round((km / TAXI_KMH) * 60 + 2));

/**
 * 구간 거리(km) → 이동 수단과 예상 분. walkLimitKm 이하는 도보, 그 이상은 대중교통.
 * walkLimitKm 는 날씨에 따라 줄어든다(비·눈·폭염이면 걷는 한계를 낮춤, weatherPolicy.js).
 */
export function estimateLeg(km, walkLimitKm = WALK_LIMIT_KM) {
  if (km <= walkLimitKm) return { mode: 'walk', minutes: walkMinutes(km) };
  return { mode: 'transit', minutes: transitMinutes(km) };
}

/**
 * 실제 도로 구간. 카카오 길찾기는 자동차 경로만 주므로 이동 수단은 이렇게 정한다.
 *   - walkLimitKm 이하: 도보
 *   - 그보다 멀면: 대중교통(도로 거리로 추정한 시간)이 기본, 택시는 길찾기가 준 실제 소요 시간/요금
 */
export function roadLeg(km, taxiMinutes, taxiFare = null, walkLimitKm = WALK_LIMIT_KM) {
  if (km <= walkLimitKm) return estimateLeg(km, walkLimitKm);
  return {
    mode: 'transit',
    minutes: transitMinutes(km),
    taxiMinutes: Math.max(1, Math.round(taxiMinutes)),
    taxiFare: taxiFare === null ? null : Math.round(taxiFare / 100) * 100,
  };
}

/**
 * 직선거리 행렬에 실제 도로 행렬을 덮어쓴다. 길찾기에 실패한 칸(null)은 직선거리 추정치를 그대로 둔다.
 * @param {{ meters: (number|null)[][], seconds: (number|null)[][] }} road
 */
export function mergeRoadMatrix(points, road) {
  const km = buildDistanceMatrix(points);
  // minutes[i][j] = i → j 를 택시(자동차)로 갈 때의 분. 도로 정보가 없는 칸은 추정치
  const minutes = km.map((row) => row.map((d) => taxiMinutesEstimate(d)));
  road.meters.forEach((row, i) =>
    row.forEach((m, j) => {
      if (m === null || i === j) return;
      km[i][j] = m / 1000;
      minutes[i][j] = road.seconds[i][j] / 60;
    }),
  );
  return { km, minutes };
}

/**
 * 장소 목록을 최적 순서로 정렬하고, 구간별 거리·이동 시간과 총 소요 시간을 계산한다.
 * @param {Array<{lat:number,lng:number,stayMinutes?:number}>} places
 * @param {{ endIndex?: number, road?: { km: number[][], minutes: number[][] }, walkLimitKm?: number }} [options]
 *   endIndex   : 마지막에 고정할 장소(예: 숙소)
 *   road       : 카카오 길찾기로 구한 실제 도로 거리/시간 행렬. 있으면 TSP 를 도로 거리로 푼다
 *   walkLimitKm: 이 거리 이하만 도보로 본다 (날씨 정책이 정함)
 */
export function planCourse(places, { endIndex, road, walkLimitKm = WALK_LIMIT_KM } = {}) {
  const dist = road ? road.km : buildDistanceMatrix(places);
  const { order, distance } = solveTsp(dist, { end: endIndex });

  const stops = order.map((index) => places[index]);
  const legs = [];
  for (let k = 0; k < order.length - 1; k++) {
    const [i, j] = [order[k], order[k + 1]];
    const km = dist[i][j];
    legs.push({
      from: k,
      to: k + 1,
      km,
      ...(road ? roadLeg(km, road.minutes[i][j], null, walkLimitKm) : estimateLeg(km, walkLimitKm)),
    });
  }

  const moveMinutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const stayMinutes = stops.reduce((sum, stop) => sum + (stop.stayMinutes ?? 0), 0);
  return {
    stops,
    legs,
    walkLimitKm,
    distanceSource: road ? 'road' : 'estimate',
    totalKm: distance,
    moveMinutes,
    stayMinutes,
    totalMinutes: moveMinutes + stayMinutes,
  };
}

/** "경복궁 ↓ 2.1km 광장시장 ..." 형태의 텍스트 (콘솔/디버그 출력용) */
export function formatCourse({ stops, legs }) {
  const lines = [];
  stops.forEach((stop, k) => {
    lines.push(stop.title);
    if (legs[k]) lines.push(` ↓ ${legs[k].km.toFixed(1)}km`);
  });
  return lines.join('\n');
}
