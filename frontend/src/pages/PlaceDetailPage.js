import { t, getLang } from '../i18n/i18n.js';
import {
  getPlaceDetail,
  getPlaceIntro,
  getPlaceInfo,
  getPlaceImages,
  getPetInfo,
  hasPosition,
  IS_TOUR_MOCK,
} from '../api/tourApi.js';
import { getCurrentWeather } from '../api/weatherApi.js';
import { hasKakaoKey, loadKakaoMap, keepMapFitted } from '../api/kakaoMap.js';
import { mapStore } from '../store/mapStore.js';
import { carrierStore, isInCarrier, toggleCarrier } from '../store/carrierStore.js';
import { escapeHtml, nl2br } from '../utils/format.js';
import { on } from '../utils/dom.js';
import '../styles/place-detail.css';

// 지금 화면에 떠 있는 상세 페이지. 빠르게 다른 페이지로 넘어가면 늦게 온 응답은 버린다.
let activeRender = null;

function backHref() {
  const { lastKeyword } = mapStore.getState();
  return lastKeyword ? `#/map?keyword=${encodeURIComponent(lastKeyword)}` : '#/map';
}

export async function PlaceDetailPage({ id }) {
  let place;
  try {
    place = await getPlaceDetail(id);
  } catch (err) {
    return `
      <section class="card">
        <a href="${escapeHtml(backHref())}">&larr; ${t('지도로 돌아가기')}</a>
        <p class="error">${escapeHtml(err.message)}</p>
      </section>
    `;
  }

  const render = { place };
  activeRender = render;
  setTimeout(() => loadSections(render), 0);

  return `
    <article class="place-detail">
      <a class="place-detail__back" href="${escapeHtml(backHref())}">&larr; ${t('지도로 돌아가기')}</a>

      <header class="place-detail__hero">
        <div class="place-gallery" data-section="gallery">
          <div class="place-gallery__main">${mainImageHtml(place.image, place.title)}</div>
          <div class="place-gallery__thumbs"></div>
        </div>

        <div class="place-detail__heading">
          <div class="place-detail__chips">
            <span class="chip">${escapeHtml(place.typeName)}</span>
            ${IS_TOUR_MOCK ? `<span class="chip chip--muted">${t('목업 데이터')}</span>` : ''}
          </div>
          <h1>${escapeHtml(place.title)}</h1>
          ${place.address ? `<p class="place-detail__address">${escapeHtml(place.address)}</p>` : ''}
          <div class="place-detail__links">
            <span data-section="carry">${carryButtonHtml(place.id)}</span>
            ${linksHtml(place)}
          </div>
          <section class="weather-card" data-section="weather">
            <h2>${t('지금 날씨')}</h2>
            <p class="muted">${t('불러오는 중...')}</p>
          </section>
        </div>
      </header>

      <div class="place-detail__grid">
        ${
          place.overview
            ? `<section class="card place-detail__wide">
                <h2>${t('소개')}</h2>
                <p class="place-detail__text">${nl2br(place.overview)}</p>
              </section>`
            : ''
        }
        <section class="card" data-section="intro">
          <h2>${t('이용 안내')}</h2>
          <p class="muted">${t('불러오는 중...')}</p>
        </section>
        <section class="card" data-section="info" hidden></section>
        <section class="card" data-section="pet" hidden></section>
        <section class="card place-detail__wide">
          <h2>${t('위치')}</h2>
          ${place.address ? `<p class="muted">${escapeHtml(place.address)}</p>` : ''}
          <div class="place-detail__map" data-section="map"></div>
        </section>
      </div>
    </article>
  `;
}

function mainImageHtml(url, title) {
  return url
    ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(title)}" />`
    : `<div class="place-gallery__fallback">${escapeHtml(title.charAt(0))}</div>`;
}

function carryButtonHtml(placeId) {
  const carried = isInCarrier(placeId);
  return `
    <button type="button" class="btn place-detail__carry${carried ? ' is-carried' : ''}" data-action="carry" aria-pressed="${carried}">
      ${carried ? t('보따리에서 빼기') : t('보따리에 담기')}
    </button>
  `;
}

