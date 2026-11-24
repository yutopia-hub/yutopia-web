// TSP 알고리즘 성능 비교: 완전탐색(순열) vs 비트마스킹 DP vs 최근접 이웃(탐욕)
// 실행: node scripts/benchmark-tsp.js
import { solveTsp, buildDistanceMatrix } from '../src/algorithm/tsp.js';

let seed = 20261015;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const randomPoints = (n) =>
  Array.from({ length: n }, () => ({ lat: 37.45 + rand() * 0.2, lng: 126.9 + rand() * 0.25 }));

// 완전탐색: 모든 방문 순서를 시도 (가지치기 없음) — O(n!)
function bruteForce(dist) {
  const n = dist.length;
  const perm = [...Array(n).keys()];
  let best = Infinity;
  let visited = 0;
  const permute = (k) => {
    if (k === n) {
      visited++;
      let sum = 0;
      for (let i = 1; i < n; i++) sum += dist[perm[i - 1]][perm[i]];
      if (sum < best) best = sum;
      return;
    }
    for (let i = k; i < n; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  permute(0);
  return { distance: best, visited };
}

// 최근접 이웃(탐욕): 지금 있는 곳에서 가장 가까운 안 간 곳으로 — O(n²), 최적 보장 없음
function nearestNeighbor(dist, start) {
  const n = dist.length;
  const seen = Array(n).fill(false);
  let cur = start;
  seen[cur] = true;
  let total = 0;
  for (let step = 1; step < n; step++) {
    let next = -1;
    for (let j = 0; j < n; j++)
      if (!seen[j] && (next === -1 || dist[cur][j] < dist[cur][next])) next = j;
    total += dist[cur][next];
    seen[next] = true;
    cur = next;
  }
  return total;
}
// 시작점을 바꿔 가며 n 번 돌려 가장 좋은 결과 (NN 에게 유리한 조건)
const bestNearestNeighbor = (dist) => Math.min(...dist.map((_, s) => nearestNeighbor(dist, s)));

const ms = (fn) => {
  const t = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t };
};

console.log('## 1. 시간 비교 (장소 수 n, 같은 입력)');
console.log('| n | 완전탐색 | 비트마스킹 DP | DP 상태 수(2^n·n) | DP 메모리 |');
console.log('| ---: | ---: | ---: | ---: | ---: |');
for (const n of [6, 8, 9, 10, 11, 12]) {
  const dist = buildDistanceMatrix(randomPoints(n));
  const dp = ms(() => solveTsp(dist));
  let brute = '-';
  if (n <= 10) {
    const b = ms(() => bruteForce(dist));
    if (Math.abs(b.result.distance - dp.result.distance) > 1e-9) throw new Error('결과 불일치!');
    brute = `${b.ms.toFixed(1)}ms (${b.result.visited.toLocaleString()}개 순열)`;
  }
  const states = (1 << n) * n;
  const kb = ((states * 8 + states) / 1024).toFixed(0); // Float64Array(8B) + Int8Array(1B)
  console.log(`| ${n} | ${brute} | ${dp.ms.toFixed(1)}ms | ${states.toLocaleString()} | ${kb}KB |`);
}

console.log('\n## 2. 정확도: 최근접 이웃(탐욕)은 최적에서 얼마나 벗어나나 (n=8, 300회)');
let worst = 0;
let sumGap = 0;
let notOptimal = 0;
let dpMatches = 0;
const TRIALS = 300;
for (let t = 0; t < TRIALS; t++) {
  const dist = buildDistanceMatrix(randomPoints(8));
  const opt = solveTsp(dist).distance;
  // DP 가 완전탐색과 같은 값인지 매번 직접 확인한다
  if (Math.abs(opt - bruteForce(dist).distance) < 1e-9) dpMatches++;
  const greedy = bestNearestNeighbor(dist);
  const gap = (greedy / opt - 1) * 100;
  sumGap += gap;
  worst = Math.max(worst, gap);
  if (gap > 1e-9) notOptimal++;
}
console.log(
  `- 탐욕이 최적이 아니었던 경우: ${notOptimal}/${TRIALS}회 (${((notOptimal / TRIALS) * 100).toFixed(0)}%)`,
);
console.log(`- 평균 오차: +${(sumGap / TRIALS).toFixed(1)}% , 최악 오차: +${worst.toFixed(1)}%`);
console.log(`- 비트마스킹 DP 가 완전탐색과 같은 최적값을 낸 경우: ${dpMatches}/${TRIALS}회`);
