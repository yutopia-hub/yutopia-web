# utils/

순수 함수만 둔다. 외부 상태(스토어, API)에 의존하는 로직은 여기 두지 않는다.

## 구성

- `dom.js` : `render`, `qs`, `qsa`, `on` (이벤트 위임) — DOM 조작은 전부 이 헬퍼를 통해서.
- `format.js` : 날짜/텍스트 포맷팅 (`formatDate`, `truncate`), HTML 이스케이프 (`escapeHtml`, `nl2br`).
- `kmaGrid.js` : 위경도 → 기상청 격자(nx, ny) 변환.
- `validators.js` : 입력값 검증 (`isValidEmail`, `isValidPassword`, `isRequired`).
- `storage.js` : `localStorage` 래퍼 (키 prefix 자동 부착, JSON 직렬화).

## 규칙

- 새 헬퍼를 추가하기 전에 기존 파일에 비슷한 게 있는지 먼저 확인한다.
- 함수는 입력 -> 출력만 있어야 한다 (사이드 이펙트 없음). `storage.js`처럼 의도적으로 사이드 이펙트가 필요한 경우만 예외.
