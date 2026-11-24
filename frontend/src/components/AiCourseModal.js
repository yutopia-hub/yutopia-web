import { COURSE_CATEGORIES, geocodeRegion } from '../api/coursePlaces.js';
import { buildAiCourse, describeWeather } from '../api/aiCourse.js';
import { fetchCourseWeather } from '../api/courseWeather.js';
import { weatherProfile } from '../algorithm/weatherPolicy.js';
import { weatherSceneHtml, weatherIcon } from './WeatherScene.js';
import { escapeHtml } from '../utils/format.js';
import { t, getLang } from '../i18n/i18n.js';
import '../styles/ai-course.css';

/* ---------- 공용 표시 함수 (모달과 지도 시트에서 같이 씀) ---------- */

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return t('{m}분', { m });
  return m ? t('{h}시간 {m}분', { h, m }) : t('{h}시간', { h });
}

// 도보 / 대중교통(거리로 추정한 시간). 먼 구간은 택시(길찾기의 실제 소요 시간·요금)도 함께 보여 준다
export const legIcon = (mode) => (mode === 'walk' ? '🚶' : '🚌');

const won = (amount) =>
  `${amount.toLocaleString(getLang() === 'en' ? 'en-US' : 'ko-KR')}${t('원')}`;

/** "🚕 9분 · 약 6,100원" (택시 정보가 없는 도보 구간은 빈 문자열) */
export function taxiLabel(leg) {
  if (!leg.taxiMinutes) return '';
  const fare = leg.taxiFare ? ` · ${t('약')} ${won(leg.taxiFare)}` : '';
  return `🚕 ${formatDuration(leg.taxiMinutes)}${fare}`;
}

export function legLabel(leg) {
  return `${legIcon(leg.mode)} ${formatDuration(leg.minutes)}`;
}

/** 코스 요약 숫자: 장소 수 · 이동 거리 · 예상 소요 */
export function courseStatsHtml(course) {
  return `
    <dl class="ai-course__stats">
      <div><dt>${t('장소')}</dt><dd>${t('{count}곳', { count: course.stops.length })}</dd></div>
      <div><dt>${t('총 이동')}</dt><dd>${course.totalKm.toFixed(1)}km</dd></div>
      <div><dt>${t('예상 관광 시간')}</dt><dd>${formatDuration(course.totalMinutes)}</dd></div>
    </dl>
    <p class="ai-course__breakdown muted">${t('이동 {move} + 체류 {stay}', {
      move: formatDuration(course.moveMinutes),
      stay: formatDuration(course.stayMinutes),
    })}</p>
    <p class="ai-course__source muted">${
      course.distanceSource === 'road'
        ? `🛣️ ${t('카카오 길찾기 실제 도로 거리로 TSP(비트마스킹 DP) 최단 순서를 계산했어요.')}`
        : `📏 ${t('길찾기를 쓸 수 없어 직선거리로 순서를 계산했어요.')}${course.routeNotice ? ` (${escapeHtml(course.routeNotice)})` : ''}`
    }</p>
  `;
}

/** 경복궁 ↓ 2.1km · 🚌 13분 ↓ 광장시장 … 형태의 세로 목록 */
export function courseListHtml(course) {
  return `<ol class="ai-course__list">${course.stops
    .map((stop, k) => {
      const leg = course.legs[k];
      return `
        <li class="ai-course__stop">
          <span class="ai-course__num" aria-hidden="true">${k + 1}</span>
          <div class="ai-course__stop-body">
            <strong>${escapeHtml(stop.emoji)} ${escapeHtml(stop.title)}</strong>
            <span class="muted">${escapeHtml(t(stop.categoryLabel))}${stop.stayMinutes ? ` · ${t('체류 {time}', { time: formatDuration(stop.stayMinutes) })}` : ''}</span>
            ${stop.reason ? `<p class="ai-course__reason">${escapeHtml(stop.reason)}</p>` : ''}
          </div>
        </li>
        ${
          leg
            ? `<li class="ai-course__leg" aria-label="${t('다음 장소까지 {km}km, {time}', { km: leg.km.toFixed(1), time: formatDuration(leg.minutes) })}">
                 <span aria-hidden="true">↓</span> ${leg.km.toFixed(1)}km · ${legLabel(leg)}${leg.taxiMinutes ? `<small>${taxiLabel(leg)}</small>` : ''}
               </li>`
            : ''
        }`;
    })
    .join('')}</ol>`;
}

/* ---------- 모달 껍데기 ---------- */

