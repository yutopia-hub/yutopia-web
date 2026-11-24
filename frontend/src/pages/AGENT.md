# pages/

라우트 하나당 파일 하나. `src/main.js`의 `registerRoute`에 매핑된다.

## 규칙

- export하는 함수는 `async function XxxPage(params)` 형태로, 완성된 HTML 문자열을 반환한다 (JSX 아님, 템플릿 리터럴 사용).
- 데이터 로딩은 `api/`의 함수를 호출해서 처리하고, 페이지 안에서 직접 fetch하지 않는다.
- 폼 제출 등 이벤트 바인딩은 `document.addEventListener('submit', ...)` 형태로 파일 하단에 위임 등록한다 (innerHTML로 교체되는 요소는 직접 리스너를 못 붙이므로 이벤트 위임을 쓴다). 새 폼을 추가할 때는 `e.target.id`로 분기하는 기존 패턴을 따를 것.
- 페이지 전용 UI 조각이 다른 페이지에서도 쓰이게 되면 `components/`로 옮긴다.

## 새 페이지 추가 시

1. `pages/NewPage.js` 생성
2. `main.js`에 `registerRoute('/path', NewPage)` 추가
3. 로그인 필요한 페이지면 `authStore.getState()`로 체크 후 `navigate('/mypage')`로 보낸다 (로그인/회원가입 폼은 `MyPage.js`에만 있음, 별도 `/login` 라우트 없음)
