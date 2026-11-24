# 브랜치 전략 (3인 / 단기 프로젝트용)

하루 안에 끝내는 걸 최우선으로 하는 간단한 규칙. 복잡한 git-flow 안 씀.

## 브랜치 구조

```
master              # 항상 동작하는 상태 유지 (배포/발표 기준)
 ├─ feat/login       # 담당자 A - 로그인/회원가입
 ├─ feat/notice-list # 담당자 B - 공고 목록/상세
 └─ feat/notice-etc  # 담당자 C - 그 외 (마이페이지 등)
```

- `master` 하나만 보호 브랜치로 생각하고, 나머지는 각자 기능 단위로 하나씩만 가져간다.
- `develop` 같은 중간 브랜치는 만들지 않는다 (1일짜리라 오버헤드).

## 브랜치 이름

`feat/기능명` (영문 소문자, 하이픈). 예: `feat/login`, `feat/notice-detail`, `fix/header-nav`.

## 작업 순서

1. `master`에서 각자 `feat/xxx` 브랜치 생성 후 바로 작업 시작.
2. 중간중간 작은 단위로 자주 커밋 (최소 1~2시간마다 한 번은 push).
3. 내 기능이 돌아가는 걸 확인하면 바로 `master`로 PR(또는 머지) — 리뷰는 **되는지만 서로 눈으로 1분 확인** 하는 정도로 가볍게.
4. 충돌나면 그 자리에서 바로 같이 해결 (자리 비우지 말고 슬랙/카톡으로 바로 공유).
5. 하루 끝날 때 `master` 기준으로 최종 동작 확인.

## 커밋 메시지

형식은 자유롭지만 앞에 태그만 붙이기: `feat:`, `fix:`, `style:`, `chore:`
예: `feat: 공고 상세 페이지 추가`, `fix: 로그인 폼 에러 메시지 안 뜨는 문제`

## 코드 스타일 (가볍게만)

너무 빡빡하게 안 가고, 눈으로 보기에 서로 안 헷갈릴 정도로만 맞춘다.

- 세미콜론 사용, `var` 쓰지 않기 (`const`/`let`만).
- 들여쓰기는 2칸. 탭이나 4칸으로 썼어도 신경 쓰지 말고 `npm run format` 한 번 돌리면 자동으로 2칸으로 정리됨 (Prettier).
- 페이지/컴포넌트 함수명은 `PascalCase` (`HomePage`, `NoticeCard`), 그 외 일반 함수/변수는 `camelCase`.
- API 호출은 꼭 `src/api/`를 거치기, 페이지에서 `fetch` 직접 호출 금지 (자세한 건 [AGENT.md](../AGENT.md) 참고).
- 커밋 전에 `npm run format && npm run lint && npm run build` 한 번 돌려서 깨진 거 없는지 확인. (`npm run lint`는 `no-unused-vars` 같은 건 warning이라 안 막음, 진짜 문법 에러만 걸린다고 생각하면 됨)

## 규칙

- `master`에 직접 깨지는 커밋 올리지 않기 (push 전에 `npm run build` 한 번 돌려보기).
- 같은 파일을 동시에 여러 명이 건드릴 것 같으면 미리 말하고 순서 정하기 (예: `src/main.js`에 라우트 추가할 때).
- `--force` push 금지. 꼬이면 혼자 해결하려 하지 말고 바로 얘기하기.
- 작업 시작 전에 `git pull origin master`로 최신 상태 받고 시작하기.
- `master`에 머지된 feature 브랜치는 머지 후 바로 삭제해서 헷갈리지 않게 하기.
