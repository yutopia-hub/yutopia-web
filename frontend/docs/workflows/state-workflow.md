# 전역 상태 추가 워크플로우

페이지 하나에서만 쓰는 상태는 여기 해당 안 됨 (그냥 페이지 모듈 변수로 처리).

1. 정말 여러 페이지/컴포넌트가 공유해야 하는 상태인지 확인 (예: 로그인 여부, 찜 목록 개수 등).
2. `src/store/xxxStore.js` 생성, `createStore(initialState)`로 스토어 만들기 (`authStore.js` 패턴 복붙).
3. 상태를 바꾸는 액션 함수(`login`, `logout`처럼)를 같은 파일에서 export. `setState`는 항상 patch만 전달.
4. localStorage 동기화가 필요하면 `src/utils/storage.js`의 `getItem/setItem`을 사용.
5. 구독하는 쪽은 `store.subscribe(callback)`으로 변경 감지, 콜백 안에서 자기 DOM만 다시 그린다.
6. `npm run build`로 확인.

참고: [src/store/AGENT.md](../../src/store/AGENT.md)
