import { createStore } from './store.js';
import { getItem, setItem } from '../utils/storage.js';

// 보따리 = 사용자가 지도에서 찜한 관광지 목록. 보드판 등 다른 페이지에서 꺼내 쓴다.
// localStorage 에 저장한다 (새로고침해도 유지). 로그인 + 백엔드 연결 시 api/carrierSyncApi.js 가 서버 찜과 동기화한다.
export const carrierStore = createStore({ items: getItem('carrier', []) });

function save(items) {
  setItem('carrier', items);
  carrierStore.setState({ items });
}

export function isInCarrier(placeId) {
  return carrierStore.getState().items.some((item) => item.id === placeId);
}

export function addToCarrier(place) {
  if (isInCarrier(place.id)) return;
  const item = {
    id: place.id,
    contentTypeId: place.contentTypeId,
    typeName: place.typeName,
    title: place.title,
    address: place.address,
    image: place.image,
    thumbnail: place.thumbnail,
    lat: place.lat,
    lng: place.lng,
    ...(place.placeUrl ? { placeUrl: place.placeUrl } : {}),
    cat1: place.cat1,
    cat2: place.cat2,
    cat3: place.cat3,
    areaCode: place.areaCode,
    tags: Array.isArray(place.tags) ? [...place.tags] : [],
    setting: place.setting,
    airConditioned: place.airConditioned,
    memo: '',
    addedAt: new Date().toISOString(),
  };
  save([...carrierStore.getState().items, item]);
}

/** 여러 장소를 한 번에 담는다 (AI 추천 코스). 이미 담긴 곳은 건너뛰고, 새로 담은 개수를 돌려준다. */
export function addManyToCarrier(places) {
  const before = carrierStore.getState().items.length;
  places.forEach(addToCarrier);
  return carrierStore.getState().items.length - before;
}

export function updateCarrierMemo(placeId, memo) {
  save(
    carrierStore
      .getState()
      .items.map((item) => (item.id === placeId ? { ...item, memo: memo.trim() } : item)),
  );
}

export function removeFromCarrier(placeId) {
  save(carrierStore.getState().items.filter((item) => item.id !== placeId));
}

/** 서버 동기화 결과로 목록 전체를 교체한다 (carrierSyncApi 전용). */
export function replaceCarrier(items) {
  save(items);
}

export function clearCarrier() {
  save([]);
}

export function toggleCarrier(place) {
  if (isInCarrier(place.id)) {
    removeFromCarrier(place.id);
    return false;
  }
  addToCarrier(place);
  return true;
}
