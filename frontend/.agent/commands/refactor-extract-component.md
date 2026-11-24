---
description: 페이지 안의 UI 조각을 재사용 가능한 컴포넌트로 추출
---

다음 페이지/파일에서 UI 조각을 컴포넌트로 추출해줘: $ARGUMENTS

요구사항:

1. 추출 대상 UI가 실제로 2개 이상의 페이지에서 쓰이는지, 혹은 앞으로 쓰일 게 명확한지 먼저 확인한다. 아니라면 추출하지 않고 그 이유를 말해줘.
2. 추출하는 컴포넌트는 `src/components/`에 `(props) => htmlString` 형태로 만든다 (`src/components/NoticeCard.js` 참고).
3. 상태 구독이 필요한 컴포넌트라면 `src/components/Header.js`의 `render + store.subscribe` 패턴을 따른다.
4. 이벤트 바인딩이 필요하면 `src/utils/dom.js`의 `on()` 위임 패턴을 사용한다.
5. 원래 페이지에서는 새 컴포넌트를 import해서 교체하고, 동작이 기존과 완전히 동일한지 확인한다.
6. `src/components/AGENT.md` 규칙을 따르고, 끝나면 `npm run build`로 확인한다.
