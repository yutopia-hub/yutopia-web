import { loadKakaoMap } from './kakaoMap.js';

// AI 코스 추천 카테고리 → 카카오 로컬 카테고리 코드(또는 키워드 검색)
// stayMinutes: AI 응답이 없을 때 쓰는 기본 체류 시간
export const COURSE_CATEGORIES = [
  { key: 'festival', label: '축제', emoji: '🎉', keyword: '축제', stayMinutes: 90 },
  { key: 'food', label: '식당', emoji: '🍽️', code: 'FD6', stayMinutes: 60 },
  { key: 'cafe', label: '카페', emoji: '☕', code: 'CE7', stayMinutes: 40 },
  { key: 'stay', label: '숙박', emoji: '🏨', code: 'AD5', stayMinutes: 0 },
  { key: 'transit', label: '대중교통', emoji: '🚇', code: 'SW8', stayMinutes: 5 },
  { key: 'shopping', label: '쇼핑', emoji: '🛍️', code: 'MT1', keyword: '쇼핑', stayMinutes: 60 },
  { key: 'medical', label: '의료', emoji: '🏥', code: 'HP8', stayMinutes: 30 },
];

// 지역만 고르고 카테고리를 안 골라도 코스가 나오도록 관광명소를 항상 후보에 넣는다
const SIGHTS = { key: 'sight', label: '관광명소', emoji: '📸', code: 'AT4', stayMinutes: 60 };

const SEARCH_RADIUS_M = 2000;
const PER_CATEGORY = 6;

export const categoryByKey = (key) =>
  [...COURSE_CATEGORIES, SIGHTS].find((category) => category.key === key);

function promisify(call) {
  return new Promise((resolve) => {
    call((data, status) => {
      resolve(status === window.kakao.maps.services.Status.OK ? data : []);
    });
  });
}

/** "강남구 역삼동" 같은 지역명을 좌표로 바꾼다. 주소 검색 → 실패하면 키워드 검색 */
export async function geocodeRegion(region) {
  const kakao = await loadKakaoMap();
  const geocoder = new kakao.maps.services.Geocoder();
  const [address] = await promisify((done) => geocoder.addressSearch(region, done));
  if (address) {
    return { lat: Number(address.y), lng: Number(address.x), name: address.address_name };
  }
  const places = new kakao.maps.services.Places();
  const [place] = await promisify((done) => places.keywordSearch(region, done));
  if (place) return { lat: Number(place.y), lng: Number(place.x), name: place.place_name };
  throw new Error(`'${region}' 위치를 찾지 못했어요. 구·동 이름을 확인해 주세요.`);
}

function toCandidate(doc, category) {
  return {
    id: `kakao:${doc.id}`,
    title: doc.place_name,
    category: category.key,
    categoryLabel: category.label,
    emoji: category.emoji,
    typeName: doc.category_group_name || category.label,
    address: doc.road_address_name || doc.address_name,
    tel: doc.phone,
    placeUrl: doc.place_url,
    lat: Number(doc.y),
    lng: Number(doc.x),
    distanceM: Number(doc.distance) || null,
    stayMinutes: category.stayMinutes,
  };
}

/**
 * 지역 중심 반경 2km 안에서 카테고리별 후보 장소를 모은다.
 * @returns {Promise<{ center, candidates }>}
 */
export async function collectCandidates(region, categoryKeys) {
  const kakao = await loadKakaoMap();
  const center = await geocodeRegion(region);
  const places = new kakao.maps.services.Places();
  const location = new kakao.maps.LatLng(center.lat, center.lng);
  const options = {
    location,
    radius: SEARCH_RADIUS_M,
    sort: kakao.maps.services.SortBy.ACCURACY,
  };

  const categories = [SIGHTS, ...categoryKeys.map(categoryByKey).filter(Boolean)];
  const results = await Promise.all(
    categories.map(async (category) => {
      const docs = category.code
        ? await promisify((done) => places.categorySearch(category.code, done, options))
        : [];
      // 코드가 없거나(축제) 결과가 적으면 "지역 + 키워드" 로 한 번 더 찾는다
      const extra =
        category.keyword && docs.length < PER_CATEGORY
          ? await promisify((done) =>
              places.keywordSearch(`${region} ${category.keyword}`, done, options),
            )
          : [];
      return [...docs, ...extra].slice(0, PER_CATEGORY).map((doc) => toCandidate(doc, category));
    }),
  );

  // 같은 장소가 여러 카테고리에 걸리면 처음 것만 남긴다
  const seen = new Set();
  const candidates = results.flat().filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
  if (!candidates.length) throw new Error('주변에서 추천할 장소를 찾지 못했어요.');
  return { center, candidates };
}
