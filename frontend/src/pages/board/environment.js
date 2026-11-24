import { getCurrentWeather } from '../../api/weatherApi.js';
import { timeOfDay } from './environment-time.js';
import { pts } from './config.js';

const WEATHER = {
  clear: ['☀️', '맑음'],
  cloudy: ['🌤️', '구름 많음'],
  overcast: ['☁️', '흐림'],
  fog: ['🌫️', '안개'],
  rain: ['🌧️', '비'],
  snow: ['🌨️', '눈'],
};
const PERIOD = { morning: '아침', day: '낮', evening: '저녁', night: '밤' };

export function drawWeatherEffects(ctx) {
  const weatherSvg = ctx.$('weather-effects');
  const rain = ctx.el('g', { class: 'weather-rain' }, weatherSvg);
  const snow = ctx.el('g', { class: 'weather-snow' }, weatherSvg);
  ctx.el(
    'path',
    {
      d: 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L') + ' Z',
      fill: 'none',
      stroke: '#fff',
      'stroke-width': 4,
      'stroke-dasharray': '16 22',
      opacity: 0.7,
    },
    snow,
  );
  for (let i = 0; i < 32; i++) {
    const x = 80 + ((i * 137) % 840),
      y = (i * 83) % 620;
    const drop = ctx.el(
      'path',
      {
        d: `M${x} ${y} l-5 18`,
        class: 'rain-drop',
        fill: 'none',
        stroke: '#d4eef6',
        'stroke-width': 1.2,
      },
      rain,
    );
    drop.style.animationDelay = -(i % 9) * 0.17 + 's';
  }
  for (let i = 0; i < 24; i++) {
    const flake = ctx.el(
      'circle',
      {
        cx: 75 + ((i * 151) % 850),
        cy: (i * 97) % 600,
        r: i % 3 === 0 ? 2.5 : 1.6,
        class: 'snow-flake',
        fill: '#fff',
      },
      snow,
    );
    flake.style.animationDelay = -i * 0.7 + 's';
    flake.style.animationDuration = 8 + (i % 5) + 's';
  }
  const wet = ctx.el('g', { class: 'weather-wet' }, weatherSvg);
  ctx.el(
    'path',
    {
      d: 'M' + pts.map((p) => `${p.x} ${p.y}`).join(' L') + ' Z',
      fill: 'none',
      stroke: '#c3e9f1',
      'stroke-width': 5,
      opacity: 0.5,
    },
    wet,
  );
  for (const [x, y] of [
    [290, 410],
    [720, 390],
    [500, 435],
  ]) {
    ctx.el('ellipse', { cx: x, cy: y, rx: 15, ry: 4, fill: '#c4e6ee', opacity: 0.6 }, wet);
    ctx.el(
      'ellipse',
      {
        cx: x,
        cy: y,
        rx: 9,
        ry: 2,
        fill: 'none',
        stroke: '#fff',
        'stroke-width': 1,
        class: 'rain-ripple',
      },
      wet,
    );
  }
}

export function bindEnvironment(ctx, state) {
  drawWeatherEffects(ctx);
  let coordinates = { latitude: 37.5665, longitude: 126.978 };
  let request = null,
    version = 0;
  const formatTime = (date, timezone) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  function renderEnvironment(value) {
    const environment = value.environment;
    const weather = environment.weather;
    const now = Date.now();
    const period = timeOfDay(now, weather);
    ctx.root.dataset.time = period;
    ctx.root.dataset.weather = weather?.kind ?? 'unavailable';
    ctx.$('clock').textContent = formatTime(now, weather?.timezone);
    const [icon, label] = WEATHER[weather?.kind] ?? ['◌', '날씨 확인 중'];
    ctx.$('weather-icon').textContent =
      period === 'night' && weather?.kind === 'clear' ? '🌙' : icon;
    ctx.$('weather-summary').textContent =
      `${PERIOD[period]} · ${weather ? label + ' ' + Math.round(weather.temperature) + '°' : environment.status === 'error' ? '날씨 정보 없음' : label}`;
    ctx.$('weather-location').textContent = environment.location;
    ctx.$('weather-update').textContent =
      environment.note ||
      (weather
        ? `${weather.isMock ? '데모 · ' : ''}${formatTime(weather.observedAt, weather.timezone)} 날씨 기준`
        : '현재 시간은 기기 시계 기준');
    ctx.$('locate').disabled = environment.locating;
    ctx.$('locate').textContent = environment.locating ? '위치 확인 중…' : '현재 위치 사용';
    ctx.$('weather-refresh').disabled = environment.status === 'loading';
  }
  const unsubscribe = state.subscribe(renderEnvironment);
  renderEnvironment(state.get());
  async function refresh() {
    const current = ++version;
    request?.abort();
    request = new AbortController();
    state.environment({ status: 'loading', note: '' });
    try {
      const weather = await getCurrentWeather(coordinates, { signal: request.signal });
      if (ctx.signal.aborted || current !== version) return;
      state.environment({ weather, status: 'loaded', note: '' });
    } catch {
      if (ctx.signal.aborted || current !== version) return;
      state.environment({
        status: 'error',
        note: state.get().environment.weather
          ? '업데이트 지연 · 마지막 날씨 유지'
          : '날씨 연결 실패 · 다시 시도해 주세요',
      });
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      state.environment({ note: '현재 위치를 지원하지 않아 서울 기준으로 표시합니다.' });
      return;
    }
    state.environment({ locating: true, note: '' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (ctx.signal.aborted) return;
        coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        // Avoid showing the previous city's conditions under the new location label.
        state.environment({ weather: null, location: '현재 위치', locating: false });
        refresh();
      },
      () => {
        if (!ctx.signal.aborted)
          state.environment({
            locating: false,
            note: '위치를 확인할 수 없어 기존 지역을 유지합니다.',
          });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  ctx.on(ctx.$('locate'), 'click', locate);
  ctx.on(ctx.$('weather-refresh'), 'click', refresh);
  ctx.on(document, 'visibilitychange', () => {
    if (document.hidden) return;
    renderEnvironment(state.get());
    const last = state.get().environment.weather?.observedAt ?? 0;
    if (Date.now() - last > 15 * 60000) refresh();
  });
  const clockTimer = setInterval(() => {
    if (!document.hidden) renderEnvironment(state.get());
  }, 30000);
  const weatherTimer = setInterval(() => {
    if (!document.hidden) refresh();
  }, 15 * 60000);
  ctx.signal.addEventListener(
    'abort',
    () => {
      ++version;
      request?.abort();
      unsubscribe();
      clearInterval(clockTimer);
      clearInterval(weatherTimer);
    },
    { once: true },
  );
  refresh();
  // Already granted locations can load automatically; otherwise the button opens the browser's prompt.
  navigator.permissions
    ?.query({ name: 'geolocation' })
    .then((permission) => {
      if (!ctx.signal.aborted && permission.state === 'granted') locate();
    })
    .catch(() => {});
}
