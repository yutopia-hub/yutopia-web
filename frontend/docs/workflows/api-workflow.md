# API 연동 워크플로우

새 리소스(예: 찜하기, 댓글 등)를 백엔드/공공데이터 API에 연결할 때 순서.

1. **응답 스키마 확인**: 공공데이터포털 문서나 백엔드 API 스펙에서 필드명/타입 확인.
2. **mock 먼저**: `src/api/mockXxx.js`에 실제와 비슷한 모양의 목업 데이터를 만든다.
3. **Api 파일 작성**: `src/api/xxxApi.js`에 `USE_MOCK` 분기가 있는 함수를 작성 (`noticeApi.js` 패턴 복붙).
   - 실제 호출은 `http.js`의 `request()`를 사용.
   - 필드명 매핑(snake_case -> camelCase 등)은 여기서 끝낸다.
4. **화면 연결**: `pages/`에서 해당 함수를 호출해 렌더링. 로딩/에러 상태는 try/catch로 처리.
5. **실 API 전환**: 서비스키/엔드포인트가 준비되면 `.env.local`에 값 채우고 `VITE_USE_MOCK=false`로 바꿔서 실제 응답과 비교.
6. **빌드 확인**: `npm run build`.

참고: [src/api/AGENT.md](../../src/api/AGENT.md), 리팩토링 필요시 `/refactor-to-api-layer` 템플릿 사용.
