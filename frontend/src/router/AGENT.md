# router/

해시 기반 자체 라우터. `/path` 형태로 등록하고 `:id` 같은 동적 세그먼트를 지원한다.

## 규칙

- 새 라우트는 `router.js`를 건드리지 말고 `src/main.js`에서 `registerRoute('/path', Handler)`로 추가한다.
- 동적 파라미터는 `registerRoute('/board/:id', BoardPage)`처럼 등록하면 핸들러에 `{ id }`로 전달된다.
- 쿼리스트링(`#/?keyword=foo`)은 자동으로 파싱되어 동적 파라미터와 merge된 객체로 핸들러에 전달된다.
- `navigate(path)`로 코드에서 이동, `<a href="#/path">`로 마크업에서 이동. `window.location.href` 직접 조작하지 않는다.
