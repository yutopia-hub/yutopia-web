import { t } from '../i18n/i18n.js';
import { hasKakaoKey, loadKakaoMap, keepMapFitted } from '../api/kakaoMap.js';
import { searchPlaces, getPlaceIntro, hasPosition, IS_TOUR_MOCK } from '../api/tourApi.js';
import { mapStore } from '../store/mapStore.js';
import {
  carrierStore,
  isInCarrier,
  toggleCarrier,
  addManyToCarrier,
} from '../store/carrierStore.js';
import {
  openAiCourseModal,
  confirmCarryCourse,
  courseStatsHtml,
  courseListHtml,
  formatDuration,
  legIcon,
  taxiLabel,
} from '../components/AiCourseModal.js';
import { mountCarrierWidget } from '../components/CarrierWidget.js';
import { escapeHtml, nl2br } from '../utils/format.js';
import { on } from '../utils/dom.js';
import { navigate } from '../router/router.js';
import '../styles/map.css';

// 처음 들어오면 '서울' 검색 결과를 서울 중심 지도에 보여준다.
// 기본 검색어는 화면(검색창/상태 문구/주소)에 드러내지 않는다.
const DEFAULT_KEYWORD = '서울';
const DEFAULT_CENTER = { lat: 37.5663, lng: 126.9779 };
const DEFAULT_LEVEL = 7;
const SWIPE_THRESHOLD = 30;

// 지금 화면에 떠 있는 지도 페이지의 상태. 다른 페이지로 갔다 오면 새 객체로 교체되고,
// 이전 비동기 작업은 isActive 체크로 결과를 버린다.
let activeView = null;

export async function MapPage({ keyword = '' } = {}) {
  setTimeout(() => initMapPage(keyword), 0);

  return `
    <section class="map-page">
      <div class="map-canvas" id="kakao-map">
        ${
          hasKakaoKey()
            ? ''
            : `<p class="map-canvas__notice">${t('카카오맵 키(VITE_KAKAO_MAP_KEY)가 없어 지도를 표시할 수 없어요.')}<br />${t('아래 검색과 상세정보는 그대로 사용할 수 있어요.')}</p>`
        }
      </div>

      <div class="map-sheet" data-view="search">
        <button type="button" class="map-sheet__handle" aria-expanded="false" aria-controls="map-sheet-body">
          <span class="map-sheet__grip" aria-hidden="true"></span>
          <span class="map-sheet__handle-label">${t('관광지 검색')}</span>
        </button>

        <div class="map-sheet__body" id="map-sheet-body">
          <div class="map-sheet__search">
            <form class="map-search-form">
              <input
                type="search"
                name="keyword"
                value="${escapeHtml(keyword)}"
                placeholder="${t('관광지 이름이나 지역 (예: 경복궁, 부산)')}"
                autocomplete="off"
                required
              />
              <button type="submit" class="btn btn-primary">${t('검색')}</button>
            </form>
            ${IS_TOUR_MOCK ? `<div class="map-sheet__chips"><span class="chip chip--muted">${t('목업 데이터로 동작 중')}</span></div>` : ''}
            <p class="map-sheet__status muted">${t('관광지를 검색하면 지도에 사진 핀으로 표시돼요.')}</p>
            <ul class="map-results"></ul>
          </div>
          <div class="map-sheet__summary"></div>
          <div class="map-sheet__course"></div>
        </div>
      </div>
    </section>
  `;
}

