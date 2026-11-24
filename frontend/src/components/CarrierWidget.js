import { t } from '../i18n/i18n.js';
import {
  carrierStore,
  removeFromCarrier,
  updateCarrierMemo,
  clearCarrier,
} from '../store/carrierStore.js';
import { CarrierIcon } from './CarrierIcon.js';
import { escapeHtml, nl2br } from '../utils/format.js';
import { on } from '../utils/dom.js';
import { navigate } from '../router/router.js';
import '../styles/carrier.css';

/**
 * 오른쪽 아래 떠 있는 메뉴 버튼. 누르면 동그라미 두 개가 펼쳐진다.
 *   ① 보따리(찜 리스트 패널)  ② AI 코스 추천(onAiCourse)
 * container 안에 붙고, container가 화면에서 사라지면 스토어 구독도 스스로 해제한다.
 * onLocate(item): 리스트에서 "지도에서 보기"를 눌렀을 때 호출.
 * onAiCourse(): AI 코스 추천 동그라미를 눌렀을 때 호출.
 */
export function mountCarrierWidget(container, { onLocate, onAiCourse } = {}) {
  const root = document.createElement('div');
  root.className = 'carrier-widget';
  container.append(root);

  const state = { open: false, editingId: null, expanded: false };
  let lastCount = carrierStore.getState().items.length;

  function paint() {
    const { items } = carrierStore.getState();
    const count = items.length
      ? `<span class="carrier-button__count">${items.length > 99 ? '99+' : items.length}</span>`
      : '';
    root.classList.toggle('is-open', state.open);
    root.classList.toggle('is-expanded', state.expanded);
    root.innerHTML = `
      ${state.open ? panelHtml(items, state.editingId) : ''}
      <div class="fab-dial" id="fab-dial" ${state.expanded ? '' : 'inert'}>
        <button type="button" class="carrier-button fab-option" data-carrier-action="toggle"
          aria-expanded="${state.open}" aria-label="${t('보따리 열기 (담은 관광지 {count}곳)', { count: items.length })}">
          ${CarrierIcon({ size: 40 })}
          ${count}
          <span class="fab-option__label">${t('보따리')}</span>
        </button>
        <button type="button" class="carrier-button fab-option fab-option--ai" data-carrier-action="ai"
          aria-label="${t('AI 코스 추천')}">
          <span class="fab-ai-icon" aria-hidden="true">✨</span>
          <span class="fab-option__label">${t('AI 코스 추천')}</span>
        </button>
      </div>
      <button type="button" class="carrier-button fab-menu" data-carrier-action="menu"
        aria-expanded="${state.expanded}" aria-controls="fab-dial"
        aria-label="${t(state.expanded ? '메뉴 닫기' : '메뉴 열기')}">
        <span class="fab-menu__bars" aria-hidden="true"><i></i><i></i><i></i></span>
        ${state.expanded ? '' : count}
      </button>
    `;
  }

  function bump() {
    const badge = root.querySelector('.carrier-button__count');
    if (!badge) return;
    badge.classList.remove('is-bump');
    // 같은 애니메이션을 다시 재생하려면 reflow가 한 번 필요하다.
    void badge.offsetWidth;
    badge.classList.add('is-bump');
  }

  const unsubscribe = carrierStore.subscribe(({ items }) => {
    if (!root.isConnected) {
      unsubscribe();
      return;
    }
    if (state.editingId && !items.some((item) => item.id === state.editingId)) {
      state.editingId = null;
    }
    paint();
    if (items.length > lastCount) bump();
    lastCount = items.length;
  });

  const findItem = (id) => carrierStore.getState().items.find((item) => item.id === id);

  on(root, 'click', '[data-carrier-action]', (_event, el) => {
    const { carrierAction: action, id } = el.dataset;

    if (action === 'menu') {
      state.expanded = !state.expanded;
      if (!state.expanded) state.open = false;
      state.editingId = null;
      paint();
    } else if (action === 'ai') {
      state.expanded = false;
      state.open = false;
      paint();
      onAiCourse?.();
    } else if (action === 'toggle') {
      state.open = !state.open;
      state.editingId = null;
      paint();
    } else if (action === 'close') {
      state.open = false;
      state.editingId = null;
      paint();
    } else if (action === 'locate') {
      const item = findItem(id);
      if (!item || !onLocate) return;
      state.open = false;
      paint();
      onLocate(item);
    } else if (action === 'detail') {
      const item = findItem(id);
      if (item?.placeUrl) window.open(item.placeUrl, '_blank', 'noopener');
      else navigate(`/map/details/${encodeURIComponent(id)}`);
    } else if (action === 'edit') {
      state.editingId = id;
      paint();
      root.querySelector('.carrier-memo-form textarea')?.focus();
    } else if (action === 'cancel') {
      state.editingId = null;
      paint();
    } else if (action === 'delete') {
      removeFromCarrier(id);
    } else if (action === 'clear') {
      if (window.confirm(t('보따리에 담은 관광지를 모두 비울까요?'))) clearCarrier();
    }
  });

  on(root, 'submit', '.carrier-memo-form', (event, form) => {
    event.preventDefault();
    const memo = String(new FormData(form).get('memo') ?? '');
    const id = state.editingId;
    state.editingId = null;
    updateCarrierMemo(id, memo);
  });

  paint();
}

