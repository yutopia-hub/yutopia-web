import { escapeHtml } from '../utils/format.js';
import { t } from '../i18n/i18n.js';
import '../styles/weather-scene.css';

// 현재 날씨를 애니메이션 장면으로 보여 준다. 날씨 종류(kind)마다 하늘색과 움직이는 요소가 다르다.
//   clear: 해(회전하는 햇살) / 밤이면 달+별     cloudy·overcast: 흘러가는 구름
//   rain: 빗방울 + 먹구름     thunder: 비 + 번쩍임     snow: 눈송이     fog: 겹겹이 흐르는 안개

export const WEATHER_META = {
  clear: { icon: '☀️', night: '🌙', label: '맑음' },
  cloudy: { icon: '⛅', night: '☁️', label: '구름 조금' },
  overcast: { icon: '☁️', night: '☁️', label: '흐림' },
  fog: { icon: '🌫️', night: '🌫️', label: '안개' },
  rain: { icon: '🌧️', night: '🌧️', label: '비' },
  snow: { icon: '❄️', night: '❄️', label: '눈' },
  thunder: { icon: '⛈️', night: '⛈️', label: '천둥번개' },
};

export const weatherIcon = (kind, isNight = false) => {
  const meta = WEATHER_META[kind] ?? WEATHER_META.clear;
  return isNight ? meta.night : meta.icon;
};

export const weatherLabel = (kind) => t((WEATHER_META[kind] ?? WEATHER_META.clear).label);

// 렌더마다 모양이 바뀌지 않도록 시드 고정 난수를 쓴다
function seeded(seed) {
  let x = seed;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

function particles(count, make) {
  const rand = seeded(42);
  return Array.from({ length: count }, (_, i) => make(i, rand)).join('');
}

function layers(kind, isNight) {
  const clouds = (n) =>
    particles(
      n,
      (i, r) =>
        `<i class="ws-cloud" style="--top:${8 + i * 14}%;--size:${5 + r() * 4}rem;--dur:${26 + r() * 22}s;--delay:${-r() * 30}s;--op:${0.55 + r() * 0.35}"></i>`,
    );
  const drops = (n, cls = 'ws-drop') =>
    particles(
      n,
      (_, r) =>
        `<i class="${cls}" style="--x:${r() * 100}%;--dur:${0.55 + r() * 0.5}s;--delay:${-r() * 1.5}s;--len:${0.7 + r() * 0.8}rem"></i>`,
    );
  const flakes = (n) =>
    particles(
      n,
      (_, r) =>
        `<i class="ws-flake" style="--x:${r() * 100}%;--size:${0.25 + r() * 0.4}rem;--dur:${4 + r() * 4}s;--delay:${-r() * 8}s;--sway:${0.6 + r() * 1.2}rem"></i>`,
    );
  const stars = particles(
    16,
    (_, r) =>
      `<i class="ws-star" style="--x:${r() * 100}%;--y:${r() * 60}%;--dur:${1.5 + r() * 2}s;--delay:${-r() * 3}s"></i>`,
  );

  switch (kind) {
    case 'rain':
      return clouds(2) + drops(34);
    case 'thunder':
      return `${clouds(3)}${drops(40)}<i class="ws-flash"></i>`;
    case 'snow':
      return clouds(1) + flakes(30);
    case 'fog':
      return `<i class="ws-fog" style="--top:25%;--dur:18s"></i><i class="ws-fog" style="--top:48%;--dur:26s;--delay:-9s"></i><i class="ws-fog" style="--top:70%;--dur:22s;--delay:-4s"></i>`;
    case 'overcast':
      return clouds(4);
    case 'cloudy':
      return (isNight ? `<i class="ws-moon"></i>${stars}` : '<i class="ws-sun"></i>') + clouds(2);
    default:
      return isNight ? `<i class="ws-moon"></i>${stars}` : '<i class="ws-sun"></i>';
  }
}

/**
 * @param {{ kind: string, isNight?: boolean, temperature: number, feelsLike?: number,
 *           humidity?: number|null, windSpeed?: number, description?: string, place?: string }} weather
 * @param {{ reason?: string, regionName?: string }} [extra]
 */
export function weatherSceneHtml(weather, { reason = '', regionName = '' } = {}) {
  const kind = WEATHER_META[weather.kind] ? weather.kind : 'clear';
  const night = Boolean(weather.isNight);
  const feels = Math.round(weather.feelsLike ?? weather.temperature);
  const facts = [
    `${t('체감')} ${feels}°`,
    weather.humidity != null ? `${t('습도')} ${weather.humidity}%` : '',
    `${t('바람')} ${(weather.windSpeed ?? 0).toFixed(1)}m/s`,
  ].filter(Boolean);

  return `
    <section class="ws" data-kind="${kind}" data-night="${night}" aria-label="${t('현재 날씨')}">
      <div class="ws-sky" aria-hidden="true">${layers(kind, night)}</div>
      <div class="ws-info">
        <span class="ws-where">📍 ${escapeHtml(regionName || weather.place || '')}</span>
        <div class="ws-main">
          <strong class="ws-temp">${Math.round(weather.temperature)}°</strong>
          <span class="ws-label">${weatherIcon(kind, night)} ${escapeHtml(weatherLabel(kind))}</span>
        </div>
        <span class="ws-facts">${facts.join(' · ')}</span>
      </div>
      ${reason ? `<p class="ws-reason">${escapeHtml(t(reason))}</p>` : ''}
    </section>
  `;
}