async function initMapPage(initialKeyword) {
  const root = document.querySelector('.map-page');
  if (!root) return;

  const view = {
    root,
    sheet: root.querySelector('.map-sheet'),
    kakao: null,
    map: null,
    places: [],
    pins: new Map(),
    selectedId: null,
    introCache: new Map(),
    searchSeq: 0,
    course: null,
    courseOverlays: [],
  };
  activeView = view;
  bindSheetEvents(view);
  mountCarrierWidget(root, {
    onLocate: (item) => focusPlace(view, item),
    onAiCourse: () =>
      openAiCourseModal({
        onShowOnMap: (course) => showCourse(view, course),
        onCarry: (course) => carryCourse(view, course),
      }),
  });

  const unsubscribe = carrierStore.subscribe(() => {
    if (!isActive(view)) {
      unsubscribe();
      return;
    }
    syncCarrier(view);
  });

  // 상세에서 돌아온 경우(URL에 검색어 있음)는 결과 목록을 펼쳐서 복원하고,
  // 그냥 들어온 경우는 시트를 닫은 채 기본 검색 결과를 지도에 핀으로만 띄운다.
  if (initialKeyword) {
    setSheetOpen(view, true);
    runSearch(view, initialKeyword);
  } else {
    runSearch(view, DEFAULT_KEYWORD, { silent: true });
  }

  if (!hasKakaoKey()) return;

  try {
    const kakao = await loadKakaoMap();
    if (!isActive(view)) return;
    view.kakao = kakao;
    const container = root.querySelector('#kakao-map');
    view.map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
      level: DEFAULT_LEVEL,
    });
    keepMapFitted(view.map, container);
    // 지도 로딩보다 검색이 먼저 끝났을 수 있으니 한 번 더 그린다.
    renderPins(view);
  } catch (err) {
    if (isActive(view)) {
      root.querySelector('#kakao-map').innerHTML =
        `<p class="map-canvas__notice">${escapeHtml(err.message)}</p>`;
    }
  }
}

function isActive(view) {
  return activeView === view && view.root.isConnected;
}

/* ---------- 하단 시트 ---------- */

function bindSheetEvents(view) {
  const { sheet } = view;
  const handle = sheet.querySelector('.map-sheet__handle');

  // 핸들을 위/아래로 끌면 열고 닫고, 그냥 누르면 토글
  let startY = null;
  let swiped = false;
  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    swiped = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) > SWIPE_THRESHOLD) {
      swiped = true;
      setSheetOpen(view, dy < 0);
    }
  });
  handle.addEventListener('click', () => {
    if (swiped) {
      swiped = false;
      return;
    }
    setSheetOpen(view, !isSheetOpen(view));
  });

  sheet.querySelector('.map-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyword = String(new FormData(e.target).get('keyword') ?? '').trim();
    if (keyword) runSearch(view, keyword);
  });

  on(sheet, 'click', '[data-place-id]', (_event, el) => selectPlace(view, el.dataset.placeId));
  on(sheet, 'click', '[data-action="back"]', () => {
    setSelectedPin(view, null);
    showPanel(view, 'search');
  });
  on(sheet, 'click', '[data-action="detail"]', () => {
    if (view.selectedId) navigate(`/map/details/${encodeURIComponent(view.selectedId)}`);
  });
  on(sheet, 'click', '[data-action="course-carry"]', () => {
    if (view.course) carryCourse(view, view.course);
  });
  on(sheet, 'click', '[data-action="course-clear"]', () => clearCourse(view));
  on(sheet, 'click', '[data-action="course-fit"]', () => {
    setSheetOpen(view, false);
    fitCourse(view);
  });
  on(sheet, 'click', '[data-action="carry"]', () => {
    const place = view.places.find((item) => item.id === view.selectedId);
    if (place) toggleCarrier(place);
  });
}

/* ---------- 보따리(찜) ---------- */

function carryButtonHtml(placeId) {
  const carried = isInCarrier(placeId);
  return `
    <button type="button" class="btn place-summary__carry${carried ? ' is-carried' : ''}" data-action="carry" aria-pressed="${carried}">
      ${carried ? t('보따리에서 빼기') : t('보따리에 담기')}
    </button>
  `;
}

// 보따리가 바뀌면 핀 표시와 요약 카드 버튼만 갱신한다. (개수 뱃지는 CarrierWidget이 담당)
function syncCarrier(view) {
  view.pins.forEach(({ element }, pinId) => {
    element.classList.toggle('is-carried', isInCarrier(pinId));
  });
  const carryButton = view.sheet.querySelector('[data-action="carry"]');
  if (carryButton && view.selectedId) carryButton.outerHTML = carryButtonHtml(view.selectedId);
}

function isSheetOpen(view) {
  return view.sheet.classList.contains('is-open');
}

