# styles/

전역 CSS만 둔다. 컴포넌트 전용 스타일이 많아지면 `component-name.css`로 분리해서 이 폴더에 추가하고 `index.html`에서 link 하거나 해당 JS에서 import한다.

## 구성

- `reset.css` : 브라우저 기본 스타일 제거
- `variables.css` : 색상/스페이싱 등 CSS 변수 (`var(--color-primary)` 등으로 사용)
- `global.css` : 레이아웃, 공통 클래스(`.btn`, `.card` 등)

## 규칙

- 색상/간격 하드코딩하지 말고 `variables.css`의 변수를 쓴다.
- 새 색상/간격 토큰이 필요하면 `variables.css`에 추가하고 전역에서 재사용한다.
