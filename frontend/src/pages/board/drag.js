import { qs } from '../../utils/dom.js';
import { slots } from './config.js';

export function bindPlacement(ctx, state, ui) {
  let drag = null;
  let hot = null;
  let dragged = false;
  function place(index, id) {
    if (state.put(index, id))
      ui.toast(`${state.get().places.find((p) => p.id === id).n}이(가) 여행 보드에 추가되었습니다`);
  }
  function clean() {
    if (drag) {
      drag.clone.remove();
      drag.card.style.opacity = '';
    }
    hot?.classList.remove('hot');
    drag = null;
    hot = null;
  }
  ctx.on(ctx.$('list'), 'pointerdown', (event) => {
    const card = event.target.closest('.card:not(.used)');
    if (!card || state.get().isBusy || event.button !== 0) return;
    clean();
    dragged = false;
    const rect = card.getBoundingClientRect();
    drag = {
      card,
      id: card.dataset.id,
      clone: card.cloneNode(true),
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      pointerId: event.pointerId,
    };
    drag.clone.classList.add('drag');
    drag.clone.setAttribute('aria-hidden', 'true');
    drag.clone.tabIndex = -1;
    drag.clone.style.left = rect.left + 'px';
    drag.clone.style.top = rect.top + 'px';
    drag.clone.hidden = true;
    ctx.root.appendChild(drag.clone);
  });
  ctx.on(window, 'pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) dragged = true;
    if (!dragged) return;
    drag.clone.hidden = false;
    drag.card.style.opacity = '.3';
    drag.clone.style.left = event.clientX - drag.dx + 'px';
    drag.clone.style.top = event.clientY - drag.dy + 'px';
    const slot = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((node) => node.closest?.('.slot'))
      .find(
        (node) =>
          node &&
          ctx.svg.contains(node) &&
          qs('.cont', node) &&
          !state.get().filled[node.dataset.i],
      );
    if (hot !== slot) hot?.classList.remove('hot');
    hot = slot;
    hot?.classList.add('hot');
  });
  ctx.on(window, 'pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (hot && dragged) place(Number(hot.dataset.i), drag.id);
    clean();
  });
  ctx.on(window, 'pointercancel', clean);
  ctx.on(window, 'blur', clean);
  ctx.on(ctx.$('list'), 'click', (event) => {
    if (dragged) {
      dragged = false;
      event.preventDefault();
      return;
    }
    const card = event.target.closest('.card:not(.used)');
    if (card) {
      state.select(card.dataset.id);
      ui.toast('빈 여행지 칸을 선택하세요.');
    }
  });
  ctx.on(ctx.$('list'), 'dblclick', (event) => {
    const card = event.target.closest('.card:not(.used)');
    if (!card || dragged || state.get().isBusy) return;
    event.preventDefault();
    clean();
    const index = slots.find((index) => !state.get().filled[index]);
    if (index === undefined) {
      ui.toast('빈 여행지 칸이 없어요.');
      return;
    }
    place(index, card.dataset.id);
  });
  ctx.on(ctx.svg, 'click', (event) => {
    const slot = event.target.closest('.slot');
    if (slot && state.get().selected && !state.get().isBusy)
      place(Number(slot.dataset.i), state.get().selected);
  });
  ctx.on(ctx.svg, 'keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.target.closest('.slot')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  ctx.on(window, 'keydown', (event) => {
    if (event.key === 'Escape' && !state.get().isBusy) {
      clean();
      state.select(null);
    }
  });
  let previousSource = state.get().source;
  let previousPlaces = state.get().places;
  const unsubscribe = state.subscribe((value) => {
    if (value.source !== previousSource || value.places !== previousPlaces || value.isBusy) {
      clean();
      dragged = false;
    }
    previousSource = value.source;
    previousPlaces = value.places;
  });
  ctx.signal.addEventListener('abort', unsubscribe, { once: true });
  ctx.signal.addEventListener('abort', clean, { once: true });
}