function setSheetOpen(view, open) {
  view.sheet.classList.toggle('is-open', open);
  // 좁은 화면에서는 열린 시트와 보따리 버튼이 겹치므로 CSS에서 버튼을 숨기는 데 쓴다.
  view.root.classList.toggle('is-sheet-open', open);
  const handle = view.sheet.querySelector('.map-sheet__handle');
  handle.setAttribute('aria-expanded', String(open));

  const selected = view.places.find((place) => place.id === view.selectedId);
  const closedLabel = view.course
    ? `✨ ${view.course.title} · ${formatDuration(view.course.totalMinutes)}`
    : (selected?.title ?? t('관광지 검색'));
  handle.querySelector('.map-sheet__handle-label').textContent = open ? t('접기') : closedLabel;
}

function showPanel(view, name) {
  view.sheet.dataset.view = name;
  view.sheet.querySelector('.map-sheet__body').scrollTop = 0;
}

function setStatus(view, message, isError = false) {
  const status = view.sheet.querySelector('.map-sheet__status');
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.classList.toggle('muted', !isError);
}

/* ---------- 검색 ---------- */

// silent: 기본 검색. 검색어를 URL/상태 문구에 남기지 않고, 지도도 서울 중심 그대로 둔다.
async function runSearch(view, keyword, { silent = false } = {}) {
  const seq = ++view.searchSeq;
  view.fitResults = !silent;
  if (view.course) clearCourse(view, { keepPanel: true });
  if (!silent) {
    mapStore.setState({ lastKeyword: keyword });
    // 상세 페이지 갔다가 뒤로 오면 같은 검색이 복원되도록 URL만 바꾼다 (hashchange 안 일어남).
    history.replaceState(null, '', `#/map?keyword=${encodeURIComponent(keyword)}`);
  }

  setSelectedPin(view, null);
  showPanel(view, 'search');
  setStatus(view, silent ? t('주변 관광지를 불러오는 중...') : t('검색 중...'));

  try {
    const places = await searchPlaces(keyword);
    if (!isActive(view) || seq !== view.searchSeq) return;

    view.places = places;
    renderResults(view);
    renderPins(view);

    const located = places.filter(hasPosition).length;
    if (silent) {
      setStatus(
        view,
        places.length
          ? t('추천 관광지 {count}곳을 보여드려요. 원하는 곳을 검색해 보세요.', {
              count: places.length,
            })
          : t('관광지를 검색하면 지도에 사진 핀으로 표시돼요.'),
      );
    } else if (!places.length) {
      setStatus(view, t("'{keyword}'에 대한 검색 결과가 없어요.", { keyword }));
    } else {
      const hidden = places.length - located;
      setStatus(
        view,
        t("'{keyword}' 검색 결과 {count}곳", { keyword, count: places.length }) +
          (hidden ? t(' (위치 정보 없는 {hidden}곳은 지도에서 제외)', { hidden }) : ''),
      );
    }
  } catch (err) {
    if (isActive(view) && seq === view.searchSeq) setStatus(view, err.message, true);
  }
}

function thumbnailHtml(place, className) {
  if (place.thumbnail) {
    return `<span class="${className}"><img src="${escapeHtml(place.thumbnail)}" alt="" loading="lazy" /></span>`;
  }
  return `<span class="${className} is-fallback">${escapeHtml(place.title.charAt(0))}</span>`;
}

function renderResults(view) {
  view.sheet.querySelector('.map-results').innerHTML = view.places
    .map(
      (place) => `
        <li>
          <button type="button" class="map-result" data-place-id="${escapeHtml(place.id)}">
            ${thumbnailHtml(place, 'map-result__thumb')}
            <span class="map-result__text">
              <strong>${escapeHtml(place.title)}</strong>
              <span class="muted">${escapeHtml(place.typeName)} · ${escapeHtml(place.address || t('주소 정보 없음'))}</span>
            </span>
          </button>
        </li>
      `,
    )
    .join('');
}

/* ---------- 지도 핀 (이미지 커스텀 오버레이) ---------- */

function renderPins(view) {
  if (!view.map || view.course) return;
  const { kakao, map } = view;

  view.pins.forEach(({ overlay }) => overlay.setMap(null));
  view.pins.clear();

  const located = view.places.filter(hasPosition);
  if (!located.length) return;

  const bounds = new kakao.maps.LatLngBounds();
  located.forEach((place) => {
    const position = new kakao.maps.LatLng(place.lat, place.lng);
    bounds.extend(position);
    view.pins.set(place.id, createPin(view, place, position));
  });

  if (!view.fitResults) return;
  if (located.length === 1) {
    map.setLevel(5);
    map.setCenter(new kakao.maps.LatLng(located[0].lat, located[0].lng));
    return;
  }
  fitBounds(view, bounds);
}

