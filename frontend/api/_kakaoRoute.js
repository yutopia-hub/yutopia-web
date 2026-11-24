// 카카오모빌리티 길찾기 API (REST 키는 서버에서만 사용)
//   - matrix: 장소들 사이의 실제 도로 거리/시간 n×n 행렬 → TSP 입력
//   - path  : 정해진 순서의 구간별 길찾기 → 지도에 그릴 실제 도로 좌표 + 택시 요금
import { httpError } from './_http.js';

const BASE = 'https://apis-navi.kakaomobility.com/v1';
const MAX_POINTS = 12;

async function call(path, apiKey, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `KakaoAK ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw httpError(502, `카카오 길찾기 요청 실패 (${response.status})`);
  return response.json();
}

function checkPoints(points, min) {
  if (!Array.isArray(points) || points.length < min || points.length > MAX_POINTS) {
    throw httpError(400, `points 는 ${min}~${MAX_POINTS}개여야 합니다.`);
  }
  points.forEach((p) => {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng))
      throw httpError(400, '좌표가 잘못됐습니다.');
  });
}

const xy = (p) => ({ x: String(p.lng), y: String(p.lat) });

/**
 * 다중 출발지 길찾기를 목적지마다 한 번씩(n번) 호출해서 행렬을 채운다.
 * 일방통행 등으로 i→j 와 j→i 가 다를 수 있다(비대칭 행렬). 실패한 칸은 null.
 * @returns {{ meters: (number|null)[][], seconds: (number|null)[][] }}
 */
export async function roadMatrix(points, apiKey) {
  checkPoints(points, 2);
  const n = points.length;
  const meters = points.map(() => Array(n).fill(null));
  const seconds = points.map(() => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    meters[i][i] = 0;
    seconds[i][i] = 0;
  }

  await Promise.all(
    points.map(async (destination, j) => {
      const origins = points
        .map((p, i) => ({ ...xy(p), key: String(i) }))
        .filter((_, i) => i !== j);
      const data = await call('/origins/directions', apiKey, {
        origins,
        destination: xy(destination),
        radius: 10000,
      });
      (data.routes ?? []).forEach((route) => {
        const i = Number(route.key);
        if (route.result_code === 0) {
          meters[i][j] = route.summary.distance;
          seconds[i][j] = route.summary.duration;
        } else if (route.result_code === 104) {
          // 출발지와 도착지가 5m 이내: 사실상 같은 곳
          meters[i][j] = 0;
          seconds[i][j] = 0;
        }
      });
    }),
  );
  return { meters, seconds };
}

/**
 * 순서가 정해진 장소들을 구간(k → k+1)마다 길찾기해서 실제 도로 좌표와 택시 요금을 받는다.
 * 요금(fare.taxi)은 경로 전체 값만 오기 때문에, 구간별 요금을 얻으려고 구간마다 따로 호출한다.
 * @returns {{ sections: { meters: number, seconds: number, taxiFare: number|null, path: [number, number][] }[] }}
 */
export async function routePath(points, apiKey) {
  checkPoints(points, 2);
  const sections = await Promise.all(
    points.slice(0, -1).map(async (origin, k) => {
      const data = await call('/waypoints/directions', apiKey, {
        origin: xy(origin),
        destination: xy(points[k + 1]),
        priority: 'RECOMMEND',
      });
      const route = data.routes?.[0];
      if (!route || route.result_code !== 0) {
        throw httpError(502, route?.result_msg || '경로를 찾지 못했습니다.');
      }
      const path = [];
      route.sections.forEach((section) =>
        section.roads.forEach((road) => {
          // vertexes = [x1, y1, x2, y2, ...] (경도, 위도 순서)
          for (let i = 0; i < road.vertexes.length; i += 2) {
            path.push([road.vertexes[i + 1], road.vertexes[i]]);
          }
        }),
      );
      return {
        meters: route.summary.distance,
        seconds: route.summary.duration,
        taxiFare: route.summary.fare?.taxi ?? null,
        path,
      };
    }),
  );
  return { sections };
}

export async function handleRouteBody(body, apiKey) {
  if (!apiKey) throw httpError(503, 'KAKAO_REST_API_KEY 가 설정되지 않았습니다.');
  if (body?.action === 'matrix') return roadMatrix(body.points, apiKey);
  if (body?.action === 'path') return routePath(body.points, apiKey);
  throw httpError(400, "action 은 'matrix' 또는 'path' 여야 합니다.");
}
