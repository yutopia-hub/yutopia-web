import { getCurrentWeather } from './weatherApi.js';

// 지역의 현재 날씨. 서버(/api/weather)의 OpenWeatherMap 을 먼저 쓰고,
// 키가 없거나 실패하면 기존 Open-Meteo(weatherApi.js)로 대신한다.

async function fromOpenWeatherMap({ lat, lng }) {
  const response = await fetch('/api/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `날씨 서버 오류 (${response.status})`);
  return data;
}

async function fromOpenMeteo({ lat, lng }) {
  const weather = await getCurrentWeather({ latitude: lat, longitude: lng });
  return {
    kind: weather.kind,
    isNight: false,
    temperature: weather.temperature,
    feelsLike: weather.temperature,
    humidity: null,
    windSpeed: 0,
    description: '',
    place: '',
    observedAt: weather.observedAt,
    source: 'open-meteo',
  };
}

export async function fetchCourseWeather(position) {
  try {
    return await fromOpenWeatherMap(position);
  } catch {
    return fromOpenMeteo(position);
  }
}
