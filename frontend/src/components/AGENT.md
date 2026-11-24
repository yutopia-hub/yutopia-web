# components/

2개 이상의 페이지에서 재사용하는 UI 조각. 페이지 전용 UI는 여기 두지 말고 해당 `pages/` 파일 안에 둔다.

## 구성

- `Header.js` / `Footer.js` : 전 페이지 공통
- `CarrierIcon.js` : 직접 그린 보따리 SVG 아이콘 (`currentColor`)
- `CarrierWidget.js` : 떠 있는 보따리 버튼 + 개수 뱃지 + 찜 리스트(메모 추가/수정, 삭제, 전체 비우기). `mountCarrierWidget(container, { onLocate })`로 붙이고, 스타일은 `styles/carrier.css`

## 규칙

- 순수 렌더 함수는 `(props) => htmlString` 형태를 유지한다 (`CarrierIcon.js` 참고).
- 상태를 구독해야 하는 컴포넌트(로그인 여부 등에 따라 바뀌는 것)는 `render(target)` 함수 + `store.subscribe(() => render(target))` 패턴을 따른다.
- 이벤트 바인딩이 필요하면 `utils/dom.js`의 `on(el, event, selector, handler)` 위임 패턴을 사용한다.
- 컴포넌트는 자기 자신의 DOM만 그린다. 다른 컴포넌트의 DOM을 직접 조작하지 않는다.