function openDialog(className, labelledBy) {
  const previousFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'ai-modal-backdrop';
  backdrop.innerHTML = `<div class="ai-modal ${className}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}" tabindex="-1"></div>`;
  document.body.append(backdrop);
  const dialog = backdrop.firstElementChild;

  const listeners = new Set();
  const close = () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    backdrop.remove();
    listeners.forEach((fn) => fn());
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  // 다른 페이지로 이동하면 모달도 닫는다
  window.addEventListener('hashchange', close);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });

  return { dialog, close, onClose: (fn) => listeners.add(fn) };
}

/** 예/아니오 확인 모달. 예 → true */
export function confirmDialog({ title, message, confirmLabel = t('확인') }) {
  return new Promise((resolve) => {
    const { dialog, close, onClose } = openDialog('ai-modal--confirm', 'ai-confirm-title');
    let answer = false;
    onClose(() => resolve(answer));
    dialog.innerHTML = `
      <h2 id="ai-confirm-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="ai-modal__actions">
        <button type="button" class="btn" data-answer="no">${t('취소')}</button>
        <button type="button" class="btn btn-primary" data-answer="yes">${escapeHtml(confirmLabel)}</button>
      </div>
    `;
    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-answer]');
      if (!button) return;
      answer = button.dataset.answer === 'yes';
      close();
    });
    dialog.querySelector('[data-answer="yes"]').focus();
  });
}

/* ---------- AI 코스 추천 모달 ---------- */

let lastInput = { region: '', categories: [] };

/**
 * @param {{ onShowOnMap: (course) => void, onCarry: (course) => void }} handlers
 */