const FIT_PADDING = { top: 60, side: 40, bottom: 60 };
const MIN_VISIBLE_HEIGHT = 160;

// 열린 시트에 가리지 않게 아래 여백을 주되, 여백 합이 지도 높이를 넘으면 카카오맵이
// 최대로 축소되면서 중심이 엉뚱한 곳으로 가버린다. 최소한 MIN_VISIBLE_HEIGHT만큼은 남긴다.
function fitBounds(view, bounds) {
  const mapHeight = view.root.querySelector('#kakao-map').clientHeight;
  const sheetCover = isSheetOpen(view) ? view.sheet.offsetHeight + 24 : FIT_PADDING.bottom;
  const maxBottom = Math.max(FIT_PADDING.bottom, mapHeight - FIT_PADDING.top - MIN_VISIBLE_HEIGHT);
  const bottom = Math.min(sheetCover, maxBottom);
  view.map.setBounds(bounds, FIT_PADDING.top, FIT_PADDING.side, bottom, FIT_PADDING.side);
}

function createPin(view, place, position) {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = isInCarrier(place.id) ? 'place-pin is-carried' : 'place-pin';
  pin.setAttribute('aria-label', place.title);

  const label = document.createElement('span');
  label.className = 'place-pin__label';
  label.textContent = place.title;

  const thumb = document.createElement('span');
  thumb.className = 'place-pin__thumb';
  const showFallback = () => {
    thumb.textContent = place.title.charAt(0);
    thumb.classList.add('is-fallback');
  };
  if (place.thumbnail) {
    const img = document.createElement('img');
    img.src = place.thumbnail;
    img.alt = '';
    img.draggable = false;
    img.addEventListener(
      'error',
      () => {
        img.remove();
        showFallback();
      },
      { once: true },
    );
    thumb.append(img);
  } else {
    showFallback();
  }

  pin.append(label, thumb);

  const overlay = new view.kakao.maps.CustomOverlay({
    position,
    content: pin,
    xAnchor: 0.5,
    yAnchor: 1,
    zIndex: 1,
    clickable: true,
  });

  // 확대된 핀이 옆 핀에 가려지지 않게 hover 중에는 맨 위로 올린다. (확대 자체는 CSS)
  pin.addEventListener('mouseenter', () => overlay.setZIndex(10));
  pin.addEventListener('mouseleave', () => overlay.setZIndex(place.id === view.selectedId ? 5 : 1));
  pin.addEventListener('click', () => selectPlace(view, place.id));

  overlay.setMap(view.map);
  return { overlay, element: pin };
}

function setSelectedPin(view, id) {
  view.selectedId = id;
  view.pins.forEach(({ overlay, element }, pinId) => {
    const selected = pinId === id;
    element.classList.toggle('is-selected', selected);
    overlay.setZIndex(selected ? 5 : 1);
  });
}

// 시트가 열려 있으면 시트에 가리지 않는 위쪽 영역 가운데로 핀을 옮긴다.
function panToVisible(view, place) {
  if (!view.map) return;
  const { kakao, map } = view;
  const position = new kakao.maps.LatLng(place.lat, place.lng);
  if (!isSheetOpen(view)) {
    map.panTo(position);
    return;
  }
  const projection = map.getProjection();
  const point = projection.pointFromCoords(position);
  const offset = view.sheet.offsetHeight / 2;
  map.panTo(projection.coordsFromPoint(new kakao.maps.Point(point.x, point.y + offset)));
}

// 보따리 리스트의 "지도에서 보기": 현재 검색 결과에 없던 장소면 핀을 하나 추가해서 보여준다.
function focusPlace(view, place) {
  if (!view.places.some((item) => item.id === place.id)) {
    view.places.push(place);
    if (view.map && hasPosition(place)) {
      const position = new view.kakao.maps.LatLng(place.lat, place.lng);
      view.pins.set(place.id, createPin(view, place, position));
    }
  }
  selectPlace(view, place.id);
}

/* ---------- 요약 카드 ---------- */

