# 페이지 추가 워크플로우

새 화면(라우트)을 추가할 때 순서.

1. `src/pages/NewPage.js` 생성, `async function NewPage(params) { return `html`; }` 형태로 작성.
2. 데이터가 필요하면 `src/api/`의 함수를 호출 (없으면 [api-workflow.md](./api-workflow.md) 먼저).
3. `src/main.js`에 `registerRoute('/path', NewPage)` 추가. 동적 파라미터는 `:id` 문법.
4. 로그인이 필요한 페이지면 상단에서 `authStore.getState()`로 체크 (로그인 폼 자체는 `MyPage.js`에만 있음 — 별도 `/login` 라우트 없음. 다른 페이지에서 로그인 유도가 필요하면 `navigate('/mypage')`로 보낸다).
5. 폼이 있다면 `document.addEventListener('submit', ...)` 위임 패턴으로 하단에 이벤트 등록 (`MyPage.js` 참고).
6. 네비게이션에 노출해야 하면 `src/components/Header.js`의 nav-links에 링크 추가.
7. `npm run dev`로 직접 들어가서 확인, `npm run build`로 빌드 확인.

참고: [src/pages/AGENT.md](../../src/pages/AGENT.md), 파일이 커지면 `/refactor-split-file` 템플릿 사용.
