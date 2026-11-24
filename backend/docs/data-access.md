YUTOPIA 데이터 접근 계층

프로젝트를 확인했을 때 실행 클래스는 `com.yutopia.YutopiaApplication`뿐이었으며, 기존 DTO, DAO, Mapper XML은 없었습니다. Maven 프로젝트로 Java 21, Spring Boot 4.1.0, MyBatis Starter 4.0.1, Lombok, MySQL Connector를 사용합니다. 작업 중 모델 폴더와 MyBatis 별칭 설정이 `com.yutopia`로 변경되어 최종 코드도 이 패키지에 맞췄습니다. 실행 클래스는 이동하거나 이름을 바꾸지 않았습니다.

구현 위치는 `src/main/java/com/yutopia/model/dto`, `src/main/java/com/yutopia/model/dao`, `src/main/resources/mappers`입니다. 기존 실행 클래스의 `@MapperScan`은 DAO 패키지를 가리키며, MyBatis는 `classpath:mappers/*.xml`을 읽습니다.

각 DTO에는 아래 테이블의 컬럼만 포함했습니다. BIGINT는 Long, DATETIME은 LocalDateTime, DECIMAL 좌표는 BigDecimal, nullable BOOLEAN은 Boolean으로 표현합니다. ENUM과 JSON은 String으로 저장하며 유효한 값인지는 MySQL 제약 조건이 검증합니다. Lombok getter/setter와 기본 생성자를 사용하며 비밀번호 해시를 출력하는 toString은 생성하지 않습니다.

| 테이블 / DTO | DAO 메서드 | Mapper XML |
| --- | --- | --- |
| members / Member | insert, findById, findByEmail, update, deleteById | MemberMapper.xml |
| places / Place | insert, findById, findAll, findByRegionId, findByCategoryId, searchByTitle, update, deleteById | PlaceMapper.xml |
| regions / Region | findAll, findById, findByParentId | RegionMapper.xml |
| place_categories / PlaceCategory | findAll, findById, findByParentId | PlaceCategoryMapper.xml |
| place_details / PlaceDetail | insert, findByPlaceId, update, deleteByPlaceId | PlaceDetailMapper.xml |
| place_images / PlaceImage | insert, findByPlaceId, deleteById | PlaceImageMapper.xml |
| place_tags / PlaceTag | insert, findByPlaceId, delete | PlaceTagMapper.xml |
| favorites / Favorite | insert, delete, findByMemberId, findPlacesByMemberId, exists | FavoriteMapper.xml |

SQL 적용

`src/main/resources/db/schema.sql`은 다음 순서로 `yutopia` DB를 초기화합니다. 실행할 때마다 기존 `yutopia` DB와 데이터가 삭제되고 8개 테이블이 새로 생성됩니다.

```sql
DROP DATABASE IF EXISTS yutopia;
CREATE DATABASE yutopia
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yutopia;
```

요청에 따라 실제 MySQL 서버에 위 SQL과 테이블 생성 구문을 실행했습니다. `spring.datasource.url`의 DB 이름을 `yutopia`로 변경했고 호스트, 포트, 연결 옵션, 사용자명, 비밀번호는 유지했습니다. 기존 DB의 `member`, `address` 테이블은 변경하지 않았습니다.

다시 초기화하려면 MySQL 클라이언트에 접속한 뒤 다음 명령으로 SQL 파일을 실행할 수 있습니다. 프로젝트 루트에서 클라이언트를 시작해야 상대 경로를 사용할 수 있습니다.

```sql
SOURCE src/main/resources/db/schema.sql;
```

SQL 파일은 기존 위치에 보존했고 각 테이블에 utf8mb4 문자셋을 지정했습니다. 위도·경도는 둘 다 NULL이거나 둘 다 유효한 값이어야 하도록 CHECK 조건을 보완했습니다. 애플리케이션 시작 시 자동으로 SQL을 실행하도록 설정하지 않았으므로 앱 재시작만으로 DB가 초기화되지는 않습니다.

TourAPI 샘플 데이터

