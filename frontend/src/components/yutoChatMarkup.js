import { escapeHtml } from '../utils/format.js';

export function YutoIcon() {
  return `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <path d="M8 9h24a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H18l-8 5v-5H8a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 3v6m-7 14c4 4 10 4 14 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="13" cy="18" r="2" fill="currentColor"/><circle cx="27" cy="18" r="2" fill="currentColor"/>
  </svg>`;
}

export function safeKakaoPlaceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname === 'place.map.kakao.com'
      && !url.username && !url.password && !url.port ? url.href : '';
  } catch { return ''; }
}

function evidenceHtml(evidence = []) {
  const sources = new Set();
  const places = new Map();
  let incomplete = false;
  for (const item of evidence) {
    if (!item.success) { incomplete = true; continue; }
    if (['getWalkingRoute', 'compareDetourTime'].includes(item.tool)) sources.add('TMAP 보행 경로');
    if (item.tool === 'searchPlacesAlongRoute') sources.add('카카오 장소 검색');
    incomplete ||= Boolean(item.result?.partial || item.result?.truncated);
    if (Array.isArray(item.result?.places)) {
      for (const place of item.result.places.slice(0, 10)) places.set(place.id, place);
    }
  }
  return `${sources.size ? `<p class="yuto-sources">확인한 정보 · ${escapeHtml([...sources].join(' · '))}</p>` : ''}
    ${incomplete ? '<p class="yuto-sources">일부 정보만 확인했어요. 답변의 안내를 함께 확인해 주세요.</p>' : ''}
    ${places.size ? `<ul class="yuto-places">${[...places.values()].slice(0, 10).map((place) => {
      const url = safeKakaoPlaceUrl(place.placeUrl);
      return `<li><strong>${escapeHtml(place.title)}</strong><span>${escapeHtml(place.address)}</span>
        ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">장소 정보 보기<span class="sr-only"> (새 창)</span></a>` : ''}</li>`;
    }).join('')}</ul>` : ''}`;
}

export function yutoMessagesHtml(state) {
  const messages = state.messages.map((turn) => `
    <li class="yuto-message yuto-message--user"><span class="sr-only">나: </span><p>${escapeHtml(turn.user)}</p></li>
    <li class="yuto-message yuto-message--assistant"><strong>유토</strong><p>${escapeHtml(turn.assistant)}</p>${evidenceHtml(turn.evidence)}</li>`).join('');
  return `${messages}${state.pendingMessage ? `
    <li class="yuto-message yuto-message--user"><span class="sr-only">나: </span><p>${escapeHtml(state.pendingMessage)}</p></li>
    <li class="yuto-message yuto-message--assistant" role="status"><strong>유토</strong><p>코스 정보를 확인하고 있어요…</p></li>` : ''}`;
}
