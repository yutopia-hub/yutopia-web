import { getItem } from '../utils/storage.js';
import { mockMyActivity } from './mock/mockMyActivity.js';

const records = (value) =>
  Array.isArray(value)
    ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    : [];
const recent = (items, field) =>
  [...items].sort((a, b) => (Date.parse(b[field]) || 0) - (Date.parse(a[field]) || 0));

// 읽기 전용 연결 지점. 팀원 데이터 확정 후 이 함수만 실제 조회 함수로 교체한다.
// getItem이 붙이는 prefix 포함 실제 키: travel-notice:mypage-activity:<userId>
function readActivity(userId) {
  const stored = getItem(`mypage-activity:${userId}`, null);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return { data: stored, isMock: false };
  }
  return { data: mockMyActivity, isMock: true };
}

export async function getMyActivity(userId) {
  if (!userId) throw new Error('활동 기록을 조회할 회원이 없습니다.');
  const { data, isMock } = readActivity(userId);
  const bag = recent(records(data.bag), 'savedAt');
  const completions = recent(records(data.completions), 'completedAt');
  const rewards = recent(records(data.rewards), 'acquiredAt');
  return {
    isMock,
    summary: {
      bagCount: bag.length,
      completionCount: completions.length,
      rewardCount: rewards.length,
    },
    bag: bag.slice(0, 3),
    completions: completions.slice(0, 3),
    rewards,
  };
}
