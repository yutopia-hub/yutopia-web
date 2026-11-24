import { createElement, qs, qsa, render } from '../../utils/dom.js';
import { slots, pts } from './config.js';
import { escapeHtml } from './svg-utils.js';
import { renderLandmark } from './tiles.js';
import { t } from '../../i18n/i18n.js';
import { getVisiblePlaces } from './placeList.js';

export function createUI(ctx, state, road, player) {
  let previous = { filled: {}, position: -1 };
  let cards = null;
  let cardIds = null;
  let toastVersion = 0;
  let bannerVersion = 0;
  async function toast(message) {
    const version = ++toastVersion;
    ctx.$('toast').textContent = message;
    ctx.$('toast').classList.add('show');
    try {
      await ctx.wait(2200);
      if (version === toastVersion) ctx.$('toast').classList.remove('show');
    } catch {
      /* disposed */
    }
  }
  async function ready() {
    const version = ++bannerVersion;
    ctx.$('ready').classList.add('show');
    try {
      await ctx.wait(3200);
      if (version === bannerVersion && !state.get().destinations.length)
        ctx.$('ready').classList.remove('show');
    } catch {
      /* disposed */
    }
  }
  function update(value) {
    const { places, filled, position, isBusy, destinations, selected } = value;
    const recommended = value.source === 'recommended';
    const ids = recommended ? value.recommendationIds : value.carrierIds;
    const visible = getVisiblePlaces(value);
    const listStatus = recommended ? value.recommendationStatus : value.status;
    if (cards !== places || cardIds !== ids) {
      cards = places;
      cardIds = ids;
      render(ctx.$('list'), '');
      for (const place of visible) {
        const card = createElement(
          'button',
          {
            type: 'button',
            class: 'card',
            'data-id': place.id,
            'aria-label': `${place.n}, 더블클릭으로 자동 배치하거나 선택 후 빈 칸을 선택하세요`,
          },
          ctx.$('list'),
        );
        if (recommended && place.recommendation) {
          const description = `${place.recommendation.score.toFixed(1)}점. ${place.recommendation.reasons.join(' ')}`;
          card.setAttribute('title', description);
          card.setAttribute('aria-description', description);
        }
        render(
          card,
          `<div class="im">${escapeHtml(place.e)}</div><div><b>${escapeHtml(place.n)}</b><small>${escapeHtml(place.r)}<br>${escapeHtml(place.c)}</small></div><span class="hd" aria-hidden="true">⋮⋮</span>`,
        );
        qs('.im', card).style.background = place.col;
      }
    }
    qsa('.card', ctx.$('list')).forEach((card) => {
      const id = card.dataset.id;
      card.classList.toggle('used', Object.values(filled).includes(id));
      card.classList.toggle('selected', selected === id);
      card.setAttribute('aria-pressed', String(selected === id));
      card.disabled = isBusy;
    });
    for (const index of slots) {
      const slot = qs(`.slot[data-i="${index}"]`, ctx.svg);
      const place = places.find((p) => p.id === filled[index]);
      if (previous.filled[index] !== filled[index]) renderLandmark(ctx, index, place);
      slot.classList.toggle('pick', destinations.includes(index));
      slot.classList.toggle('visited', value.visited.includes(index) && !place);
      slot.setAttribute('role', 'button');
      slot.setAttribute(
        'tabindex',
        destinations.includes(index) || (!isBusy && !place) ? '0' : '-1',
      );
      slot.setAttribute('aria-label', `${index + 1}번 칸: ${place ? place.n : '빈 여행지 칸'}`);
      slot.setAttribute('aria-disabled', String(isBusy ? !destinations.includes(index) : !!place));
    }
    if (position !== previous.position) {
      const pt = pts[position];
      player.tokG.setAttribute('transform', `translate(${pt.x},${pt.y - 6})`);
      player.ring.setAttribute('cx', pt.x);
      player.ring.setAttribute('cy', pt.y);
    }
    const count = Object.keys(filled).length;
    let empty = qs('.empty', ctx.$('list'));
    if (visible.length && visible.every((p) => Object.values(filled).includes(p.id)) && count < 8) {
      if (!empty) empty = createElement('div', { class: 'empty' }, ctx.$('list'));
      empty.textContent = '모든 여행지를 사용했어요.';
    } else empty?.remove();
    ctx.$('stats').innerHTML =
      `<span>🏅 ${t('마일리지')} <b>${value.mileage}</b></span><span>🎁 ${t('보상')} <b>${value.rewards}</b></span>`;
    if (previous.mileage !== undefined && value.mileage > previous.mileage) {
      toast(t('🎉 한 바퀴 완주! 마일리지 +1'));
    }
    ctx.$('cnt').textContent = `${count} / 8 여행지 등록됨`;
    ctx.$('pg').style.width = `${(count / 8) * 100}%`;
    ctx.$('roll').disabled = !value.isReady || isBusy;
    ctx.$('reset').disabled = isBusy;
    ctx.$('save').disabled = value.status !== 'loaded' || isBusy;
    ctx.$('res').textContent = value.result;
    ctx.$('hint').textContent = value.started
      ? t('다녀온 칸은 비워져요. 다시 오면 보상을 받아요!')
      : value.isReady
        ? t('준비됐어요! 윷을 던져 출발하세요.')
        : t('여행지 8곳을 모두 놓으면 시작할 수 있어요.');
    ctx.$('list-title').textContent = recommended ? t('추천 여행지') : t('내 여행 보따리');
    ctx.$('source-carrier').setAttribute('aria-pressed', String(!recommended));
    ctx.$('source-recommended').setAttribute('aria-pressed', String(recommended));
    ctx.$('source-carrier').disabled = isBusy;
    ctx.$('source-recommended').disabled = isBusy || value.status !== 'loaded';
    ctx.$('list').setAttribute('aria-busy', String(listStatus === 'loading'));
    ctx.$('data-status').hidden = listStatus === 'loaded' && visible.length > 0;
    ctx.$('data-status').textContent = recommended
      ? listStatus === 'loading' || listStatus === 'idle'
        ? '전국 여행지에서 어울리는 8곳을 찾고 있어요.'
        : listStatus === 'error'
          ? value.recommendationError
          : '현재 추천할 수 있는 여행지가 없어요.'
      : value.status === 'loading'
        ? '보따리의 여행지를 불러오는 중입니다.'
        : value.status === 'error'
          ? value.error
          : '보따리에 담은 여행지가 없어요.';
    ctx.$('list-note').hidden = !recommended || !value.recommendationNote;
    ctx.$('list-note').textContent = value.recommendationNote;
    ctx.$('recommend-retry').hidden = !recommended || listStatus !== 'error';
    ctx.$('recommend-retry').disabled = isBusy;
    ctx.$('more').hidden = recommended || value.status !== 'loaded' || visible.length >= 8;
    if (destinations.length) {
      ++bannerVersion;
      ctx.$('ready').textContent = '✈️ 가고 싶은 여행지를 선택하세요';
      ctx.$('ready').classList.add('show');
    } else if (previous.destinations?.length) {
      ctx.$('ready').classList.remove('show');
    }
    if (value.isReady && !previous.isReady) {
      ctx.$('ready').textContent = '여행 준비 완료! 🎉';
      road.classList.remove('glow');
      void road.getBoundingClientRect();
      road.classList.add('glow');
      ready();
    }
    if (!value.isReady) {
      ++bannerVersion;
      ctx.$('ready').classList.remove('show');
      road.classList.remove('glow');
    }
    previous = value;
  }
  return { render: update, toast };
}
