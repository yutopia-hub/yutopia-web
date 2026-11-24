// 서버(/api/kakao-route)를 거쳐 카카오모빌리티 길찾기를 부른다. REST 키는 브라우저로 오지 않는다.

async function post(action, points) {
  const response = await fetch('/api/kakao-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, points: points.map(({ lat, lng }) => ({ lat, lng })) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `길찾기 서버 오류 (${response.status})`);
  return data;
}

/** 장소들 사이 실제 도로 거리/시간 행렬 { meters, seconds } (실패 칸은 null) */
export const fetchRoadMatrix = (points) => post('matrix', points);

/** 순서대로 경유하는 실제 도로 경로. sections[k] = k → k+1 구간 { meters, seconds, path:[[lat,lng]...] } */
export const fetchRoadPath = (points) => post('path', points);
