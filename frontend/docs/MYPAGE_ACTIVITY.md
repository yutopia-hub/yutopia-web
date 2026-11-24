# 윷토피아 마이페이지 활동 데이터 연결

## 범위

마이페이지는 여행지 찾기, 보따리 저장, 윷판 게임, 보상 발급 기능을 구현하지 않는다.
회원·인증 API, authStore, 기존 localStorage 래퍼를 재사용한다.
활동 조회는 `src/api/myActivityApi.js`, 화면 렌더링은 `src/pages/MyPage.js`에 분리되어 있다.

## 조회 인터페이스

`getMyActivity(userId)`는 아래 객체를 반환한다.

```js
{
  isMock: false,
  summary: { bagCount: 6, completionCount: 3, rewardCount: 2 },
  bag: [], // savedAt 내림차순, 최대 3개
  completions: [], // completedAt 내림차순, 최대 3개
  rewards: [] // acquiredAt 내림차순, 전체
}
```

팀원 데이터 계약이 확정되면 `readActivity(userId)`에서 각 팀원의 기존 조회 함수 또는 저장 키를 읽고 다음 입력 형태로 매핑한다.
현재 키는 연결 전 마이페이지 개발용 인터페이스이며, 다른 팀원에게 이 키로 저장하도록 강제하는 계약이 아니다.
페이지 또는 팀원 기능에서 새 저장 로직을 만들 필요 없이 이 조회 함수를 교체하면 된다.

| 배열        | 항목 필드                              | 설명                                          |
| ----------- | -------------------------------------- | --------------------------------------------- |
| bag         | id, name, region, contentType, savedAt | 장소명, 지역, 표시용 콘텐츠 유형, 저장일      |
| completions | id, completedAt, roundNumber, places   | 완주일, 누적 완주 번호, 경로 이름 문자열 배열 |
| rewards     | id, name, acquiredAt, status           | 보상명, 획득일, 상태                          |

날짜는 ISO 8601 문자열을 사용한다. 시간까지 전달한다면 시간대 정보도 포함한다.
TourAPI 콘텐츠 코드 등 원본 값은 조회 계층에서 표시용 문자열로 변환한다.
보상 상태는 `available`(사용 가능), `used`(사용 완료), `expired`(기간 만료).
알 수 없는 상태는 화면에서 “상태 확인 중”으로 표시한다.

요약 수는 **전체 배열의 길이**로 계산한다. 조회 결과가 이미 3개로 잘린 데이터라면 전체 개수를 별도로 받도록 API 어댑터를 조정해야 한다.

## 현재 localStorage 읽기 fallback

기존 `utils/storage.js`의 prefix를 유지한다.
회원별 실제 키: `travel-notice:mypage-activity:<userId>`.

값의 예시:

```json
{
  "bag": [
    {
      "id": "place-1",
      "name": "경복궁",
      "region": "서울",
      "contentType": "관광지",
      "savedAt": "2026-10-02"
    }
  ],
  "completions": [
    {
      "id": "finish-1",
      "completedAt": "2026-10-02",
      "roundNumber": 1,
      "places": ["서울", "전주", "부산"]
    }
  ],
  "rewards": [
    {
      "id": "reward-1",
      "name": "온누리상품권 5,000원",
      "acquiredAt": "2026-10-02",
      "status": "available"
    }
  ]
}
```

저장된 객체가 있으면 그 데이터만 사용한다. 누락되거나 잘못된 배열은 빈 배열로 처리한다.
`{ "bag": [], "completions": [], "rewards": [] }`를 읽으면 요약은 0이며 각 영역에 빈 상태를 표시한다.
다른 회원의 활동 데이터는 합치지 않는다.
저장 키가 없거나 JSON 객체가 아니면 `mockMyActivity.js`의 예시를 사용하고 “예시 활동 기록” 안내를 표시한다.
목업 데이터는 localStorage에 자동 저장하지 않는다.

## 변경 파일

- LoginPage.js: 기존 검증·로그인 로직 유지, 서비스 컬러 카드, 가입 완료 안내
- SignupPage.js: 기존 입력·검증 유지, 성공 시 로그인 화면 이동. 자동 로그인 제거
- MyPage.js: 활동 요약/보따리/완주/보상/하단 계정 관리. 조회·수정·탈퇴 유지
- MemberEditPage.js: 상단 계정 메뉴 제거, 기존 수정 로직과 서비스 폼 스타일 적용
- member.css: 회원 화면에만 컬러 토큰과 레이아웃 적용. 전역 스타일/헤더 미변경
- myActivityApi.js: 읽기 전용 활동 조회·정렬·요약·fallback
- mockMyActivity.js: 보따리 6개, 완주 3회, 보상 2개 예시
- tests/myActivity.test.js: 예시·빈 상태·회원별 분리·정렬·잘못된 데이터 검증

## 검증

```powershell
node --test tests/mockMembers.test.js tests/validators.test.js tests/myActivity.test.js
npm.cmd run lint
npm.cmd run build
```

Chrome에서 회원가입 필수값 검증, 가입 후 로그인 이동, 로그인 실패, 로그인 성공, 마이페이지 표시, 닉네임 수정 반영을 확인했다.
모바일 viewport에서 요약 1열과 가로 넘침 여부도 확인했다.
상품권 발급, 사용 처리, 외부 결제 기능은 없다.
