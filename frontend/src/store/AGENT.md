# store/

전역 상태만 둔다. 페이지 안에서만 쓰는 상태는 그냥 그 페이지 모듈의 변수로 둘 것 (여기 넣지 않음).

## 구성

- `store.js` : 범용 pub-sub 스토어 생성 함수 `createStore(initialState)`. `getState/setState/subscribe` 제공.
- `authStore.js` : 로그인 사용자/토큰. `localStorage`와 동기화됨 (`utils/storage.js` 경유).
- `carrierStore.js` : 보따리(찜한 관광지 목록 + 메모). `localStorage`의 `carrier` 키에 저장. 보드판 등에서 `carrierStore.getState().items`로 꺼내 쓴다.
- `mapStore.js` : 지도 마지막 검색어 (상세 → 지도로 돌아갈 때 검색 복원용, 메모리에만 있음).

## 규칙

- 새 전역 상태가 필요하면 `createStore`로 새 스토어를 만든다 (authStore.js를 템플릿으로 복붙).
- 컴포넌트/페이지는 `store.subscribe(callback)`으로 변경을 구독하고, 콜백 안에서 자기 DOM만 다시 그린다 (`components/CarrierWidget.js` 참고).
- 페이지가 바뀌면 DOM이 교체되므로, 구독 콜백에서 대상 DOM이 `isConnected`가 아니면 스스로 구독을 해제한다.
- `setState`는 항상 patch 객체(또는 patch 함수)만 넘긴다. state 전체를 직접 변형하지 않는다.
