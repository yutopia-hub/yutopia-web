# 공통 헤더·회원·로그인 기능

## 파일별 역할

| 파일                              | 담당 역할                                                                   |
| --------------------------------- | --------------------------------------------------------------------------- |
| `src/components/Header.js`        | 로그인 상태별 메뉴, 마이페이지 진입, 로그아웃. 구독과 이벤트는 한 번만 등록 |
| `src/api/authApi.js`              | 가입, 로그인, 로그아웃, 비밀번호 재설정 요청·완료                           |
| `src/api/memberApi.js`            | 본인 회원정보 조회, 닉네임 수정, 비밀번호 확인 후 탈퇴                      |
| `src/api/mockMembers.js`          | 개발용 회원 데이터, 세션, 만료되는 일회용 재설정 토큰                       |
| `src/pages/LoginPage.js`          | 로그인 폼과 오류 처리                                                       |
| `src/pages/SignupPage.js`         | 가입 폼, 비밀번호 확인, 가입 후 로그인 화면 이동                            |
| `src/pages/MyPage.js`             | 회원정보 조회, 탈퇴 동의와 비밀번호 입력                                    |
| `src/pages/MemberEditPage.js`     | 닉네임 수정                                                                 |
| `src/pages/ForgotPasswordPage.js` | 재설정 링크 요청, 토큰을 사용한 새 비밀번호 설정                            |
| `src/store/authStore.js`          | 사용자·토큰 저장, 회원 수정 시 사용자 상태 동기화                           |
| `src/utils/html.js`               | 사용자 입력값의 HTML 이스케이프                                             |
| `src/utils/dom.js`                | 렌더, 메시지 표시, 이벤트 위임, 중복 제출 방지                              |
| `src/styles/account.css`          | 공통 헤더와 회원 폼 스타일                                                  |
| `src/main.js`                     | 화면 경로 등록                                                              |

## 화면 경로

- `#/signup`: 회원가입
- `#/login`: 로그인
- `#/mypage`: 본인 회원 조회·탈퇴 (로그인 필요)
- `#/mypage/edit`: 닉네임 수정 (로그인 필요)
- `#/forgot-password`: 비밀번호 재설정 요청
- `#/forgot-password?token=...`: 새 비밀번호 설정

이메일은 계정 식별자로 사용하고 수정 화면에서 변경하지 않는다.

## 목업 동작

회원·인증 기능은 환경변수와 관계없이 브라우저 저장소로 동작한다. 가입한 회원만 로그인할 수 있다.
회원 데이터와 세션은 `travel-notice:mock-*` 키로 브라우저 localStorage에 저장한다.
비밀번호 원문 대신 salt와 해시를 저장하지만, 브라우저 데이터는 사용자가 변경할 수 있으므로 실제 인증 보안을 제공하지 않는다.
실서비스에서는 회원 검증, 비밀번호 해싱, 세션 관리, 재설정 토큰 검증을 서버가 담당해야 한다.

목업에서는 이메일을 발송하지 않고 재설정 링크를 화면에 표시한다.
링크는 15분 동안 유효하며 새 링크 발급 시 이전 링크를 폐기한다.
비밀번호를 변경하면 기존 세션을 무효화한다. 회원 탈퇴 후에는 해당 계정으로 로그인할 수 없다.

## 실제 API 계약 초안

아래 경로는 프론트 구현을 위한 제안이며 백엔드 계약 확정 후 조정해야 한다.
사용자 응답은 `{ id, email, nickname }`, 로그인·가입 응답은 `{ user, token }` 형태다.

| 메서드·경로                             | 요청                      | 응답                               |
| --------------------------------------- | ------------------------- | ---------------------------------- |
| POST `/api/auth/signup`                 | email, password, nickname | user, token                        |
| POST `/api/auth/login`                  | email, password           | user, token                        |
| POST `/api/auth/logout`                 | 인증 헤더                 | 빈 응답 가능                       |
| POST `/api/auth/password-reset`         | email                     | 안내 응답. 실제 서버는 이메일 발송 |
| POST `/api/auth/password-reset/confirm` | token, password           | 빈 응답 가능                       |
| GET `/api/members/me`                   | 인증 헤더                 | 사용자 객체                        |
| PATCH `/api/members/me`                 | nickname, 인증 헤더       | 수정된 사용자 객체                 |
| DELETE `/api/members/me`                | password, 인증 헤더       | 빈 응답 가능                       |

## 검증

- `node --test tests/mockMembers.test.js`: 회원 생명주기와 재설정 만료 검사
- `npm run lint`
- `npm run build`

브라우저 확인 순서: 가입 → 헤더·회원 조회 → 닉네임 수정 → 로그아웃 → 재로그인 → 비밀번호 찾기 → 새 비밀번호 로그인 → 탈퇴.

## 윌토피아 활동 마이페이지

활동 화면과 데이터 연결 인터페이스는 [MYPAGE_ACTIVITY.md](./MYPAGE_ACTIVITY.md)를 참고한다.