async function selectPlace(view, id) {
  const place = view.places.find((item) => item.id === id);
  if (!place) return;

  setSelectedPin(view, id);
  showPanel(view, 'summary');
  renderSummary(view, place, view.introCache.get(id) ?? null);
  setSheetOpen(view, true);
  if (hasPosition(place)) panToVisible(view, place);

  if (view.introCache.has(id)) return;
  try {
    const intro = await getPlaceIntro(place.id, place.contentTypeId);
    view.introCache.set(id, intro);
    if (isActive(view) && view.selectedId === id) renderSummary(view, place, intro);
  } catch {
    if (isActive(view) && view.selectedId === id) renderSummary(view, place, { error: true });
  }
}

function factRow(label, value, muted = false) {
  if (!value) return '';
  return `<div><dt>${escapeHtml(label)}</dt><dd${muted ? ' class="muted"' : ''}>${nl2br(value)}</dd></div>`;
}

function renderSummary(view, place, intro) {
  let introRows;
  if (!intro) {
    introRows = factRow(t('운영 정보'), t('불러오는 중...'), true);
  } else if (intro.error) {
    introRows = factRow(t('운영 정보'), t('불러오지 못했어요.'), true);
  } else {
    introRows =
      factRow(intro.summary.timeLabel, intro.summary.time) +
      factRow(t('쉬는날'), intro.summary.restDay);
  }

  const image = place.image
    ? `<img class="place-summary__image" src="${escapeHtml(place.image)}" alt="${escapeHtml(place.title)}" />`
    : `<div class="place-summary__image is-fallback">${escapeHtml(place.title.charAt(0))}</div>`;

  view.sheet.querySelector('.map-sheet__summary').innerHTML = `
    <article class="place-summary">
      <button type="button" class="place-summary__back" data-action="back">&larr; ${t('검색 결과')}</button>
      <div class="place-summary__main">
        ${image}
        <div class="place-summary__info">
          <span class="chip">${escapeHtml(place.typeName)}</span>
          <h3>${escapeHtml(place.title)}</h3>
          <dl class="place-summary__facts">
            ${factRow(t('주소'), place.address)}
            ${introRows}
            ${factRow(t('문의'), place.tel)}
          </dl>
        </div>
      </div>
      <div class="place-summary__actions">
        ${carryButtonHtml(place.id)}
        <button type="button" class="btn btn-primary" data-action="detail">${t('상세정보 보기')}</button>
      </div>
    </article>
  `;
}

/* ---------- AI 추천 코스 (지도 위 경로 + 구간 시간) ---------- */

const COURSE_COLOR = '#3b5bdb';

function removeCourseOverlays(view) {
  view.courseOverlays.forEach((overlay) => overlay.setMap(null));
  view.courseOverlays = [];
}

function showCourse(view, course) {
  view.course = course;
  setSelectedPin(view, null);
  // 검색 핀은 잠시 내리고 코스 핀만 보여준다
  view.pins.forEach(({ overlay }) => overlay.setMap(null));
  view.pins.clear();
  renderCoursePanel(view);
  showPanel(view, 'course');
  setSheetOpen(view, false);
  drawCourse(view);
}

