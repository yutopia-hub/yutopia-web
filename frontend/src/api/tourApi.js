import { request, hasServiceKey, HAS_BACKEND } from './http.js';
import * as mock from './mock/mockTour.js';
import {
  getContentTypeName,
  toPlainText,
  licensedImage,
  extractHomepage,
  buildIntro,
  buildInfo,
  buildPetInfo,
} from './tourFields.js';

// 한국관광공사_국문 관광정보 서비스_GW (https://www.data.go.kr/data/15101578/openapi.do)
const TOUR_BASE_URL = 'https://apis.data.go.kr/B551011/KorService2';
const COMMON_PARAMS = { MobileOS: 'ETC', MobileApp: 'Yutopia', _type: 'json' };

/**
 * 관광정보 출처 우선순위
 *   1) VITE_USE_MOCK=true          → 목업
 *   2) VITE_API_SERVICE_KEY 있음   → TourAPI 직접 호출 (전국 데이터)
 *   3) VITE_API_BASE_URL 있음      → Spring 백엔드 /api/places (DB 에 적재한 데이터)
 *   4) 그 외                       → 목업
 */
export const TOUR_SOURCE =
  import.meta.env.VITE_USE_MOCK === 'true'
    ? 'mock'
    : hasServiceKey()
      ? 'tourapi'
      : HAS_BACKEND
        ? 'backend'
        : 'mock';
export const IS_TOUR_MOCK = TOUR_SOURCE === 'mock';
const IS_BACKEND = TOUR_SOURCE === 'backend';

// ---- Spring 백엔드 출처 ----
// 백엔드 응답은 이미 normalizePlace() 와 같은 필드 이름이라 typeName 만 채운다.
function fromBackend(place) {
  return {
    ...place,
    id: String(place.id),
    contentTypeId: place.contentTypeId ?? '',
    typeName: getContentTypeName(place.contentTypeId),
    address: place.address ?? '',
    tel: place.tel ?? '',
    image: place.image ?? '',
    thumbnail: place.thumbnail || place.image || '',
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    cat1: place.cat1 ?? '',
    cat2: place.cat2 ?? '',
    cat3: place.cat3 ?? '',
    areaCode: place.areaCode ?? '',
    tags: place.tags ?? [],
  };
}

const detailCache = new Map();
function backendDetail(id) {
  const key = String(id);
  if (!detailCache.has(key)) {
    const pending = request(`/api/places/${encodeURIComponent(key)}`).catch((error) => {
      detailCache.delete(key);
      throw error;
    });
    detailCache.set(key, pending);
  }
  return detailCache.get(key);
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function callTour(operation, params, { signal } = {}) {
  const data = await request(operation, {
    baseUrl: TOUR_BASE_URL,
    params: { ...COMMON_PARAMS, ...params },
    signal,
  });
  const header = data?.response?.header;
  if (header && header.resultCode !== '0000') {
    throw new Error(header.resultMsg || '관광정보를 불러오지 못했습니다.');
  }
  return toArray(data?.response?.body?.items?.item);
}

export function hasPosition(place) {
  return place.lat !== null && place.lng !== null;
}

function toCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : null;
}

function normalizePlace(item) {
  return {
    id: String(item.contentid),
    contentTypeId: String(item.contenttypeid),
    typeName: getContentTypeName(item.contenttypeid),
    title: toPlainText(item.title),
    address: toPlainText([item.addr1, item.addr2].filter(Boolean).join(' ')),
    tel: toPlainText(item.tel),
    image: licensedImage(item.firstimage, item.cpyrhtDivCd),
    thumbnail: licensedImage(item.firstimage2 || item.firstimage, item.cpyrhtDivCd),
    lat: toCoordinate(item.mapy),
    lng: toCoordinate(item.mapx),
    cat1: item.cat1 || '',
    cat2: item.cat2 || '',
    cat3: item.cat3 || '',
    areaCode: item.areacode || '',
  };
}