function linksHtml(place) {
  const links = [];
  const telNumber = place.tel.replace(/[^\d+-]/g, '');
  if (telNumber) {
    links.push(
      `<a class="btn" href="tel:${escapeHtml(telNumber)}">${t('전화 {tel}', { tel: escapeHtml(place.tel) })}</a>`,
    );
  }
  if (place.homepage) {
    links.push(
      `<a class="btn" href="${escapeHtml(place.homepage)}" target="_blank" rel="noopener noreferrer">${t('홈페이지')}</a>`,
    );
  }
  if (hasPosition(place)) {
    const to = `https://map.kakao.com/link/to/${encodeURIComponent(place.title)},${place.lat},${place.lng}`;
    links.push(
      `<a class="btn" href="${escapeHtml(to)}" target="_blank" rel="noopener noreferrer">${t('카카오맵 길찾기')}</a>`,
    );
  }
  return links.join('');
}

function fieldListHtml(fields) {
  return `
    <dl class="field-list">
      ${fields
        .map(
          ({ label, value }) => `<div><dt>${escapeHtml(label)}</dt><dd>${nl2br(value)}</dd></div>`,
        )
        .join('')}
    </dl>
  `;
}

async function loadSections(render) {
  const root = document.querySelector('.place-detail');
  if (!root || activeRender !== render) return;

  const alive = () => activeRender === render && root.isConnected;
  const section = (name) => root.querySelector(`[data-section="${name}"]`);
  const { place } = render;

  bindCarry(place, section('carry'), alive);

  await Promise.all([
    fillWeather(place, section('weather'), alive),
    fillIntro(place, section('intro'), alive),
    fillInfo(place, section('info'), alive),
    fillPet(place, section('pet'), alive),
    fillGallery(place, section('gallery'), alive),
    fillMap(place, section('map'), alive),
  ]);
}

function bindCarry(place, el, alive) {
  on(el, 'click', '[data-action="carry"]', () => toggleCarrier(place));
  const unsubscribe = carrierStore.subscribe(() => {
    if (!alive()) {
      unsubscribe();
      return;
    }
    el.innerHTML = carryButtonHtml(place.id);
  });
}

function formatValue(value, unit) {
  return value === null || value === undefined ? '-' : `${value}${unit}`;
}

// weatherApi(Open-Meteo)가 주는 날씨 종류 → 아이콘/문구
const WEATHER_LABELS = {
  clear: ['☀️', '맑음'],
  cloudy: ['⛅', '구름 조금'],
  overcast: ['☁️', '흐림'],
  fog: ['🌫️', '안개'],
  rain: ['🌧️', '비'],
  snow: ['❄️', '눈'],
};

function formatObservedAt(time, timezone) {
  return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
}

async function fillWeather(place, el, alive) {
  const shell = (body) => `<h2>${t('지금 날씨')}</h2>${body}`;
  if (!hasPosition(place)) {
    el.innerHTML = shell(`<p class="muted">${t('위치 정보가 없어 날씨를 불러올 수 없어요.')}</p>`);
    return;
  }

  try {
    const weather = await getCurrentWeather({ latitude: place.lat, longitude: place.lng });
    if (!alive()) return;

    const [icon, label] = WEATHER_LABELS[weather.kind] ?? WEATHER_LABELS.clear;
    const time = formatObservedAt(weather.observedAt, weather.timezone);
    el.innerHTML = `
      <div class="weather-card__head">
        <h2>${t('지금 날씨')}</h2>
        <span class="muted">${t('{time} 기준 · Open-Meteo', { time: escapeHtml(time) })}${weather.isMock ? t(' (목업)') : ''}</span>
      </div>
      <div class="weather-card__now">
        <span class="weather-card__icon" aria-hidden="true">${icon}</span>
        <strong>${formatValue(Math.round(weather.temperature), '°')}</strong>
        <span>${t(label)}</span>
      </div>
      <dl class="weather-card__facts">
        <div><dt>${t('강수량')}</dt><dd>${formatValue(weather.precipitation, 'mm')}</dd></div>
        <div><dt>${t('구름')}</dt><dd>${formatValue(weather.cloudCover, '%')}</dd></div>
      </dl>
    `;
  } catch (err) {
    if (alive()) {
      el.innerHTML = shell(
        `<p class="muted">${t('날씨 정보를 불러오지 못했어요. ({message})', { message: escapeHtml(err.message) })}</p>`,
      );
    }
  }
}

