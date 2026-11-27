# 🪵 YUTOPIA — Backend

윷토피아 REST API 서버 (SSAFY 관통 프로젝트 Framework PJT · 6팀)

## Spring AI 구축 — 1단계

- 기존 Spring Boot 4.1.0을 유지하고 Spring AI BOM 2.0.3 및 OpenAI starter를 추가했습니다.
- 호환성 기준: [공식 버전 안내](https://github.com/spring-projects/spring-ai#readme), [2.0.3 릴리스 안내](https://spring.io/blog/2026/11/20/spring-ai-2-1-0-GA-available-now/).
- 기본 실행에서는 AI 모델이 비활성화되어 API 키 없이 기존 회원·여행지 기능을 사용할 수 있습니다.
- `ai` 프로필에서 OpenAI ChatModel과 벤더 공통 추상화인 `ChatClient` 빈(`travelChatClient`)을 구성합니다. 빈 생성만으로 LLM을 호출하지 않습니다.
- 이 단계는 설정 기반만 추가합니다. Tool, Prompt, 추천 API와 프론트 전환은 후속 단계이며, 기존 Vercel AI 추천은 계속 기존 경로를 사용합니다.

### 나중에 AI를 활성화하는 방법

Java 21과 MySQL을 준비한 뒤, 같은 PowerShell 세션에서 설정합니다.

```powershell
$env:SPRING_PROFILES_ACTIVE = 'ai'
$env:OPENAI_API_KEY = '<발급받은 키>'
$env:OPENAI_MODEL = 'gpt-4o-mini'
.\mvnw.cmd spring-boot:run
```

이 프로젝트는 `spring.config.import`로 백엔드 `.env`를 읽도록 구성했습니다. 저장소 루트 또는 `backend/`에서 실행할 수 있습니다. `.env`는 Java properties 형식(`KEY=value`, 따옴표·`export` 없이)으로 작성하세요. `frontend/.env`는 읽지 않습니다. 셸/IDE 환경변수가 파일보다 우선하며, `application-local.properties`로 개별 Spring 설정을 덮어쓸 수도 있습니다. 예시는 `backend/.env.example`에 있습니다. 실제 키는 커밋하지 마세요.

채팅 요청 제한 시간은 30초, SDK 재시도 횟수는 1회입니다. 이미지·음성·임베딩·moderation 모델은 비활성화합니다.

**검증 상태:** POM XML, 기존 Boot 버전 유지, BOM/starter 선언, 기본 비활성화·프로필 설정 및 `git diff --check`를 확인했습니다. 현재 환경에서는 `mvnw.cmd -version`부터 Wrapper 시작 오류(`Cannot index into a null array`)가 발생해 의존성 해결·컴파일·Java 테스트는 확인하지 못했습니다. 기본 Java도 8이므로 Java 21 환경이 필요합니다. 서버 실행 및 실제 LLM 호출은 수행하지 않았으며, API 키 유효성·DB 연결·모델 응답은 추가 검증이 필요합니다.

## 유토 구축 — 2단계: TMAP 보행 경로 Tool

현재 추가된 흐름은 `WalkingRouteTool → WalkingRouteService → TMAP 보행자 경로 API`입니다. `ai` 프로필의 `travelChatClient`에 Tool을 등록했습니다. 서버가 현재 코스 또는 장소 검색에서 확인한 좌표를 전달하는 용도입니다.

- `backend/.env`의 `TMAP_API_KEY`를 `yutopia.tmap.api-key`로 연결합니다. 키가 없어도 빈 구성은 가능하며, 경로 조회 시에만 503 오류를 반환합니다.
- 입력: `start/end` 각각의 `name`, `lat`, `lng`와 `avoidStairs`.
- 출력: 출처·조회 시각, 거리(m), 예상 시간(초·올림한 분), WGS84 경로 좌표, 제공된 보행 안내와 시설 코드.
- `avoidStairs=true`는 TMAP 탐색 옵션 `30`을 사용합니다. 육교·계단 안내를 보존하며 시설 정보가 누락되었다고 시설이 없다고 단정하지 않습니다.
- 연결 제한 3초·읽기 제한 10초이며 자동 재시도하지 않습니다. 좌표 오류, 빈 키, 인증·한도·연결 오류 및 잘못된 응답을 구분하고 제공자 오류 본문·키는 반환하지 않습니다.
- 유토 대화 API는 아래 5단계에 추가했습니다. 추천 결과·지도 코스의 유토 UI 연결은 프론트엔드에 구현했으며 실제 서버 연동 검증은 남아 있습니다. 경로 주변 검색과 경유 시간 비교는 아래 3·4단계에 추가했습니다.

공식 명세: [보행자 경로 요청](https://tmap-skopenapi.readme.io/reference/보행자-경로안내), [응답 필드·시설 코드](https://tmap-skopenapi.readme.io/reference/경로안내-샘플예제).

### 외부 호출 없는 단위 테스트

```powershell
.\mvnw.cmd '-Dtest=WalkingRouteServiceTest' test
```

`MockRestServiceServer`로 HTTP를 메모리 안에서 대체하므로 Spring 서버·DB·실제 API 키를 사용하지 않습니다. 요청 좌표·이름 인코딩, 시간 변환, 시설 코드 보존, 계단 제외, 입력 오류, 인증·한도·연결 실패와 응답 누락을 검증합니다.

**2단계 검증:** STS에 포함된 Java 25에서 `--release 21`로 추가 코드와 `AiConfig`를 컴파일하고, 로컬 캐시 라이브러리를 이용한 JUnit 실행으로 8개 테스트를 통과했습니다. Maven Wrapper 문제로 Maven 의존성 전체 해결 및 전체 프로젝트 빌드는 검증하지 못했습니다. 서버·TMAP·LLM 실호출은 하지 않았으므로 실제 키 권한과 실제 응답은 별도 검증이 필요합니다.

## 유토 구축 — 3단계: 경로 주변 장소 검색 Tool

`RoutePlaceSearchTool → RoutePlaceSearchService → 카카오 로컬 API`를 추가하고 `travelChatClient`에 등록했습니다. 앞선 `getWalkingRoute` 결과의 `path`를 다음 Tool의 입력으로 전달합니다. 대화 API의 실행 제어는 아래 5단계에 추가했으며 프론트 연결은 후속 작업입니다.

- `backend/.env`의 `KAKAO_REST_API_KEY`를 사용합니다. JavaScript 지도 키와 구분하며 실제 키는 Git에서 제외합니다.
- 입력: 실제 보행 경로 `path`, 종류 `RESTAURANT`/`POLICE`/`CAFE`/`CONVENIENCE_STORE`/`PHARMACY`, 주변 반경(기본 200m, 50~1000m), 결과 수(기본 5, 1~10).
- 음식점·카페·편의점·약국은 카테고리 검색, 경찰 시설은 경찰서·지구대·파출소 키워드 검색 후 응답의 이름·분류로 선별합니다. 다른 공공기관을 경찰 시설로 취급하지 않습니다.
- 길이 1m~30km, 2~5000개 좌표의 보행 구간에서 최대 4개 지점을 선택합니다. 지점 사이의 경로도 포함하도록 조회 원의 반경을 넓히고, 후보를 전체 경로 선분까지의 거리로 재검증합니다. 출발점·도착점에만 의존하지 않습니다.
- 요청당 첫 페이지 최대 15개를 조회합니다. 최대 호출 수는 일반 종류 4회, 경찰 시설 12회입니다. 추가 페이지를 무제한 조회하지 않으며 페이지·표시 개수 제한을 `truncated`로 표시합니다.
- 중복 장소를 제거하고 경로와의 이격 거리, 경로 시작점부터의 진행 거리 순으로 정렬합니다. 두 거리는 짧은 경로의 평면 투영으로 계산한 근사값이며 실제 도보 거리나 소요 시간이 아닙니다. 영업 여부·접근성도 추정하지 않습니다.
- 실패한 페이지의 후보는 반영하지 않습니다. 일부 요청 성공 시 `partial`과 안내 문구를 반환하고, 전체 실패 시 오류를 반환합니다. 인증 실패는 즉시 중단하고 429 한도 오류 이후에는 추가 요청을 하지 않습니다. 검색 결과 없음은 시설 부재를 의미하지 않습니다.

명세 기준: [카카오 로컬 API](https://developers.kakao.com/docs/ko/local/dev-guide).

```powershell
.\mvnw.cmd '-Dtest=WalkingRouteServiceTest,RoutePlaceSearchServiceTest,RouteGeometryTest' test
```

**3단계 검증:** 외부 HTTP를 메모리 Mock으로 대체하여 기존 보행 경로 8개 + 주변 검색 11개(두 Tool의 입출력 연결 포함) + 경로 기하 계산 4개, 총 23개 JUnit 테스트를 통과했습니다. Java 25에서 `--release 21`과 로컬 캐시 라이브러리로 추가 코드 및 설정 클래스를 컴파일했습니다. Maven 전체 빌드, 실제 키 권한, 실제 API 응답과 유토 UI는 미검증입니다. 서버·DB·실제 TMAP/카카오/LLM은 실행하지 않았습니다.

## 유토 구축 — 4단계: 경유 시간 비교 Tool

`DetourTimeComparisonTool → DetourTimeComparisonService → WalkingRouteService`를 추가하여 AI 클라이언트에 등록했습니다. 기존 경로 조회를 재사용하며 [TMAP 보행자 API의 `passList`](https://tmap-skopenapi.readme.io/reference/보행자-경로안내)에 한 곳의 경유 좌표(경도,위도)를 전달합니다.

- 입력: 현재 구간의 `start/end`, 장소 검색에서 확인한 `via`, `avoidStairs`, 사용자가 명시한 경우의 `visitMinutes`(0~1440, 미지정 시 null).
- 같은 출발·도착지와 탐색 옵션으로 원래 경로와 경유 경로를 각각 1회 새로 조회합니다. 예전 화면의 추정 시간과 혼합하지 않습니다. 원래 경로 조회가 실패하면 경유 요청도 하지 않습니다.
- 출력: 두 경로의 상세 결과와 `거리 차이 = 경유 거리 - 원래 거리`, `이동 시간 차이 = 경유 초 - 원래 초`. 표시용 올림 분끼리 빼지 않고 초 단위로 계산하며, 음수 차이도 그대로 보존합니다.
- 식사·대기·관람 시간을 추측하지 않습니다. 사용자가 체류 시간을 지정한 경우에만 `totalSecondsIncludingVisit`, `extraSecondsIncludingVisit`을 계산합니다. 미지정이면 두 값은 null입니다.
- 예: 원래 이동 10분, 경유 이동 13분이면 추가 이동 3분입니다. 사용자가 식사 30분을 지정하면 체류 포함 총 43분, 원래 경로보다 33분 추가입니다.
- 모든 입력을 첫 외부 요청 전에 검증합니다. 어느 경로든 조회 실패 시 비교 결과를 반환하지 않고 기존 오류 처리를 따릅니다. 영업 여부·현장 접근성을 보장하거나 기존 코스를 수정하지 않습니다.

```powershell
.\mvnw.cmd '-Dtest=WalkingRouteServiceTest,RoutePlaceSearchServiceTest,RouteGeometryTest,DetourTimeComparisonServiceTest' test
```

**4단계 검증:** 기존 23개 + 경유 비교 11개, 총 34개 JUnit 테스트를 메모리 HTTP Mock으로 통과했습니다. 세 Tool의 입출력을 실제로 연결하는 테스트, 경유 좌표·탐색 옵션, 초 단위 차이, 음수 차이, 체류 미지정/0분 구분, 사전 검증·API 실패·계산 범위 초과를 확인했습니다. Java 25의 `--release 21`과 로컬 캐시 라이브러리로 관련 코드를 컴파일했습니다. Maven 전체 빌드 및 실제 API 호출은 미검증입니다. 대화 API·프롬프트·이력은 아래 5단계에 추가했습니다.

## 유토 구축 — 5단계: 코스 대화 API·프롬프트·이력

로그인한 회원이 추천 코스별로 대화를 생성하고 질문할 수 있도록 추가했습니다. 현재 프론트 UI는 연결되지 않았으며 아래 API에는 백엔드 로그인에서 발급받은 Bearer 토큰이 필요합니다. 브라우저 목업 인증 토큰은 사용할 수 없습니다. `ai` 프로필이 꺼져 있으면 인증 후 503을 반환합니다.

| Method | 경로 (`/api/ai/yuto/conversations` 기준) | 동작 |
| --- | --- | --- |
| POST | 기본 경로 | `{course}`로 대화 생성, `201 {conversationId, course, turns, expiresAt}` |
| GET | `/{id}` | 본인의 코스·대화 이력 조회 |
| POST | `/{id}/messages` | `{message}`로 질문, `{conversationId, answer, evidence, expiresAt}` 반환 |
| DELETE | `/{id}` | 대화와 검색 후보 삭제, 204 |

생성 요청 예시(장소 ID는 코스 안에서 중복되지 않아야 합니다):

```json
{
  "course": {
    "courseId": "course-1",
    "title": "서울 여행",
    "stops": [
      {"id": "a", "title": "첫 장소", "lat": 37.57, "lng": 126.98},
      {"id": "b", "title": "다음 장소", "lat": 37.58, "lng": 126.99}
    ]
  }
}
```

### 처리 구조

`YutoChatController → YutoChatService → YutoChatEngine → SpringAiYutoModel(ChatModel)`이 대화를 처리합니다. `YutoPrompt`는 유토의 역할, 근거 기반 답변, 모호한 구간 재질문, 예상 이동 시간과 체류 시간 구분을 정의합니다. 코스 및 외부 데이터의 문자열은 지시가 아닌 데이터로 취급하도록 안내합니다.

- 모델에 제공하는 Tool은 요청별 `YutoCourseTools` 3개입니다. 모델은 코스 장소 ID와 검색 결과 ID만 선택하며, 서버가 보관한 좌표·실제 경로를 기존 Tool에 연결합니다. 임의 좌표·다른 코스의 장소 ID를 직접 전달할 수 없습니다.
- 주변 검색 요청은 서버가 보행 경로 조회 → 경로 주변 검색 순서로 연쇄 실행합니다. 경유 비교는 같은 구간·방향·계단 옵션에서 최근 검색한 장소만 허용합니다.
- Spring AI 2.0의 `ChatModel`/`ToolCallingChatOptions`에 Tool 스키마를 전달하고, 반환된 Tool 요청을 서버가 허용 목록으로 검사하여 직접 실행합니다. 자동 Tool advisor를 사용하지 않아 실행 횟수를 서버에서 제한합니다.
- 한 질문에 모델 호출 최대 4회, 모델 Tool 요청 최대 6개, 서버의 실제 Tool 작업 최대 6회로 제한합니다. 주변 검색은 최대 2회, 경유 비교는 최대 1회입니다. 같은 질문의 동일 경로와 동일 검색은 재사용합니다.
- Tool 결과를 다음 모델 호출에 전달해 최종 답변을 생성합니다. `evidence`에는 서버가 직접 실행한 Tool의 성공 여부와 결과/오류를 포함합니다. 실제 모델의 근거 준수·추천 품질은 실호출 검증이 필요합니다.

### 이력과 제한

- 회원별 최대 5개 대화, 단일 JVM 전체 최대 1000개입니다. 서로 다른 회원은 대화를 조회·질문·삭제할 수 없으며 같은 회원의 다른 대화도 이력·후보를 공유하지 않습니다.
- 마지막으로 성공한 대화 후 30분에 만료됩니다. 최근 20개 질문·답변 쌍을 보관하고 모델에는 최근 10쌍만 전달합니다. 질문은 최대 2000자, 답변은 최대 6000자입니다.
- 검색 후보는 대화별 최대 40개, 10분 동안만 재사용합니다. 실패한 최종 답변의 이력과 새 후보는 저장하지 않습니다. Tool이 일부 실패했음을 설명하는 정상 답변은 실패 근거와 함께 저장됩니다.
- 같은 대화의 동시 질문·삭제는 409로 거절합니다. 서로 다른 대화는 동시에 처리할 수 있습니다. 이 제한은 단일 JVM 기준이며 서버 간 이력 공유·전역 동시성 제한은 구현하지 않았습니다. 서버 재시작 시 이력은 사라집니다.

외부 호출·DB 없이 관련 테스트만 실행하는 Maven 명령:

```powershell
.\mvnw.cmd '-Dtest=*Route*Test,*Yuto*Test,DetourTimeComparisonServiceTest' test
```

**5단계 검증:** 기존 34개 + 대화/코스 Tool 13개 + 저장소 3개 + Spring AI 어댑터 2개 + 인증 API 4개, 총 56개 JUnit 테스트를 통과했습니다. Stub 모델·외부 서비스, 메모리 HTTP Mock 및 standalone MockMvc를 사용하여 회원·코스 격리, 대화 생성/조회/질문/삭제, Tool 연쇄 실행, 동시 요청, 만료, 실패 후 이력·후보 복구와 반복 호출 제한을 확인했습니다. Java 25에서 `--release 21`로 변경 코드를 컴파일했으며 Maven 전체 빌드·전체 DB 통합 테스트·실제 LLM/TMAP/카카오 호출은 미검증입니다. 유토 아이콘·대화 패널은 프론트엔드에 연결했으며 [프론트 README](../frontend/README.md)에 UI 검증 범위를 정리했습니다.

| 항목 | 내용 |
| --- | --- |
| 언어 / 프레임워크 | Java 21 · Spring Boot 4.1.0 · MyBatis 4.0.1 |
| DB | MySQL 8.0.16 이상 (`yutopia`, 테스트는 `yutopia_test`) |
| 인증 | PBKDF2-HMAC-SHA256 비밀번호 해시 + HMAC 서명 Bearer 토큰 (외부 라이브러리 없음) |
| 테스트 | JUnit 5.14.4 + 실제 MySQL, **65/65 통과** |

<br>

## 🚀 실행

```bash
# 1. DB + 샘플 데이터 (API 키·Python 불필요)
mysql -u ssafy -p --default-character-set=utf8mb4 < src/main/resources/db/schema.sql        # ⚠ 기존 yutopia DB 삭제 후 재생성
mysql -u ssafy -p --default-character-set=utf8mb4 yutopia < src/main/resources/db/seed.sql  # 여러 번 실행해도 중복 없음

# 2. 서버 실행 → http://localhost:8080
./mvnw spring-boot:run          # Windows: .\mvnw.cmd spring-boot:run
```

| 환경변수 | 기본값 | 용도 |
| --- | --- | --- |
| `YUTOPIA_DB_URL` / `_USERNAME` / `_PASSWORD` | `localhost:3306/yutopia`, `ssafy`, `ssafy` | DB 접속 |
| `YUTOPIA_CORS_ORIGINS` | `localhost:5173`, 배포 도메인 | 프론트 허용 Origin (콤마 구분) |
| `YUTOPIA_TOKEN_SECRET` | 개발용 값 | 토큰 서명 키. **운영에서는 반드시 32자 이상으로 지정** |
| `YUTOPIA_EXPOSE_RESET_TOKEN` | `true` | 메일 발송 대신 재설정 토큰을 응답에 포함. 운영에서는 `false` |

개인 설정은 `application-local.properties.example`을 `application-local.properties`로 복사해서 쓰면 돼요(Git 제외).

<br>

## 📡 REST API

모든 오류는 `{"message": "사용자에게 보여 줄 문구"}` 형태로 내려가요. 🔒 표시가 있는 API는 `Authorization: Bearer <token>`이 필요해요.

### 인증 · 회원

| Method | Path | 요청 | 응답 |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{email, password, nickname}` | `201 {user, token}` · 중복 시 409 |
| POST | `/api/auth/login` | `{email, password}` | `{user, token}` · 실패 시 401 |
| POST | `/api/auth/logout` 🔒 | | `204` |
| POST | `/api/auth/password-reset` | `{email}` | `{resetToken?}` (가입 여부 비노출) |
| POST | `/api/auth/password-reset/confirm` | `{token, password}` | `204` · 기존 토큰 전부 무효 |
| GET | `/api/members/me` 🔒 | | `{id, email, nickname}` |
| PATCH | `/api/members/me` 🔒 | `{nickname}` | `{id, email, nickname}` |
| DELETE | `/api/members/me` 🔒 | `{password}` | `204` (찜도 함께 삭제) |

검증 규칙은 프론트 `validators.js`와 같아요. 이메일 형식, 비밀번호는 영문+숫자 8~64자, 닉네임은 한글·영문·숫자·`_-` 2~30자예요.

### 보따리(찜) 🔒

| Method | Path | 요청 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/members/me/favorites` | | `Place[]` (+`memo`, `addedAt`) |
| PUT | `/api/members/me/favorites/{placeId}` | 여행지 스냅샷 `{provider, title, address, lat, lng, image, contentTypeId, placeUrl, memo}` | `Place` · **멱등** |
| PATCH | `/api/members/me/favorites/{placeId}` | `{memo}` | `Place` |
| DELETE | `/api/members/me/favorites/{placeId}` | | `204` · 멱등 |

`placeId`는 TourAPI `contentid`나 `kakao:<id>`예요. DB에 없는 여행지는 스냅샷으로 `places`(+대표 이미지)를 만든 뒤 찜해요.

### 여행지 (공개)

| Method | Path | 파라미터 | 응답 |
| --- | --- | --- | --- |
| GET | `/api/places` | `keyword`, `areaCode`, `page=1`, `size=30` (최대 100) | `Place[]` |
| GET | `/api/places/{placeId}` | | `Place` + `overview`, `homepage`, `intro`(TourAPI 원본), `images[]` |
| GET | `/api/areas` | | `[{code, name}]` 시도 목록 |

`Place`의 필드 이름은 프론트 `tourApi.normalizePlace()`와 같아요(`id`, `contentTypeId`, `title`, `address`, `image`, `thumbnail`, `lat`, `lng`, `cat1~3`, `areaCode`, `tags` 등). 그래서 프론트는 TourAPI 대신 이 API를 그대로 쓸 수 있어요.

<br>

## 🧱 구조와 설계

```
src/main/java/com/yutopia/
├─ controller/          AuthController · MemberController · PlaceController
│  └─ dto/              요청/응답 record (AuthDtos, PlaceDtos)
├─ service/             AuthService · MemberService · FavoriteService · PlaceService · MemberRules(검증)
├─ security/            PasswordHasher · TokenProvider · AuthInterceptor · @LoginMember
├─ config/WebConfig     CORS · 인증 인터셉터 · @LoginMember 리졸버 등록
├─ exception/           ApiException · GlobalExceptionHandler
└─ model/
   ├─ dao/              CRUD DAO 8개 + PlaceQueryDao(화면 조회 전용)
   └─ dto/              테이블 엔티티 8개 + PlaceView(조회 모델)
src/main/resources/
├─ mappers/             Mapper XML 9개
└─ db/                  schema.sql · seed.sql · seed_summary.json
```

- **토큰**: `base64(memberId.만료).HMAC(secret, payload + 비밀번호해시)` 형태예요. 서버에 세션을 저장하지 않고, 비밀번호를 바꾸거나 탈퇴하면 기존 토큰이 서명 불일치로 바로 무효가 돼요.
- **조회/명령 분리**: CRUD DAO(테이블 단위)와 `PlaceQueryDao`(places + details + 대표 이미지 + 태그 + 시도를 한 번에 JOIN)를 나눴어요. 기존 DAO 계약을 건드리지 않고 화면에 필요한 형태로 조회해요.
- **찜 멱등성**: PUT과 DELETE를 여러 번 보내도 결과가 같아요. 그래서 프론트 동기화 큐가 재시도해도 안전해요.
- **보안**: 비밀번호는 PBKDF2(210,000회, 16B salt)로 해시해요. 해시와 토큰은 상수 시간으로 비교하고, 비밀번호 재설정은 가입 여부를 드러내지 않아요. 샘플 회원(`!sample-account-disabled`)은 로그인할 수 없어요.

<br>

## 🧪 테스트

```bash
python scripts/prepare_test_database.py   # 최초 1회: yutopia_test 생성
./mvnw test
```

| 구분 | 테스트 | 결과 |
| --- | ---: | :---: |
| DAO 8개 클래스 (CRUD, 검색, 계층, 정렬, PK·UNIQUE·FK·CHECK 제약, 회원별 격리) | 60 | ✅ |
| [ApiFlowTest](src/test/java/com/yutopia/controller/ApiFlowTest.java): 가입→로그인→수정→탈퇴, 401·CORS, 비밀번호 재설정, 찜·여행지 흐름 | 4 | ✅ |
| 애플리케이션 컨텍스트 (DAO 9개 등록, 테스트 DB 확인) | 1 | ✅ |
| **합계** | **65** | ✅ |

- 테스트마다 트랜잭션을 롤백하고, 접속한 DB가 `yutopia_test`가 아니면 실행을 막아요.
- JUnit 5.14와 Spring 7 조합이라 `SpringExtension` 대신 컨텍스트를 직접 띄워요. 자세한 내용은 [docs/dao-tests.md](docs/dao-tests.md)에 있어요.
- GitHub Actions는 MySQL 8 서비스 컨테이너를 띄워 같은 테스트를 실행해요(`.github/workflows/ci.yml`).

<br>

## 🗃 데이터

| 테이블 | members | places | regions | place_categories | place_details | place_images | place_tags | favorites |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 샘플 건수 | 3 | 30 | 16 | 34 | 30 | 90 | 180 | 9 |

관광지는 서울·부산·제주 각 10곳이에요. 관광정보를 다시 수집하려면 아래처럼 실행해요. [TourAPI](https://www.data.go.kr/data/15101578/openapi.do) 키가 필요하고, Python 3.10+와 MySQL 클라이언트가 있어야 해요.

```bash
cp .env.example .env.local        # 인증키 입력
python scripts/seed_tourapi.py --with-demo-members --refresh --apply
```

스키마와 DAO 규칙은 [docs/data-access.md](docs/data-access.md)에 정리돼 있어요.
