const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export function weatherKind(code, precipitation = 0, snowfall = 0, cloudCover = 0) {
  if ([71, 73, 75, 77, 85, 86].includes(code) || snowfall > 0) return 'snow';
  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99].includes(code) ||
    precipitation > 0
  )
    return 'rain';
  if ([45, 48].includes(code)) return 'fog';
  if (code === 3 || cloudCover >= 85) return 'overcast';
  if (code === 2 || cloudCover >= 35) return 'cloudy';
  return 'clear';
}

export function normalizeWeather(data) {
  const current = data.current;
  if (
    !current ||
    !Number.isFinite(current.time) ||
    !Number.isFinite(current.weather_code) ||
    !Number.isFinite(current.temperature_2m)
  ) {
    throw new Error('날씨 응답을 확인할 수 없습니다.');
  }
  const timezone = data.timezone || 'Asia/Seoul';
  // Validate before this identifier is passed to the clock formatter.
  new Intl.DateTimeFormat('ko-KR', { timeZone: timezone }).format();
  return {
    kind: weatherKind(
      current.weather_code,
      current.precipitation,
      current.snowfall,
      current.cloud_cover,
    ),
    temperature: current.temperature_2m,
    windSpeed: Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : null,
    precipitation: current.precipitation ?? 0,
    cloudCover: current.cloud_cover ?? 0,
    observedAt: current.time * 1000,
    timezone,
    solarDays: (data.daily?.sunrise ?? []).map((sunrise, i) => ({
      sunrise: sunrise * 1000,
      sunset: data.daily.sunset[i] * 1000,
    })),
  };
}

// Separate flag: favorites can be mocked while the environment still uses live weather.
export async function getCurrentWeather({ latitude, longitude }, { signal } = {}) {
  if (import.meta.env?.VITE_WEATHER_USE_MOCK === 'true') {
    return {
      kind: 'clear',
      temperature: 22,
      windSpeed: 5,
      precipitation: 0,
      cloudCover: 10,
      observedAt: Date.now(),
      timezone: 'Asia/Seoul',
      solarDays: [],
      isMock: true,
    };
  }
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,precipitation,snowfall,weather_code,cloud_cover,is_day,wind_speed_10m',
    wind_speed_unit: 'kmh',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '2',
  }).toString();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 10000);
  try {
    // Do not use the public-data request wrapper: its service key belongs to a different host.
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('날씨 정보를 가져오지 못했습니다.');
    return normalizeWeather(await response.json());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
