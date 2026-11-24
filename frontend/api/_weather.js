// OpenWeatherMap 현재 날씨 (AI 코스 추천의 날씨 반영용). 키는 서버에서만 읽는다.
import { httpError } from './_http.js';

const ENDPOINT = 'https://api.openweathermap.org/data/2.5/weather';

/** OpenWeatherMap 날씨 코드 → 앱에서 쓰는 날씨 종류 */
export function kindFromOwm(id) {
  if (id >= 200 && id < 300) return 'thunder';
  if (id >= 300 && id < 600) return 'rain'; // 이슬비(3xx) + 비(5xx)
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) return 'fog'; // 안개·연무·황사 등
  if (id === 800) return 'clear';
  if (id === 801 || id === 802) return 'cloudy';
  return 'overcast'; // 803, 804
}

export async function fetchOwmWeather({ lat, lng }, apiKey) {
  if (!apiKey) throw httpError(503, 'WEATHER_KEY(VITE_WEATHER_KEY) 가 설정되지 않았습니다.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw httpError(400, '좌표가 잘못됐습니다.');

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: apiKey,
    units: 'metric',
    lang: 'kr',
  }).toString();

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw httpError(502, `날씨 요청 실패 (${response.status})`);
  const data = await response.json();
  const condition = data.weather?.[0];
  if (!condition || !Number.isFinite(data.main?.temp))
    throw httpError(502, '날씨 응답을 확인할 수 없습니다.');

  return {
    kind: kindFromOwm(condition.id),
    isNight: String(condition.icon ?? '').endsWith('n'),
    temperature: data.main.temp,
    feelsLike: data.main.feels_like ?? data.main.temp,
    humidity: data.main.humidity ?? null,
    windSpeed: data.wind?.speed ?? 0,
    description: condition.description ?? '',
    place: data.name ?? '',
    observedAt: (data.dt ?? Math.floor(Date.now() / 1000)) * 1000,
    source: 'openweathermap',
  };
}

export const handleWeatherBody = (body, apiKey) => fetchOwmWeather(body ?? {}, apiKey);