function panelHtml(items, editingId) {
  return `
    <section class="carrier-panel" aria-label="${t('내 보따리')}">
      <header class="carrier-panel__head">
        <h2>${t('내 보따리')} <span class="muted">${t('{count}곳', { count: items.length })}</span></h2>
        <button type="button" class="carrier-panel__close" data-carrier-action="close" aria-label="${t('닫기')}">&times;</button>
      </header>
      ${
        items.length
          ? `<ul class="carrier-list">${items.map((item) => itemHtml(item, item.id === editingId)).join('')}</ul>
             <footer class="carrier-panel__foot">
               <button type="button" class="carrier-link carrier-link--danger" data-carrier-action="clear">${t('전체 비우기')}</button>
             </footer>`
          : `<p class="carrier-panel__empty muted">${t('아직 담은 관광지가 없어요.')}<br />${t('지도에서 핀을 눌러 보따리에 담아보세요.')}</p>`
      }
    </section>
  `;
}

function itemHtml(item, editing) {
  const id = escapeHtml(item.id);
  const thumb = item.thumbnail
    ? `<img class="carrier-item__thumb" src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy" />`
    : `<span class="carrier-item__thumb is-fallback">${escapeHtml(item.title.charAt(0))}</span>`;

  const memo = editing
    ? `<form class="carrier-memo-form">
         <textarea name="memo" rows="3" maxlength="200" placeholder="${t('예) 오전에 가기, 입장권 미리 예매')}">${escapeHtml(item.memo ?? '')}</textarea>
         <div class="carrier-memo-form__actions">
           <button type="button" class="btn" data-carrier-action="cancel">${t('취소')}</button>
           <button type="submit" class="btn btn-primary">${t('저장')}</button>
         </div>
       </form>`
    : item.memo
      ? `<p class="carrier-item__memo">${nl2br(item.memo)}</p>`
      : '';

  return `
    <li class="carrier-item">
      <div class="carrier-item__main">
        ${thumb}
        <div class="carrier-item__text">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="muted">${escapeHtml(item.typeName)}${item.address ? ` · ${escapeHtml(item.address)}` : ''}</span>
        </div>
      </div>
      ${memo}
      ${
        editing
          ? ''
          : `<div class="carrier-item__actions">
               <button type="button" class="carrier-link" data-carrier-action="locate" data-id="${id}">${t('지도에서 보기')}</button>
               <button type="button" class="carrier-link" data-carrier-action="detail" data-id="${id}">${t('상세정보')}</button>
               <button type="button" class="carrier-link" data-carrier-action="edit" data-id="${id}">${item.memo ? t('메모 수정') : t('메모 추가')}</button>
               <button type="button" class="carrier-link carrier-link--danger" data-carrier-action="delete" data-id="${id}">${t('삭제')}</button>
             </div>`
      }
    </li>
  `;
}