한국관광공사 [국문 관광정보 서비스_GW](https://www.data.go.kr/data/15101578/openapi.do)의 실제 응답을 사용해 서울·부산·제주 관광지 각 10곳을 적재했습니다. 운영용 회원과 구분되는 `[샘플]` 회원 3명 및 찜 9건도 함께 생성했습니다. 샘플 회원은 `tourapi-demo-{법정동 시도 코드}@example.invalid` 이메일과 로그인에 사용할 수 없는 password_hash를 가지며 로그인 기능 검증용 계정은 아닙니다.

| 테이블 | 최초 샘플 적재 건수 |
| --- | ---: |
| members | 3 |
| places | 30 |
| regions | 16 |
| place_categories | 34 |
| place_details | 30 |
| place_images | 90 |
| place_tags | 180 |
| favorites | 9 |

API 주소는 `https://apis.data.go.kr/B551011/KorService2`입니다. `ldongCode2`, `lclsSystmCode2`의 신규 법정동·분류체계 코드를 사용하고 `areaBasedList2`, `detailCommon2`, `detailIntro2`, `detailImage2`에서 목록·상세·이미지를 가져옵니다. mapy는 위도, mapx는 경도로 저장합니다. 지역은 시도/시군구 2단계이며, 카테고리는 API의 분류체계 3단계를 보존합니다. 이미지에는 원본·썸네일 URL, 한국관광공사 출처와 Type1/Type3 등 API의 이용유형을 저장합니다. 태그는 지역명·분류명에서 구성합니다. 응답에서 확인되지 않은 실내외 구분, 예약 필요 여부 등은 UNKNOWN 또는 NULL로 둡니다.

설정은 프로젝트 루트의 `.env.local`에 저장하며 Git에서 제외했습니다. `.env.example`에는 키가 없는 설정 예시만 포함합니다. 적재 스크립트는 `TOUR_API_SERVICE_KEY` 환경변수를 지원하고 `VITE_API_SERVICE_KEY`도 입력으로 읽을 수 있습니다. 실제 인증키를 SQL, JSON 요약 또는 문서에 저장하지 않습니다.

프로젝트 루트에서 다음 명령을 실행하면 데이터를 가져오고 DB에 반영합니다. Python 3.10 이상과 PATH에 등록된 MySQL 클라이언트가 필요하며 별도 Python 패키지는 필요하지 않습니다.

```powershell
python scripts/seed_tourapi.py --with-demo-members --apply
```

`src/main/resources/db/seed.sql`은 인증키나 API 호출 없이 실행 가능한 데이터 스냅샷이고, `seed_summary.json`은 생성 시각과 적재 건수를 기록합니다. 이미 생성된 SQL만 적용하려면 다음 명령을 사용합니다.

접속 값은 `application.properties`, Git에서 제외되는 `application-local.properties`, `SPRING_DATASOURCE_*` 환경변수 순서로 읽습니다. 개인 설정 예시는 `src/main/resources/application-local.properties.example`에 있습니다. `${환경변수:기본값}` 형식도 지원합니다.

```powershell
python scripts/seed_tourapi.py --apply-only
```

DB 초기화 후에는 스키마 SQL 다음에 샘플 SQL을 적용합니다. 샘플 SQL 자체는 DB나 테이블을 삭제하지 않습니다. provider=TOUR_API와 external_id=contentid를 기준으로 같은 장소를 갱신하고, 지역·카테고리·이미지·태그·샘플 회원·찜도 재실행 시 중복되지 않습니다. 전체 SQL을 하나의 트랜잭션으로 적용합니다. 문자열은 utf8mb4 hex 리터럴로 인코딩하고 스키마와 같은 utf8mb4_unicode_ci 정렬 규칙을 지정합니다.

원본 API 응답은 Git에서 제외되는 `target/tourapi-cache`에 캐시합니다. `--refresh`를 추가하면 API를 다시 호출합니다. `--per-region 20`으로 지역당 건수를 바꿀 수 있고, `--regions 11 26 50`으로 법정동 시도 코드를 지정합니다. `--with-demo-members`를 생략하면 관광정보만 적재합니다. `--apply`를 생략하면 SQL과 요약 파일만 생성합니다.

DAO 사용 규칙

- insert/update/delete의 int 반환값은 영향받은 행 수입니다. 단건 조회 결과가 없으면 null, 목록 조회 결과가 없으면 빈 목록을 반환합니다.
- members, places, place_images의 insert는 생성된 ID를 전달한 DTO에 채웁니다. place_details의 PK는 기존 place_id이며, place_tags와 favorites는 복합 PK입니다.
- created_at/updated_at은 DB에서 관리합니다. insert 직후 기본값과 생성 시각까지 필요하면 생성된 ID로 다시 조회합니다.
- Member의 role, Place의 isActive, PlaceDetail의 setting, PlaceImage의 sortOrder를 insert에서 생략하면 각각 USER, true, UNKNOWN, 1을 사용합니다.
- update는 변경 가능한 컬럼 전체를 갱신합니다. 기존 DTO를 조회해 수정한 뒤 전달해야 합니다. nullable 컬럼은 null로 지울 수 있고, 필수 컬럼에는 유효한 값을 전달해야 합니다.
- findByParentId(null)은 최상위 지역/카테고리를 조회합니다. 지역·카테고리별 장소 조회는 전달한 ID와 정확히 일치하는 장소를 반환합니다.
- 장소 조회는 비활성 장소도 포함합니다. searchByTitle은 LIKE 부분 검색이며 입력의 `%`, `_`도 LIKE 와일드카드로 동작합니다.
- 이미지 목록은 sort_order 순서입니다. 같은 장소의 sort_order는 유일하므로 여러 이미지를 등록할 때 서로 다른 순서를 지정해야 합니다.
- 찜 목록은 최신 등록 순서이며 findPlacesByMemberId는 places와 JOIN한 List<Place>를 반환합니다. 중복 찜과 중복 태그는 복합 PK 제약으로 거부됩니다.
- 찜이 남아 있는 장소 삭제는 스키마의 ON DELETE RESTRICT에 따라 거부됩니다. 찜을 먼저 해제해야 장소를 삭제할 수 있습니다. 회원 삭제 시 그 회원의 찜은 CASCADE로 삭제됩니다.

의존성 정리

pom.xml에서 중복된 MySQL Connector 선언을 제거하고, WebMVC 및 MyBatis 테스트 의존성에 test scope를 지정했습니다. Service, Controller, JSP는 구현하지 않았습니다. JUnit 검증은 후속 작업에서 별도 테스트 DB로 구현·실행했으며 결과는 아래와 같습니다.

검증 결과

- 최초 구현 때는 로컬 javac로 확인했고, 후속 JUnit 검증에서는 Maven Wrapper 3.10.0과 JDK 25로 실제 `mvnw.cmd test`를 실행해 `--release 21` 컴파일 및 전체 테스트를 통과했습니다.
- JUnit 5.14.4를 사용한 DAO 테스트 60개와 기존 컨텍스트 테스트 1개가 모두 성공했습니다. 실패·오류·건너뜀은 0개입니다. 실행 방법과 오류 해결 내용은 프로젝트 루트의 `docs/dao-tests.md`를 참고하세요.
- SQL의 8개 테이블, DTO의 57개 필드, resultMap의 컬럼·프로퍼티·Java 타입을 대조했습니다.
- 실제 MyBatis XML 파서로 DTD, resultMap, 34개 statement, DAO 메서드명과 SQL ID, 파라미터 바인딩 및 null 부모 ID 분기를 검증했습니다.
- DB 연결 없이 SqlSessionFactory를 구성하고 Spring 컨텍스트에서 DAO 8개를 스캔해 빈으로 등록되는 것을 확인했습니다. 실행 클래스의 MapperScan 패키지를 사용했습니다.
- 실제 MySQL 8.0.46 서버에 스키마를 적용해 `yutopia`의 테이블 8개, 컬럼 57개, 외래 키 9개를 확인했습니다.
- application.properties의 접속 설정으로 JDBC와 HikariCP 연결에 성공했습니다. MyBatis DAO 8개를 사용해 실제 DB에서 조회했고 찜 JOIN 및 EXISTS 쿼리도 확인했습니다. 검증용 레코드는 등록하지 않았으며 전체 CRUD 검증은 수행하지 않았습니다.
- 접속 호스트·포트·옵션·계정·비밀번호를 유지하고 URL의 DB 이름만 변경했습니다. `git diff --check`를 통과했습니다.
- TourAPI 샘플 SQL을 두 번 적용한 뒤 8개 테이블의 건수와 회원·장소 PK가 유지되는지 확인했습니다. 장소 30개의 지역·카테고리·좌표, 상세정보의 개요·JSON, 이미지의 출처·이용유형이 모두 채워졌는지도 검증했습니다. 샘플 적재 스크립트의 Python 문법을 확인했고 JUnit은 작성하거나 실행하지 않았습니다.
- 샘플 적재 후 실제 MyBatis DAO 8개로 데이터를 조회해 BigDecimal 좌표, Boolean 활성 여부, LocalDateTime 생성·수집 시각, 장소 상세·이미지·태그, 회원별 찜 JOIN과 EXISTS 결과를 확인했습니다.

JUnit 검증 범위와 후속 확대 항목

- 회원 CRUD, 이메일 중복, 기본 role 및 생성 시각, 자동 생성 키.
- 장소 CRUD, 지역·카테고리·이름 검색, BigDecimal 좌표 정밀도, nullable 값 갱신, 좌표 CHECK.
- 지역·카테고리의 최상위 및 하위 항목 조회.
- 상세정보 CRUD, JSON 및 ENUM 유효성, nullable Boolean과 LocalDateTime 변환.
- 이미지 정렬·생성 키·순서 중복, 태그 복합 키와 삭제 범위.
- 회원별 찜 목록·JOIN 결과·찜 여부·복합 키 중복, 다른 회원의 찜 보존.
- FK 존재 검증, 회원 삭제 CASCADE, 찜한 장소 삭제 RESTRICT, 장소 상세/이미지/태그 CASCADE.
- Spring Boot 컨텍스트의 DAO 8개 등록과 Mapper XML 전체 로딩.
