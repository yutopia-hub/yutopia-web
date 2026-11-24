import { carrierStore } from '../store/carrierStore.js';
import { mockFavorites } from './mock/mockFavorites.js';

// 관광지 유형(contentTypeId)별 보드 카드 이모지/색상. 없는 유형은 기본값으로 대체.
const TYPE_STYLE = {
  12: { emoji: '🏞️', color: '#bfe3b0' }, // 관광지
  14: { emoji: '🏛️', color: '#d8d0f0' }, // 문화시설
  15: { emoji: '🎉', color: '#f5c9d6' }, // 축제·공연·행사
  25: { emoji: '🧭', color: '#c9e0b8' }, // 여행코스
  28: { emoji: '🚴', color: '#a9dcef' }, // 레포츠
  32: { emoji: '🏨', color: '#f3c9a0' }, // 숙박
  38: { emoji: '🛍️', color: '#f5d9a0' }, // 쇼핑
  39: { emoji: '🍽️', color: '#a9e3d0' }, // 음식점
};
const DEFAULT_STYLE = { emoji: '📍', color: '#f3c9a0' };

// "서울특별시 종로구 사직로 161" -> "서울특별시" 처럼 주소 앞부분만 지역으로 쓴다.
function regionOf(address) {
  return (
    String(address ?? '')
      .trim()
      .split(/\s+/)[0] ?? ''
  );
}

export function toBoardPlace(item) {
  const style = TYPE_STYLE[item.contentTypeId] ?? DEFAULT_STYLE;
  return {
    ...item,
    id: item.id,
    name: item.title,
    region: regionOf(item.address),
    category: item.typeName ?? '',
    imageUrl: item.image || item.thumbnail || '',
    emoji: style.emoji,
    color: style.color,
  };
}

// 보따리(지도에서 찜한 관광지, carrierStore/localStorage)를 보드 카드로 변환해서 보여준다.
// 아직 아무것도 담지 않은 신규 사용자에게는 데모용 목업 여행지를 대신 보여준다.
export async function getFavoritePlaces() {
  const { items } = carrierStore.getState();
  if (items.length) return items.map(toBoardPlace);
  return import.meta.env.VITE_USE_MOCK !== 'false' ? mockFavorites : [];
}
