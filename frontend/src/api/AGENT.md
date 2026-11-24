# api/

외부/서버 통신을 전부 여기로 모은다. `pages/`, `components/`에서 직접 `fetch`를 호출하지 않는다.

## 파일 구성

- `http.js` : 공통 fetch 래퍼 (서비스키 쿼리 부착, `baseUrl` 옵션, 게이트웨이 에러 처리). `HAS_BACKEND`, `ApiError(status)` 제공
- `authApi.js` / `memberApi.js` : 로그인·회원가입·재설정 / 내 정보 — `HAS_BACKEND`면 Spring `/api/auth`, `/api/members/me`
- `carrierSyncApi.js` : 보따리(carrierStore) ↔ 백엔드 찜 동기화. `main.js`에서 `startCarrierSync()` 1회 호출
- `tourApi.js` : 여행지 — 출처 `TOUR_SOURCE` = mock | tourapi(TourAPI KorService2) | backend(`/api/places`)
- `mock/` : 백엔드·키 없이 동작하는 목업 (`mockMembers`, `mockTour`, `mockWeather`, `mockFavorites` …)
- `tourFields.js` : TourAPI 원본 필드 → 화면용 라벨 매핑, 이미지 저작권(1·3유형) 필터, HTML 태그 제거
- `mock/mockTour.js` : TourAPI 목업 (실제 응답 필드명을 그대로 흉내 내서 매핑 로직까지 같이 검증)
- `weatherApi.js` / `mock/mockWeather.js` : 기상청 단기예보 → 현재 날씨 요약
- `kakaoMap.js` : 카카오맵 SDK 1회 동적 로드 (`autoload=false` 필수)

## 규칙

- 각 `*Api.js` 함수는 `USE_MOCK` 분기를 유지한다. 목업 분기를 지우는 건 실제 엔드포인트 연동이 끝난 뒤에만.
- 실제 엔드포인트/키가 아직 없는 리소스는 `VITE_USE_MOCK` 값과 무관하게 항상 목업으로 동작해야 한다 (`http.js`의 `HAS_BACKEND`, `tourApi.js`/`weatherApi.js`의 `hasServiceKey()` 패턴 참고). `VITE_USE_MOCK=false`로 바꿔도 아직 준비 안 된 API가 깨지면 안 된다.
- 실제 공공데이터포털 응답 필드명이 확정되면, 매핑(snake_case -> camelCase 등)은 `*Api.js` 안에서 끝내고 페이지/컴포넌트에는 정규화된 필드만 넘긴다.
- 백엔드 응답 필드는 프론트 정규화 형태와 같게 맞춰져 있다(backend/README.md의 REST API 참고). 계약을 바꾸면 양쪽을 같이 고친다.
- 에러는 `throw new Error(message)`로 던지고, 화면에서 try/catch로 받아 사용자 메시지를 보여준다 (`BoardPage.js` 참고).
- 새 리소스를 추가할 때는 기존 파일에 함수를 늘리기보다, 리소스 단위로 새 `*Api.js` 파일을 만든다 (예: 찜 기능 -> `favoriteApi.js`).

## 설정

- 서비스키·백엔드 주소는 `.env.local`에 설정 (`.env.example` 참고).