async function fillIntro(place, el, alive) {
  try {
    const { fields } = await getPlaceIntro(place.id, place.contentTypeId);
    if (!alive()) return;
    el.innerHTML = `
      <h2>${t('이용 안내')}</h2>
      ${fields.length ? fieldListHtml(fields) : `<p class="muted">${t('등록된 이용 안내가 없어요.')}</p>`}
    `;
  } catch {
    if (alive())
      el.innerHTML = `<h2>${t('이용 안내')}</h2><p class="muted">${t('이용 안내를 불러오지 못했어요.')}</p>`;
  }
}

async function fillInfo(place, el, alive) {
  try {
    const items = await getPlaceInfo(place.id, place.contentTypeId);
    if (!alive() || !items.length) return;
    const title = place.contentTypeId === '32' ? t('객실 정보') : t('추가 정보');
    el.innerHTML = `
      <h2>${title}</h2>
      ${fieldListHtml(items.map((item) => ({ label: item.title, value: item.text })))}
    `;
    el.hidden = false;
  } catch {
    // 부가 정보라 실패하면 섹션을 숨긴 채로 둔다.
  }
}

async function fillPet(place, el, alive) {
  try {
    const fields = await getPetInfo(place.id);
    if (!alive() || !fields.length) return;
    el.innerHTML = `<h2>${t('반려동물 동반 여행')}</h2>${fieldListHtml(fields)}`;
    el.hidden = false;
  } catch {
    // 반려동물 정보가 없는 관광지가 대부분이라 실패해도 숨긴 채로 둔다.
  }
}

async function fillGallery(place, el, alive) {
  let images = [];
  try {
    images = await getPlaceImages(place.id);
  } catch {
    images = [];
  }
  if (!alive()) return;

  const all = [];
  if (place.image) all.push({ url: place.image, thumbnail: place.thumbnail || place.image });
  images.forEach((image) => {
    if (!all.some((item) => item.url === image.url)) all.push(image);
  });
  if (!all.length) return;

  const main = el.querySelector('.place-gallery__main');
  if (!place.image) main.innerHTML = mainImageHtml(all[0].url, place.title);
  if (all.length < 2) return;

  const thumbs = el.querySelector('.place-gallery__thumbs');
  thumbs.innerHTML = all
    .map(
      (image, index) => `
        <button type="button" class="${index === 0 ? 'is-active' : ''}" data-src="${escapeHtml(image.url)}" aria-label="${t('사진 {n}', { n: index + 1 })}">
          <img src="${escapeHtml(image.thumbnail)}" alt="" loading="lazy" />
        </button>
      `,
    )
    .join('');

  on(thumbs, 'click', 'button[data-src]', (_event, button) => {
    main.innerHTML = mainImageHtml(button.dataset.src, place.title);
    thumbs
      .querySelectorAll('button')
      .forEach((item) => item.classList.toggle('is-active', item === button));
  });
}

async function fillMap(place, el, alive) {
  if (!hasPosition(place)) {
    el.innerHTML = `<p class="muted">${t('위치 정보가 없어요.')}</p>`;
    return;
  }
  if (!hasKakaoKey()) {
    el.innerHTML = `<p class="muted">${t('카카오맵 키(VITE_KAKAO_MAP_KEY)가 없어 지도를 표시할 수 없어요.')}</p>`;
    return;
  }

  try {
    const kakao = await loadKakaoMap();
    if (!alive()) return;
    const position = new kakao.maps.LatLng(place.lat, place.lng);
    const map = new kakao.maps.Map(el, { center: position, level: 4 });
    new kakao.maps.Marker({ position, map });
    keepMapFitted(map, el);
  } catch (err) {
    if (alive()) el.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
}