export async function searchPlaces(keyword, { pageNo = 1, numOfRows = 30 } = {}) {
  if (IS_BACKEND) {
    const items = await request('/api/places', {
      params: { keyword, page: pageNo, size: numOfRows },
    });
    return items.map(fromBackend);
  }
  const items = IS_TOUR_MOCK
    ? mock.searchKeyword(keyword)
    : await callTour('searchKeyword2', { keyword, arrange: 'A', pageNo, numOfRows });
  return items.map(normalizePlace);
}

// Nationwide discovery: no keyword or carrier restriction. Area codes come from TourAPI.
export async function getTourAreas({ signal } = {}) {
  if (IS_TOUR_MOCK) return [{ code: 'mock', name: '전국 예시 여행지' }];
  if (IS_BACKEND) return request('/api/areas', { signal });
  const items = await callTour('areaCode2', { numOfRows: 100, pageNo: 1 }, { signal });
  return items
    .filter((item) => item.code != null)
    .map((item) => ({ code: String(item.code), name: toPlainText(item.name) }));
}

export async function listTourPlaces({ areaCode, pageNo = 1, numOfRows = 24, signal } = {}) {
  if (IS_BACKEND) {
    const items = await request('/api/places', {
      params: { areaCode, page: pageNo, size: numOfRows },
      signal,
    });
    return items.map(fromBackend);
  }
  const items = IS_TOUR_MOCK
    ? mock.searchKeyword('').slice((pageNo - 1) * numOfRows, pageNo * numOfRows)
    : await callTour('areaBasedList2', { areaCode, pageNo, numOfRows, arrange: 'R' }, { signal });
  return items.map(normalizePlace);
}

export async function getPlaceDetail(contentId) {
  if (IS_BACKEND) {
    const detail = await backendDetail(contentId);
    return {
      ...fromBackend(detail),
      overview: toPlainText(detail.overview),
      homepage: extractHomepage(detail.homepage),
    };
  }
  const [item] = IS_TOUR_MOCK
    ? mock.detailCommon(contentId)
    : await callTour('detailCommon2', { contentId });
  if (!item) throw new Error('관광지 정보를 찾을 수 없습니다.');

  return {
    ...normalizePlace(item),
    overview: toPlainText(item.overview),
    homepage: extractHomepage(item.homepage),
  };
}

export async function getPlaceIntro(contentId, contentTypeId) {
  if (IS_BACKEND) return buildIntro(contentTypeId, (await backendDetail(contentId)).intro ?? {});
  const [item] = IS_TOUR_MOCK
    ? mock.detailIntro(contentId)
    : await callTour('detailIntro2', { contentId, contentTypeId });
  return buildIntro(contentTypeId, item);
}

export async function getPlaceInfo(contentId, contentTypeId) {
  if (IS_BACKEND) return buildInfo(contentTypeId, []); // 반복 정보(detailInfo)는 DB 에 적재하지 않는다
  const items = IS_TOUR_MOCK
    ? mock.detailInfo(contentId)
    : await callTour('detailInfo2', { contentId, contentTypeId });
  return buildInfo(contentTypeId, items);
}

export async function getPlaceImages(contentId) {
  if (IS_BACKEND) return (await backendDetail(contentId)).images ?? [];
  const items = IS_TOUR_MOCK
    ? mock.detailImage(contentId)
    : await callTour('detailImage2', { contentId, imageYN: 'Y' });

  return items
    .map((item) => ({
      url: licensedImage(item.originimgurl, item.cpyrhtDivCd),
      thumbnail: licensedImage(item.smallimageurl || item.originimgurl, item.cpyrhtDivCd),
      name: toPlainText(item.imgname),
    }))
    .filter((image) => image.url);
}

export async function getPetInfo(contentId) {
  if (IS_BACKEND) return buildPetInfo((await backendDetail(contentId)).intro ?? {});
  const [item] = IS_TOUR_MOCK
    ? mock.detailPetTour(contentId)
    : await callTour('detailPetTour2', { contentId });
  return buildPetInfo(item);
}
