const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY ?? '';

let loaderPromise = null;

export function hasKakaoKey() {
  return Boolean(KAKAO_MAP_KEY);
}

// SDK를 페이지마다 script 태그로 넣지 않고 한 번만 동적으로 로드한다.
// 동적 로드 시 autoload=false + kakao.maps.load()를 써야 정상 초기화된다.
export function loadKakaoMap() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_MAP_KEY)}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => {
      loaderPromise = null;
      script.remove();
      reject(
        new Error('카카오맵을 불러오지 못했습니다. 앱 키와 플랫폼(도메인) 등록을 확인하세요.'),
      );
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

// 카카오맵은 생성 시점의 컨테이너 크기로만 그려진다. 창 크기 변경 등으로 컨테이너가 바뀌면
// relayout()을 해줘야 지도가 일부만 그려지는 문제가 안 생긴다.
// 컨테이너가 화면에서 빠지면(크기 0으로 알림이 옴) 스스로 관찰을 끝낸다.
export function keepMapFitted(map, container) {
  const { kakao } = window;
  let size = { width: container.clientWidth, height: container.clientHeight };

  const observer = new ResizeObserver(() => {
    if (!container.isConnected) {
      observer.disconnect();
      return;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || (width === size.width && height === size.height)) return;

    // 크기가 바뀌어도 카카오맵은 왼쪽 위를 기준으로 그대로 있고, 이때 getCenter()/idle 값은
    // 이미 틀어진 값이 나온다. 그래서 "예전 크기의 정중앙 픽셀"에 있던 좌표를 직접 구해서 다시 맞춘다.
    const previousCenter = map
      .getProjection()
      .coordsFromContainerPoint(new kakao.maps.Point(size.width / 2, size.height / 2));
    size = { width, height };
    map.relayout();
    map.setCenter(previousCenter);
  });
  observer.observe(container);
}
