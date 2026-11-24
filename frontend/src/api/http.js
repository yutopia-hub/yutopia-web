import { getItem } from '../utils/storage.js';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const SERVICE_KEY = normalizeServiceKey(import.meta.env.VITE_API_SERVICE_KEY ?? '');
const WEATHER_KEY = import.meta.env.VITE_WEATHER_KEY ?? ''; // 수정: 날씨 키 추가

// 서비스 키를 붙일 공공데이터 호스트
const PUBLIC_DATA_HOST = 'apis.data.go.kr'; // 수정

// 공공데이터포털 키는 Encoding/Decoding 두 형태로 발급된다.
// URLSearchParams가 한 번 더 인코딩하므로 Encoding 키가 들어와도 Decoding 형태로 맞춘다.
function normalizeServiceKey(key) {
  const trimmed = key.trim();
  if (!trimmed.includes('%')) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * Spring 백엔드(backend/) 주소가 설정되어 있으면 회원·보따리·여행지 API를 서버로 보낸다.
 * 비어 있으면 브라우저 목업(localStorage)으로 동작한다.
 */
export const HAS_BACKEND = /^https?:\/\//.test(BASE_URL) && !BASE_URL.includes(PUBLIC_DATA_HOST);

/** 서버가 내려 준 오류. status 로 401(로그인 만료) 등을 구분한다. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function hasServiceKey() {
  return Boolean(SERVICE_KEY);
}

function buildUrl(baseUrl, path) {
  if (/^https?:\/\//.test(path)) return new URL(path);
  const joined = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  return new URL(joined, window.location.origin);
}

/**
 * 공통 fetch 래퍼.
 * - 공공데이터포털 API(apis.data.go.kr)에만 서비스 키를 쿼리 파라미터로 붙인다.
 * - 백엔드 API(회원/인증 등)는 Authorization 헤더를 사용.
 */
export async function request(
  path,
  { method = 'GET', params = {}, body, auth = false, baseUrl = BASE_URL, signal } = {},
) {
  const url = buildUrl(baseUrl, path);

  // 수정: 공공데이터 호스트일 때만 키를 붙여 다른 서버로 키가 새지 않게 한다.
  if (SERVICE_KEY && url.hostname === PUBLIC_DATA_HOST) {
    url.searchParams.set('serviceKey', SERVICE_KEY);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  // 수정: 본문이 있을 때만 Content-Type을 붙여 불필요한 CORS 사전 요청을 피한다.
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    signal,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  // 공공데이터포털 게이트웨이 에러(키 미등록, 트래픽 초과 등)는 이 형태로 내려온다.
  const gatewayError = data?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (gatewayError) {
    throw new Error(`공공데이터 API 오류: ${gatewayError.errMsg ?? gatewayError.returnAuthMsg}`);
  }
  if (!res.ok) {
    // 백엔드는 {"message": "..."} 로 사용자용 오류 문구를 준다.
    throw new ApiError(data?.message || `API Error ${res.status}`, res.status);
  }
  if (res.status === 204 || !text) return null;
  if (data === null) {
    throw new Error('API 응답을 해석할 수 없습니다.');
  }

  return data;
}

// 수정: OpenWeatherMap 현재 날씨 (data.main.temp, data.weather[0].description, data.weather[0].icon)
export function getWeather(lat, lon) {
  return request('https://api.openweathermap.org/data/2.5/weather', {
    params: { lat, lon, appid: WEATHER_KEY, units: 'metric', lang: 'kr' },
  });
}
