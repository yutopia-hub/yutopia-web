# 컴포넌트 추가/수정 워크플로우

1. 정말 재사용되는지 먼저 확인 (2개 이상 페이지 또는 확실히 예정됨). 아니면 페이지 파일 안에 그냥 둔다.
2. `src/components/NewComponent.js`에 `(props) => htmlString` 형태로 작성 (`NoticeCard.js` 참고).
3. 상태 구독이 필요하면 `render(target)` 함수 + `store.subscribe(() => render(target))` 패턴 (`src/pages/MyPage.js`의 로그인 성공 후 재렌더 참고).
4. 클릭 등 이벤트가 필요하면 `src/utils/dom.js`의 `on(el, event, selector, handler)`로 위임 바인딩.
5. 사용하는 페이지에서 import해서 교체, 스타일은 `src/styles/global.css`의 기존 클래스(`.card` 등) 우선 재사용.
6. `npm run build`로 확인.

참고: [src/components/AGENT.md](../../src/components/AGENT.md), 페이지에서 조각을 뽑아올 땐 `/refactor-extract-component` 템플릿 사용.
