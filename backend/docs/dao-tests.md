# DAO JUnit 검증 결과

2026-11-13에 DAO별 실행 후 기존 컨텍스트 테스트를 포함한 전체 Maven 테스트를 실행했습니다. 최종 결과는 **61개 성공, 실패 0, 오류 0, 건너뜀 0**입니다.

## 환경

| 항목 | 실제 사용 값 |
| --- | --- |
| Java 실행 버전 | Eclipse Temurin 25.0.4.1 |
| Java 컴파일 대상 | `--release 21` |
| Spring Boot | 4.1.0 |
| JUnit Jupiter | 5.14.4 |
| MyBatis / MyBatis Spring Boot Starter | 3.5.19 / 4.0.1 |
| Maven / Surefire | 3.10.0 / 3.5.6 |
| MySQL | 8.0.46 |
| 테스트 DB | `yutopia_test` |

## 테스트 구성과 안전장치

DAO 테스트는 `src/test/java/com/yutopia/model/dao`에 있으며 아래 8개 클래스가 각각 실행됩니다. `DaoTestSupport`가 테스트 전용 Spring 컨텍스트, DAO 주입, 공통 픽스처와 트랜잭션을 관리합니다. 지역·카테고리에는 INSERT DAO가 없으므로 해당 부모 픽스처만 JdbcTemplate과 생성 키를 사용해 준비합니다. 나머지는 실제 DAO와 `src/main/resources/mappers/*.xml`을 사용합니다.

각 테스트 전에 `DataSourceTransactionManager`로 트랜잭션을 시작하고, 성공·실패와 관계없이 `@AfterEach`에서 롤백합니다. 고유한 UUID 기반 이메일·외부 ID·지역 코드·이름을 사용하고 실제 생성 키를 전달합니다. 회원 비밀번호 컬럼에는 평문이 아닌 bcrypt 형식의 테스트 해시를 저장합니다. 테스트 순서에 의존하지 않으며 병렬 실행은 비활성화했습니다.

`TestDatabaseSafetyConfiguration`은 DataSource 초기화 시 실제 접속한 catalog가 정확히 `yutopia_test`인지 확인합니다. 다른 DB라면 픽스처를 넣기 전에 컨텍스트 구성을 중단합니다. 테스트 내부에는 DROP, TRUNCATE, 전체 테이블 DELETE나 DDL을 실행하지 않습니다. 테이블 생성은 별도 준비 명령으로 테스트 실행 전에 수행합니다.

DAO 전용 설정은 `dao-test` 프로필에 한정했습니다. 기존 `YutopiaApplicationTests`는 실제 `YutopiaApplication`을 구동하며, DAO 전용 설정이 섞이지 않은 상태에서 기본 MyBatis 자동 설정으로 DAO 8개가 등록되는지와 테스트 DB 연결을 검증합니다. 기존 테스트를 삭제하거나 건너뛰지 않았습니다.

## 파일별 결과

| 테스트 파일 / DAO | 전체 | 성공 | 실패 | 오류 | 건너뜀 | 주요 검증 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| MemberDaoTest | 7 | 7 | 0 | 0 | 0 | CRUD, 이메일 조회·중복, 해시·역할·시각 매핑, 없는 회원 |
| PlaceDaoTest | 11 | 11 | 0 | 0 | 0 | CRUD, 전체·이름·지역·분류 검색, 중복 외부 키, 좌표·Boolean·nullable 갱신·CHECK |
| RegionDaoTest | 5 | 5 | 0 | 0 | 0 | 전체·ID·부모·최상위·없는 지역 |
| PlaceCategoryDaoTest | 5 | 5 | 0 | 0 | 0 | 전체·ID·부모·최상위·없는 분류, 분류 간 격리 |
| PlaceDetailDaoTest | 8 | 8 | 0 | 0 | 0 | CRUD, 전체 필드·JSON·ENUM·시각, NULL 갱신, PK·FK, 장소 삭제 CASCADE |
| PlaceImageDaoTest | 7 | 7 | 0 | 0 | 0 | 생성 키·기본 순서, sort_order 정렬, 장소별 격리, 삭제, 중복 순서·FK·CHECK |
| PlaceTagDaoTest | 6 | 6 | 0 | 0 | 0 | 등록·조회·삭제, 복합 PK, 다른 장소의 같은 태그, 없는 장소 |
| FavoriteDaoTest | 11 | 11 | 0 | 0 | 0 | 등록·취소·EXISTS·목록·JOIN·정렬, 복합 PK·FK, 회원별 격리, CASCADE·RESTRICT |
| YutopiaApplicationTests | 1 | 1 | 0 | 0 | 0 | 실제 애플리케이션 컨텍스트·Mapper 8개·테스트 DB |
| 합계 | 61 | 61 | 0 | 0 | 0 | DAO의 구현 메서드 34개를 모두 호출하는 검증 포함 |

## 발견한 오류와 수정