function drawCourse(view) {
  removeCourseOverlays(view);
  const { kakao, map, course } = view;
  if (!map || !course) return;

  // 구간마다 실제 도로 경로(카카오 길찾기 좌표)를 따라 선을 긋는다. 경로가 없으면 직선
  const legPaths = course.legs.map((leg) => {
    const a = course.stops[leg.from];
    const b = course.stops[leg.to];
    const points = leg.path?.length
      ? [[a.lat, a.lng], ...leg.path, [b.lat, b.lng]]
      : [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ];
    return points.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng));
  });
  // 흰 테두리 선 위에 파란 선을 겹쳐서 길찾기 경로처럼 보이게 한다
  legPaths.forEach((path) => {
    const outline = new kakao.maps.Polyline({
      path,
      strokeWeight: 10,
      strokeColor: '#ffffff',
      strokeOpacity: 0.95,
    });
    const line = new kakao.maps.Polyline({
      path,
      strokeWeight: 6,
      strokeColor: COURSE_COLOR,
      strokeOpacity: 0.9,
      strokeStyle: course.legs.length && !course.hasRoadPath ? 'shortdash' : 'solid',
    });
    outline.setMap(map);
    line.setMap(map);
    view.courseOverlays.push(outline, line);
  });

  // 구간 경로의 가운데 지점에 "🚗 8분 / 2.1km" 라벨
  course.legs.forEach((leg, k) => {
    const path = legPaths[k];
    const label = document.createElement('div');
    label.className = 'course-leg';
    label.innerHTML = `${legIcon(leg.mode)} ${formatDuration(leg.minutes)}<small>${leg.km.toFixed(1)}km${leg.taxiMinutes ? ` · ${taxiLabel(leg)}` : ''}</small>`;
    const overlay = new kakao.maps.CustomOverlay({
      position: path[Math.floor(path.length / 2)],
      content: label,
      yAnchor: 1.2,
      // 구간이 짧으면 핀 이름표와 겹치므로 시간 라벨을 핀보다 위에 둔다
      zIndex: 6,
    });
    overlay.setMap(map);
    view.courseOverlays.push(overlay);
  });

  // 방문 순서 번호 핀
  course.stops.forEach((stop, k) => {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = `course-pin${k === course.stops.length - 1 ? ' is-last' : ''}`;
    pin.setAttribute('aria-label', `${k + 1}. ${stop.title}`);
    pin.textContent = String(k + 1);
    const name = document.createElement('span');
    name.className = 'course-pin__name';
    name.textContent = stop.title;
    pin.append(name);
    pin.addEventListener('click', () => {
      setSheetOpen(view, true);
      const stops = view.sheet.querySelectorAll('.ai-course__stop');
      stops[k]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(stop.lat, stop.lng),
      content: pin,
      yAnchor: 0.5,
      zIndex: 4,
      clickable: true,
    });
    overlay.setMap(map);
    view.courseOverlays.push(overlay);
  });

  fitCourse(view);
}

function fitCourse(view) {
  const { kakao, map, course } = view;
  if (!map || !course) return;
  const bounds = new kakao.maps.LatLngBounds();
  course.stops.forEach((stop) => bounds.extend(new kakao.maps.LatLng(stop.lat, stop.lng)));
  // 도로 경로가 장소 바깥으로 돌아가는 부분까지 화면에 들어오게
  course.legs.forEach((leg) =>
    leg.path?.forEach(([lat, lng]) => bounds.extend(new kakao.maps.LatLng(lat, lng))),
  );
  fitBounds(view, bounds);
}

function renderCoursePanel(view, message = '') {
  const { course } = view;
  view.sheet.querySelector('.map-sheet__course').innerHTML = `
    <section class="map-course">
      <div class="map-course__head">
        <div>
          <span class="chip${course.aiUsed ? '' : ' chip--muted'}">${course.aiUsed ? t('AI 추천') : t('기본 추천')}</span>
          <h3>${escapeHtml(course.title)}</h3>
        </div>
        <button type="button" class="btn" data-action="course-fit">🗺️ ${t('전체 보기')}</button>
      </div>
      ${courseStatsHtml(course)}
      ${courseListHtml(course)}
      ${message ? `<p class="muted" role="status">${escapeHtml(message)}</p>` : ''}
      <div class="map-course__actions">
        <button type="button" class="btn" data-action="course-clear">${t('코스 닫기')}</button>
        <button type="button" class="btn btn-primary" data-action="course-carry">${t('보따리에 담기')}</button>
      </div>
    </section>
  `;
}

function clearCourse(view, { keepPanel = false } = {}) {
  removeCourseOverlays(view);
  view.course = null;
  view.sheet.querySelector('.map-sheet__course').innerHTML = '';
  if (keepPanel) return;
  showPanel(view, 'search');
  setSheetOpen(view, isSheetOpen(view));
  renderPins(view);
}

// "보따리에 담기" → 마음에 드는지 확인 → 코스 장소를 한 번에 담는다
async function carryCourse(view, course) {
  const ok = await confirmCarryCourse(course);
  if (!ok || !isActive(view)) return;
  const added = addManyToCarrier(course.stops);
  if (view.course === course) {
    renderCoursePanel(
      view,
      added
        ? t('{count}곳을 보따리에 담았어요.', { count: added })
        : t('이미 모두 보따리에 있어요.'),
    );
  }
}
