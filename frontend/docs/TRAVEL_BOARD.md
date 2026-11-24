# 여행 보드게임

`npm run dev` 실행 후 `http://localhost:5173/#/board/default`로 접속한다.
보드 ID는 `#/board/my-trip` 형태의 쿼리로 지정할 수 있다.
헤더 컴포넌트는 수정하지 않았다. `registerRoute('/board/:id', BoardPage)`에서
보드게임을 표시하며, 별도 `/travel-board` 페이지는 사용하지 않는다.

## 윷 던지기

윷가락 4개가 버튼 위치에서 날아가 각자 뒤집히고 튕긴 뒤 멈춘다.
평평한 면은 연한 나무색 줄무늬, 둥근 면은 진한 갈색으로 표시한다.
각 윷가락은 독립적인 50% 확률로 앞뒤를 결정한다.

| 평평한 면 개수 | 결과 | 이동 | 확률  |
| -------------- | ---- | ---- | ----- |
| 1              | 도   | 1칸  | 25%   |
| 2              | 개   | 2칸  | 37.5% |
| 3              | 걸   | 3칸  | 25%   |
| 4              | 윷   | 4칸  | 6.25% |
| 0              | 모   | 5칸  | 6.25% |

윷·모가 나와도 요청한 칸 수만 이동한다. 추가 던지기나 빽도 규칙은 포함하지 않는다.

## 데이터 연결

시간·날씨 배경은 `src/api/weatherApi.js`의 Open-Meteo 현재 날씨 API를 사용한다.
API에서 현재 날씨, 온도, 강수, 지역 시간대, 일출·일몰을 받아온다.
시계는 기기의 현재 시간을 API 지역 시간대로 표시하고, 일출·일몰에 따라
아침·낮·저녁·밤을 계산한다. 날씨 데이터의 기준 시간은 시계와 별도로 표시한다.
시계와 시간대 연출은 30초마다, 날씨는 15분마다 갱신하며 탭 복귀 시 오래된 데이터를 갱신한다.

위치 권한이 이미 허용된 경우 현재 위치를 사용한다. 그 외에는 서울 기준이라고
명시하고 `현재 위치 사용` 버튼으로 브라우저의 위치 권한을 요청한다.
위치 거부·시간 초과 때 기존 지역을 유지한다. API 실패 시 실제 날씨를 임의로
만들지 않고 `날씨 정보 없음` 또는 `업데이트 지연 · 마지막 날씨 유지`를 표시한다.
날씨 다시 불러오기 버튼으로 재시도할 수 있다.