1. **JUnit 5와 Spring 7 테스트 확장의 API 충돌**
   - 첫 `MemberDaoTest` 실행에서 `NoSuchMethodError: ExtensionContext.Store.computeIfAbsent(...)`가 발생했습니다.
   - 현재 Spring 7의 `SpringExtension`은 JUnit 6 API를 호출합니다. `@MybatisTest`와 `@SpringBootTest` 모두 이 확장을 사용하므로 JUnit 5.14.4를 강제하면 실행 단계에서 충돌합니다.
   - `pom.xml`에 JUnit 5.14.4를 명시하고, JUnit 5 자체 생명주기와 `SpringApplicationBuilder`로 실제 Spring 컨텍스트를 구동하도록 구성했습니다. 트랜잭션 롤백은 Spring 트랜잭션 매니저로 명시적으로 수행합니다. 애플리케이션 버전을 내리거나 JUnit 6으로 요구사항을 바꾸지 않았습니다.
   - 수정 파일: `DaoTestSupport.java`, `DaoTestConfiguration.java`, `YutopiaApplicationTests.java`, `pom.xml`.

2. **MySQL CHECK 위반의 예외 분류 차이**
   - 첫 `PlaceDaoTest` 실행에서 `DataIntegrityViolationException`을 기대했지만 실제로는 `UncategorizedSQLException`이 발생했습니다.
   - MySQL 8은 해당 CHECK 위반을 SQLState `HY000`, 오류 코드 `3819`로 보고합니다. 이는 제약 위반이 제대로 동작했지만 Spring의 일반 무결성 위반 예외 분류로 처리되지 않은 경우입니다.
   - 테스트에서 Spring `DataAccessException`의 실제 SQLException 오류 코드가 `3819`인지와 `ck_places_coords` 또는 `ck_images_sort` 제약 이름을 모두 검증하도록 변경했습니다. 잘못된 좌표가 저장되지 않았다는 조회 검증도 추가했습니다.
   - 수정 파일: `DaoTestSupport.java`, `PlaceDaoTest.java`, `PlaceImageDaoTest.java`.

수정 후 모든 DAO를 개별 실행했고 전체 테스트도 다시 실행해 통과했습니다. 이번 검증에서 운영 DAO와 Mapper XML을 수정할 필요가 있는 오류는 발견되지 않았습니다.

## 다른 환경에서 실행

Java 21 이상, MySQL 8.0.16 이상을 준비하고 프로젝트 루트에서 실행합니다. Maven Wrapper가 최초 실행 시 필요한 배포본·의존성을 내려받을 수 있어야 합니다.

```powershell
python scripts/prepare_test_database.py
Copy-Item src/test/resources/application-test-local.properties.example src/test/resources/application-test-local.properties
$env:YUTOPIA_TEST_DB_USERNAME = 'root'
$env:YUTOPIA_TEST_DB_PASSWORD = '본인의 테스트 DB 비밀번호'
.\mvnw.cmd '-Dtest=MemberDaoTest' test
.\mvnw.cmd test
```

개인 테스트 설정 파일이 이미 있으면 덮어쓰지 않고 유지합니다. 준비 스크립트는 앱의 서버 접속 설정을 사용해 `yutopia_test`만 `CREATE DATABASE IF NOT EXISTS` 및 `CREATE TABLE IF NOT EXISTS`로 준비합니다. 생성 권한이 없다면 DB 관리자에게 별도 테스트 DB와 동일 스키마 생성을 요청해야 합니다. 개발 DB의 초기화 SQL 전체를 테스트 DB 준비에 직접 실행하지 마세요. 해당 파일에는 `DROP DATABASE yutopia` 구문이 있습니다.

`application-test.properties`의 환경변수나 Git에서 제외되는 `application-test-local.properties`로 테스트 URL·계정·비밀번호를 지정합니다. `YUTOPIA_TEST_DB_URL`을 지정하더라도 DB 이름은 반드시 `yutopia_test`여야 합니다. 테스트 URL을 개발 DB로 설정하면 안전장치가 실행을 차단합니다. 테스트는 자동으로 DB나 테이블을 생성하지 않으며 연결 실패를 성공이나 건너뜀으로 처리하지 않습니다.

## 최종 DB 확인

최종 테스트 실행 후 `yutopia_test`의 8개 테이블이 모두 **0행**인지 확인했습니다. 개발 DB `yutopia`는 회원 3, 장소 30, 지역 16, 카테고리 34, 상세 30, 이미지 90, 태그 180, 찜 9행으로 기존 샘플 건수가 유지되었습니다.

상세 원본 결과는 실행 후 `target/surefire-reports/TEST-*.xml` 및 각 클래스의 `.txt` 파일에서 확인할 수 있습니다. 테스트 실행 로그와 개인 테스트 접속 설정은 Git에서 제외합니다. 남아 있는 실패나 건너뛴 테스트는 없습니다.
