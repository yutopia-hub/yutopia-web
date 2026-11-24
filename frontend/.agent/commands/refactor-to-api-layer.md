---
description: 페이지/컴포넌트에 직접 박혀있는 fetch 호출을 api 레이어로 이동
---

다음 파일에 직접 들어있는 fetch/API 호출을 `src/api/` 레이어로 옮겨줘: $ARGUMENTS

요구사항:

1. 어떤 리소스를 다루는지 파악해서 기존 `*Api.js`(`noticeApi.js`, `authApi.js`)에 추가할지, 새 파일(`favoriteApi.js` 등)을 만들지 결정한다.
2. 통신은 `src/api/http.js`의 `request()`를 통해서 하고, 직접 `fetch`를 호출하지 않는다.
3. 실제 API가 아직 없으면 `VITE_USE_MOCK` 분기를 넣어서 목업으로 동작하게 한다 (`noticeApi.js` 패턴 참고).
4. 호출부(페이지/컴포넌트)는 옮긴 함수를 import해서 쓰도록 수정하고, 에러 처리는 try/catch로 화면에 메시지를 보여주는 기존 패턴을 유지한다.
5. `src/api/AGENT.md` 규칙을 따르고, 끝나면 `npm run build`로 확인한다.
