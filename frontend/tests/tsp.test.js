import test from 'node:test';
import assert from 'node:assert/strict';
import {
  solveTsp,
  buildDistanceMatrix,
  haversineKm,
  estimateLeg,
  planCourse,
  formatCourse,
  mergeRoadMatrix,
  roadLeg,
} from '../src/algorithm/tsp.js';

// 정답 비교용 완전탐색: 모든 순열의 경로 길이를 구해 최솟값을 찾는다 (O(n!))
function bruteForce(dist, { start, end } = {}) {
  const n = dist.length;
  let best = Infinity;
  const used = Array(n).fill(false);
  const path = [];
  const dfs = (cost) => {
    if (cost >= best) return;
    if (path.length === n) {
      if (end === undefined || path[n - 1] === end) best = cost;
      return;
    }
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      if (path.length === 0 && start !== undefined && j !== start) continue;
      used[j] = true;
      path.push(j);
      dfs(cost + (path.length > 1 ? dist[path[path.length - 2]][j] : 0));
      path.pop();
      used[j] = false;
    }
  };
  dfs(0);
  return best;
}

const pathLength = (dist, order) =>
  order.slice(1).reduce((sum, node, k) => sum + dist[order[k]][node], 0);

// 시드 고정 난수로 매번 같은 테스트
function randomPoints(n, seed) {
  let x = seed;
  const rand = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, () => ({
    lat: 37.45 + rand() * 0.2,
    lng: 126.9 + rand() * 0.25,
  }));
}

test('하버사인: 서울시청 → 경복궁 약 1.6km', () => {
  const km = haversineKm({ lat: 37.5663, lng: 126.9779 }, { lat: 37.5796, lng: 126.977 });
  assert.ok(km > 1.4 && km < 1.6, `got ${km}`);
});

test('TSP 결과가 완전탐색 최솟값과 같다 (n = 2..8, 여러 시드)', () => {
  for (let n = 2; n <= 8; n++) {
    for (let seed = 1; seed <= 5; seed++) {
      const dist = buildDistanceMatrix(randomPoints(n, seed * 31 + n));
      const { order, distance } = solveTsp(dist);
      assert.equal(order.length, n);
      assert.equal(new Set(order).size, n, '모든 장소를 한 번씩 방문');
      assert.ok(Math.abs(pathLength(dist, order) - distance) < 1e-9, '복원 경로와 거리 일치');
      assert.ok(Math.abs(distance - bruteForce(dist)) < 1e-9, `n=${n} seed=${seed}`);
    }
  }
});

test('도착지(end) 고정: 숙소가 항상 마지막이고 그 조건에서 최적', () => {
  for (let n = 3; n <= 7; n++) {
    const dist = buildDistanceMatrix(randomPoints(n, n * 7));
    const end = n - 1;
    const { order, distance } = solveTsp(dist, { end });
    assert.equal(order[order.length - 1], end);
    assert.ok(Math.abs(distance - bruteForce(dist, { end })) < 1e-9);
  }
});

test('출발지(start) 고정', () => {
  const dist = buildDistanceMatrix(randomPoints(6, 99));
  const { order, distance } = solveTsp(dist, { start: 2 });
  assert.equal(order[0], 2);
  assert.ok(Math.abs(distance - bruteForce(dist, { start: 2 })) < 1e-9);
});

test('일직선 위의 점은 끝에서 끝으로 순서대로 방문', () => {
  // 0, 3, 1, 2 위치 (1차원) → 최적: 0-1-2-3 또는 그 역순, 거리 3
  const xs = [0, 3, 1, 2];
  const dist = xs.map((a) => xs.map((b) => Math.abs(a - b)));
  const { order, distance } = solveTsp(dist);
  assert.equal(distance, 3);
  assert.deepEqual(
    order.map((i) => xs[i]),
    order[0] === 0 ? [0, 1, 2, 3] : [3, 2, 1, 0],
  );
});

test('비대칭 행렬(일방통행)에서도 완전탐색과 같은 최적해', () => {
  for (let n = 3; n <= 7; n++) {
    const sym = buildDistanceMatrix(randomPoints(n, n * 13));
    // i→j 와 j→i 를 다르게 만든다
    const dist = sym.map((row, i) => row.map((d, j) => (i < j ? d * 1.7 : d)));
    const { distance } = solveTsp(dist);
    assert.ok(Math.abs(distance - bruteForce(dist)) < 1e-9, `n=${n}`);
  }
});

test('도로 행렬: 실패 칸(null)은 직선 추정으로 채우고, 가까운 구간은 도보·먼 구간은 차량 시간', () => {
  const points = randomPoints(3, 5);
  const road = mergeRoadMatrix(points, {
    meters: [
      [0, 800, null],
      [900, 0, 3000],
      [5000, 3100, 0],
    ],
    seconds: [
      [0, 200, null],
      [220, 0, 540],
      [700, 560, 0],
    ],
  });
  assert.equal(road.km[0][1], 0.8);
  assert.ok(road.km[0][2] > 0, 'null 칸은 직선 추정치');
  const course = planCourse(points, { road });
  assert.equal(course.distanceSource, 'road');
  course.legs.forEach((leg) => {
    assert.equal(leg.mode, leg.km <= 1.2 ? 'walk' : 'transit');
    assert.notEqual(leg.mode, 'drive');
  });
  // 먼 구간: 대중교통 시간은 거리 추정(3km → 3/18h + 대기 6분 = 16분), 택시는 길찾기 값과 요금(100원 단위)
  assert.deepEqual(roadLeg(3, 9, 8460), {
    mode: 'transit',
    minutes: 16,
    taxiMinutes: 9,
    taxiFare: 8500,
  });
  assert.equal(roadLeg(0.8, 4).mode, 'walk');
});

test('경계: 0개, 1개, 너무 많은 장소', () => {
  assert.deepEqual(solveTsp([]), { order: [], distance: 0 });
  assert.deepEqual(solveTsp([[0]]), { order: [0], distance: 0 });
  const many = Array.from({ length: 13 }, () => Array(13).fill(1));
  assert.throws(() => solveTsp(many));
});

test('이동 시간: 1.2km 이하는 도보, 그 이상은 대중교통', () => {
  assert.equal(estimateLeg(0.9).mode, 'walk');
  assert.equal(estimateLeg(0.9).minutes, 12);
  assert.equal(estimateLeg(5).mode, 'transit');
  assert.equal(estimateLeg(5).minutes, 23);
});

test('planCourse: 서울 명소 5곳 → 구간·총 시간과 "↓ km" 출력', () => {
  const places = [
    { title: '남산타워', lat: 37.5512, lng: 126.9882, stayMinutes: 60 },
    { title: '경복궁', lat: 37.5796, lng: 126.977, stayMinutes: 90 },
    { title: '서울숲', lat: 37.5444, lng: 127.0374, stayMinutes: 60 },
    { title: '광장시장', lat: 37.57, lng: 126.9996, stayMinutes: 60 },
    { title: 'DDP', lat: 37.5665, lng: 127.0092, stayMinutes: 40 },
  ];
  const course = planCourse(places);
  assert.equal(course.stops.length, 5);
  assert.equal(course.legs.length, 4);
  assert.equal(course.stayMinutes, 310);
  assert.equal(course.totalMinutes, course.moveMinutes + course.stayMinutes);
  const text = formatCourse(course);
  assert.match(text, /↓ \d+\.\dkm/);
  console.log(`\n${text}\n총 ${course.totalKm.toFixed(1)}km, 예상 ${course.totalMinutes}분`);
});
