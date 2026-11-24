// 마이페이지 UI 전용 예시. 팀원 기능의 데이터에는 쓰지 않는다.
export const mockMyActivity = {
  bag: [
    { id: 'bag-1', name: '경복궁', region: '서울', contentType: '관광지', savedAt: '2026-10-02' },
    {
      id: 'bag-2',
      name: '전주 한옥마을',
      region: '전북 전주',
      contentType: '관광지',
      savedAt: '2026-10-01',
    },
    {
      id: 'bag-3',
      name: '해운대 해수욕장',
      region: '부산',
      contentType: '관광지',
      savedAt: '2026-09-30',
    },
    {
      id: 'bag-4',
      name: '성산일출봉',
      region: '제주',
      contentType: '관광지',
      savedAt: '2026-09-29',
    },
    {
      id: 'bag-5',
      name: '중앙시장',
      region: '강원 강릉',
      contentType: '쇼핑',
      savedAt: '2026-09-28',
    },
    {
      id: 'bag-6',
      name: '불국사',
      region: '경북 경주',
      contentType: '문화시설',
      savedAt: '2026-09-27',
    },
  ],
  completions: [
    {
      id: 'finish-3',
      completedAt: '2026-10-02',
      roundNumber: 3,
      places: ['서울', '전주', '부산', '제주'],
    },
    { id: 'finish-2', completedAt: '2026-09-29', roundNumber: 2, places: ['강릉', '경주', '부산'] },
    { id: 'finish-1', completedAt: '2026-09-25', roundNumber: 1, places: ['서울', '전주'] },
  ],
  rewards: [
    { id: 'reward-2', name: '온누리상품권 5,000원', acquiredAt: '2026-10-02', status: 'available' },
    { id: 'reward-1', name: '지역화폐 상품권 3,000원', acquiredAt: '2026-09-29', status: 'used' },
  ],
};
