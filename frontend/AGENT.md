# 윷토피아 프론트엔드 (Vanilla JS)

여행지를 보따리에 담아 윷판에서 여행하는 보드게임형 여행 계획 서비스. 프레임워크 없이 Vite + Vanilla JS로 구현. 백엔드는 `../backend`(Spring Boot).

## 스택

- Vite (번들러/dev server)
- Vanilla JS (ES Modules), 프레임워크 없음
- 해시 기반 자체 라우터 (`src/router/router.js`)
- 상태관리는 자체 pub-sub 스토어 (`src/store/store.js`)

## 폴더 구조

```
src/
  router/     # 해시 라우팅
  pages/      # 라우트에 매핑되는 화면 단위
  components/ # 여러 페이지에서 재사용하는 UI 조각
  algorithm/  # 순수 알고리즘 (TSP, 날씨 정책, recommendation/)
  api/        # 서버/외부 API 통신 레이어 (mock/ 목업)
  store/      # 전역 상태 (인증 등)
  utils/      # 순수 함수 헬퍼 (DOM, 포맷, 검증, 스토리지)
  styles/     # 전역 CSS
```

각 폴더 안의 `AGENT.md`에 세부 규칙이 있음. 해당 폴더에서 작업할 때는 그 문서를 먼저 확인할 것.

## 핵심 규칙

- 페이지 컴포넌트는 `async function PageName(params)` 형태로 HTML 문자열을 반환한다. DOM 직접 조작은 `utils/dom.js`의 헬퍼를 통해서만.
- API 호출은 반드시 `src/api/*Api.js`를 거친다. 페이지/컴포넌트에서 `fetch`를 직접 호출하지 않는다.
- `VITE_USE_MOCK=true`(.env.local)일 때는 목업 데이터로 동작해야 한다. 실제 API 연동 전까지 이 플래그를 유지.
- 전역 상태가 필요한 경우만 `store/`에 추가한다. 페이지 로컬 상태는 그냥 클로저 변수로 충분.

## 페이지 / 라우트

- `/` → `/board` 윷판 (`/board/:id`)
- `/map` 지도: 하단 가운데 검색 시트 + 사진 핀 + 오른쪽 아래 캐리어(찜) 위젯
- `/map/details/:id` 관광지 상세 (날씨, 사진, 소개, 이용 안내 등). **id·코드류는 화면에 표시하지 않는다.**
- `/mypage`, `/mypage/edit` 마이페이지 · `/login`, `/signup`, `/forgot-password` 인증

## 데이터 소스

- 관광정보: 한국관광공사 TourAPI `KorService2` (`src/api/tourApi.js`)
- 날씨: 기상청 단기예보 (`src/api/weatherApi.js`, 위경도 → 격자 변환은 `utils/kmaGrid.js`)
- 지도: 카카오맵 JS SDK (`src/api/kakaoMap.js`에서 한 번만 동적 로드)
- 캐리어(찜 목록): `localStorage` 우선 저장 (`src/store/carrierStore.js`), 로그인 + 백엔드 연결 시 `src/api/carrierSyncApi.js`가 서버 찜과 동기화
- 회원·여행지 DB: Spring 백엔드 (`../backend`, `VITE_API_BASE_URL`)
- 키는 `.env.local`에 설정 (`.env.example` 참고). 공공데이터 키가 없으면 관광정보/날씨는 자동으로 목업으로 동작.
- 외부 API 문자열을 innerHTML에 넣을 때는 반드시 `escapeHtml`/`nl2br`(`utils/format.js`)를 거친다.

## 작업 시 참고

- 리팩토링은 `.agent/commands/`의 템플릿을 사용 (`/refactor-split-file` 등).
- 폴더별 작업 흐름은 `docs/workflows/`를 참고.
- 브랜치 전략은 `docs/BRANCH_STRATEGY.md`.

## 에이전트 Push 권한

- 에이전트가 **직접 push**해도 되는 건 `docs/`, `AGENT.md`, `README.md` 같은 문서 변경뿐.
- `src/`, `index.html`, 설정 파일(`vite.config.js`, `package.json` 등) 변경은 에이전트가 커밋까지는 할 수 있어도, push는 사용자가 직접 하거나 사용자의 명시적인 push 지시를 받은 뒤에만 한다.
- 애매하면 push 전에 먼저 물어본다.