export function openAiCourseModal({ onShowOnMap, onCarry }) {
  const { dialog, close } = openDialog('ai-modal--course', 'ai-course-title');
  let course = null;
  // 지금 화면에 불러온 날씨 (지역을 바꾸면 다시 불러와야 한다)
  let loadedWeather = null;
  let requestSeq = 0;
  let closed = false;
  const dialogClose = () => {
    closed = true;
    close();
  };

  function renderForm(error = '') {
    dialog.innerHTML = `
      <header class="ai-modal__head">
        <h2 id="ai-course-title">✨ ${t('AI 코스 추천')}</h2>
        <button type="button" class="ai-modal__close" data-act="close" aria-label="${t('닫기')}">&times;</button>
      </header>
      <p class="muted">${t('가고 싶은 동네와 관심 있는 카테고리를 고르면 AI 가 코스를 짜고, 최단 경로로 순서를 정해 드려요.')}</p>
      <form class="ai-course__form">
        <label class="ai-course__field">
          <span>${t('지역 (구 / 동)')}</span>
          <input name="region" required maxlength="40" autocomplete="off"
            placeholder="${t('예) 강남구 역삼동, 종로구, 성수동')}" value="${escapeHtml(lastInput.region)}" />
        </label>
        <div class="ai-weather">
          <button type="button" class="btn ai-weather__btn" data-act="weather">🌤️ ${t('현재 날씨 불러오기')}</button>
          <span class="muted ai-weather__hint">${t('날씨에 맞춰 실내·야외 장소와 이동 수단을 골라요.')}</span>
          <div class="ai-weather__slot" aria-live="polite"></div>
        </div>
        <fieldset class="ai-course__field">
          <legend>${t('카테고리 (여러 개 선택)')}</legend>
          <div class="ai-course__chips">
            ${COURSE_CATEGORIES.map(
              (c) => `
                <label class="ai-chip">
                  <input type="checkbox" name="category" value="${c.key}" ${lastInput.categories.includes(c.key) ? 'checked' : ''} />
                  <span>${c.emoji} ${t(c.label)}</span>
                </label>`,
            ).join('')}
          </div>
        </fieldset>
        ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
        <button type="submit" class="btn btn-primary ai-course__submit">${t('코스 추천받기')}</button>
      </form>
    `;
    if (loadedWeather) showWeather(loadedWeather);
    dialog.querySelector('[name="region"]').focus();
  }

  /** 날씨 장면을 그리고, 모달 전체 분위기(테두리 색)도 날씨에 맞춘다 */
  function showWeather({ weather, regionName }) {
    const slot = dialog.querySelector('.ai-weather__slot');
    if (!slot) return;
    const profile = weatherProfile(weather);
    slot.innerHTML = weatherSceneHtml(weather, { reason: profile.reason, regionName });
    dialog.dataset.weather = weather.kind;
  }

  async function loadWeather() {
    const input = dialog.querySelector('[name="region"]');
    const button = dialog.querySelector('[data-act="weather"]');
    const slot = dialog.querySelector('.ai-weather__slot');
    const region = String(input?.value ?? '').trim();
    if (!region) {
      slot.innerHTML = `<p class="error" role="alert">${t('지역을 먼저 입력해 주세요.')}</p>`;
      input?.focus();
      return;
    }
    button.disabled = true;
    button.textContent = `⏳ ${t('날씨 불러오는 중...')}`;
    try {
      const center = await geocodeRegion(region);
      const weather = await fetchCourseWeather(center);
      if (closed) return;
      loadedWeather = { weather, region, regionName: center.name || region };
      showWeather(loadedWeather);
    } catch (error) {
      if (!closed)
        slot.innerHTML = `<p class="error" role="alert">${escapeHtml(error.message)}</p>`;
    } finally {
      if (!closed && button.isConnected) {
        button.disabled = false;
        button.textContent = `🌤️ ${t('현재 날씨 불러오기')}`;
      }
    }
  }

  function renderLoading() {
    dialog.innerHTML = `
      <div class="ai-course__loading" role="status">
        <span class="ai-spinner" aria-hidden="true"></span>
        <strong>${t('AI 가 코스를 짜는 중이에요...')}</strong>
        <span class="muted">${t('주변 장소 찾기 → AI 선택 → 최단 경로(TSP) 계산')}</span>
      </div>
    `;
  }

  function renderResult() {
    dialog.innerHTML = `
      <header class="ai-modal__head">
        <div>
          <span class="chip${course.aiUsed ? '' : ' chip--muted'}">${course.aiUsed ? t('AI 추천') : t('기본 추천')}</span>
          <h2 id="ai-course-title">${escapeHtml(course.title)}</h2>
        </div>
        <button type="button" class="ai-modal__close" data-act="close" aria-label="${t('닫기')}">&times;</button>
      </header>
      ${course.summary ? `<p>${escapeHtml(course.summary)}</p>` : ''}
      ${
        course.weather
          ? `<p class="ai-course__weather">${weatherIcon(course.weather.kind, course.weather.isNight)} ${escapeHtml(describeWeather(course.weather))}${course.weatherProfile.reason ? `<br /><span>${escapeHtml(t(course.weatherProfile.reason))}</span>` : ''}</p>`
          : ''
      }
      ${course.aiUsed ? '' : `<p class="ai-course__notice muted">${t('AI 를 사용할 수 없어 주변 인기 장소로 코스를 만들었어요.')} (${escapeHtml(course.notice)})</p>`}
      ${courseStatsHtml(course)}
      <div class="ai-course__scroll">${courseListHtml(course)}</div>
      <div class="ai-modal__actions">
        <button type="button" class="btn" data-act="retry">${t('다시 추천')}</button>
        <button type="button" class="btn" data-act="map">🗺️ ${t('지도에서 코스 보기')}</button>
        <button type="button" class="btn btn-primary" data-act="carry">${t('보따리에 담기')}</button>
      </div>
    `;
    dialog.focus();
  }

  dialog.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const region = String(data.get('region') ?? '').trim();
    if (!region) return;
    lastInput = { region, categories: data.getAll('category').map(String) };

    const seq = ++requestSeq;
    renderLoading();
    try {
      // 같은 지역의 날씨를 이미 불러왔으면 그대로 쓰고, 아니면 코스 만들 때 새로 불러온다
      const weather = loadedWeather?.region === region ? loadedWeather.weather : undefined;
      const result = await buildAiCourse(region, lastInput.categories, { weather });
      if (closed || seq !== requestSeq) return;
      course = result;
      renderResult();
    } catch (error) {
      if (!closed && seq === requestSeq) renderForm(error.message);
    }
  });

  dialog.addEventListener('click', async (event) => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') dialogClose();
    else if (act === 'weather') loadWeather();
    else if (act === 'retry') renderForm();
    else if (act === 'map') {
      dialogClose();
      onShowOnMap(course);
    } else if (act === 'carry') {
      dialogClose();
      onCarry(course);
    }
  });

  renderForm();
}

/** "이 코스의 장소 N곳을 보따리에 담을까요?" → 예 이면 true */
export function confirmCarryCourse(course) {
  return confirmDialog({
    title: t('이 코스가 마음에 드시나요?'),
    message: t('{title}의 장소 {count}곳을 보따리에 한 번에 담을까요?', {
      title: course.title,
      count: course.stops.length,
    }),
    confirmLabel: t('네, 담을게요'),
  });
}
