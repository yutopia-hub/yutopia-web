# 🪵 YUTOPIA — Backend

윷토피아 REST API 서버 (SSAFY 관통 프로젝트 Framework PJT · 6팀)

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