`VITE_WEATHER_USE_MOCK=false`가 기본이다. 찜 목록의 `VITE_USE_MOCK`과 독립적이어서
찜 목록은 목업이어도 날씨는 실제 API를 사용한다. 날씨 시연용으로만
`VITE_WEATHER_USE_MOCK=true`를 지정하면 UI에 `데모`를 표시한다.
Open-Meteo 호출에는 공공데이터포털의 서비스키를 첨부하지 않는다.
API 참고: [Open-Meteo 문서](https://open-meteo.com/en/docs).

`board/environment.js`, `environment-time.js`, `styles/board-environment.css`가
하늘과 비·눈·안개, 도로 반사, 햇살·밤 조명을 관리한다. SVG 효과는 포인터를
차단하지 않고 패널 아래에 표시되며 모션 감소 설정에서 움직임을 멈춘다.
`board/decorations.js`의 중앙 장식은 이름표 없이 고정된 미니어처 정원에 배치한다.
윷토피아 현판은 28px 글씨를 사용한다. 중앙에는 자동 생성 장식을 배치하지 않는다.
`board/scenery-icons.js`의 한옥·장승·연·연꽃 SVG 아이콘이 보드 가장자리를 꾸민다.
기존 관람차·풍차는 중앙 경복궁·남산타워·물레방아·윷토피아 장식으로 교체했다.

실제 찜 API가 없으므로 `src/api/favoriteApi.js`가 우선 localStorage의
`travel-notice:favorites`를 읽는다. 이 키가 없으면 `VITE_USE_MOCK=false`일 때 빈
목록을 표시하고, 그 외에는 프로토타입의 8개 여행지를 데모로 표시한다.
명시적으로 저장된 빈 배열은 데모 목록으로 대체하지 않는다.

찜 데이터 계약:

```js
localStorage.setItem(
  'travel-notice:favorites',
  JSON.stringify([
    {
      id: 'place-1',
      name: '경복궁',
      region: '서울특별시',
      category: '문화 / 역사',
      imageUrl: '',
      emoji: '🏯',
      color: '#f3c9a0',
    },
  ]),
);
```

`data.js`에서 데이터 필드를 정규화한다. 실제 API가 정해지면
`favoriteApi.js`에서 프로젝트의 `http.js`를 이용하도록 교체한다.
현재 랜드마크는 원본과 같은 이모지 타일이다. 이미지 URL은 정규화하지만
이미지로 표시하는 변경은 `tiles.js`의 `renderLandmark()`에서 처리한다.

`src/api/boardApi.js`는 `travel-notice:boards:<boardId>`에 다음 형식을 저장한다.

```json
{ "boardId": "my-trip", "cells": [{ "index": 1, "placeId": "place-1" }] }
```

재접속하면 찜 목록을 불러온 뒤 유효한 칸과 여행지 ID만 복원한다.
삭제된 찜, 중복 여행지, 고정 칸 배치는 복원에서 제외한다.
초기화는 편집 중인 보드를 비운다. 초기화한 상태를 유지하려면 다시 저장한다.
플레이어 위치는 저장 payload에 포함하지 않으므로 재접속하면 START에서 시작한다.

## 구조와 수명 관리

- `BoardPage.js`: 화면 진입점. `board/markup.html`의 SVG와 패널 마크업 사용.
- `board/main.js`: 초기화, 데이터 로드, 저장과 초기화 이벤트 연결.
- `board/state.js`: 단일 상태와 모든 상태 변경, 구독.
- `board/ui.js`: 상태 변경에 따른 패널, 카드, 칸과 말 위치 갱신.
- `board/config.js`, `svg-utils.js`, `island.js`, `tiles.js`, `background.js`: 상수와 SVG 렌더링.
- `board/drag.js`, `yut.js`, `player.js`, `events.js`: 배치와 게임 동작.
- `board/lifecycle.js`: AbortController로 리스너와 대기를 해제하고 WAAPI를 취소.
- `styles/board.css`: 원본 토큰과 애니메이션을 보드 영역에 한정.

라우터는 페이지의 선택적 `mount(root, params)`를 DOM 렌더링 이후 호출하고,
반환된 정리 함수를 다음 페이지 이동 때 실행한다. 비동기 라우팅의 이전 응답이
현재 페이지를 덮어쓰지 않도록 요청 순서를 확인한다.

## 확인 방법

1. 여행지 카드를 빈 칸으로 드래그한다. 복제 카드 기울기, 칸 Glow, Pop과 토스트를 확인한다.
2. 카드에 Tab으로 이동하고 Enter로 선택한다. 빈 칸에서 Enter 또는 Space로 배치한다.
   카드를 더블클릭하면 START 이후 순서상 첫 번째 빈 여행지 칸에 자동 배치된다.
   고정 칸과 이미 채운 칸은 건너뛰고, 이동 중에는 배치할 수 없다.
3. 8칸을 채워 진행도, 완료 배너, 도로 Glow, 윷 활성화를 확인한다.
4. 저장하고 새로고침해 같은 배치를 복원한다.
5. 윷 결과 도·개·걸·윷·모(1~5칸)과 말 이동, 황금 열쇠 카드, 공항의 목적지 선택을 확인한다.
6. 초기화해 카드와 말이 돌아오는지 확인한다.
7. 찜 데이터를 빈 배열, 1개 배열, 잘못된 객체로 바꿔 빈 목록·부족한 목록·오류 UI를 확인한다.
8. 다크 모드, 모션 감소, 1100px 이하 패널 축소를 확인한다.
9. 윷가 움직이는 중 다른 페이지로 이동한 뒤 재접속한다. 이전 애니메이션이 남지 않는지 확인한다.

`npm run lint`, `npm run build`로 정적 검증한다.
`scripts/check-board.js`는 패키지 추가 없이 Chrome DevTools Protocol로 위 동작을 검증한다.
5173 포트의 앱과 9222 포트의 테스트 전용 Chrome을 먼저 실행하고
`node scripts/check-board.js`를 실행한다. 테스트 전용 브라우저의 보드·찜 저장소를 사용한다.

`node scripts/check-environment.js`는 API 응답을 테스트 전용 브라우저에서 대체해
24개 시간·날씨 조합, 위치 전환, API 실패, 모션 감소, 장식/슬롯/플레이어 겹침을 확인한다.
`node scripts/check-weather-live.js`는 별도 탭에서 실제 날씨 API 응답을 확인한다.

## 원본과의 차이

- 기존 Vite와 ES Modules를 사용하므로 `file://` 직접 실행은 지원하지 않는다.
- 프로토타입 Navbar 대신 프로젝트의 공통 헤더를 그대로 사용한다.
- 원본 토큰, ID, 클래스 선택자와 keyframes는 보드 범위로 한정해 공통 화면과 충돌을 방지했다.
- 원본에서 같은 이름 `fl`을 쓴 카드 뒤집기와 로켓 불꽃 keyframes를 분리했다.
- 저장·복원, 상태 UI, 키보드 배치, 라우트 이동 정리, SVG 모션 감소 대응을 추가했다.
- 모바일 레이아웃은 추가하지 않았다. 후속 작업에서는 보드 아래 카드 목록과 접을 수 있는 패널을 권장한다.
