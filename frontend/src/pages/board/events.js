import { FIX, EV, N, slots, pts } from './config.js';
import { step } from './player.js';
import { render } from '../../utils/dom.js';
import { t } from '../../i18n/i18n.js';

export function createEvents(ctx, state, player, ui) {
  ctx.on(ctx.$('modal'), 'keydown', (event) => {
    if (event.key === 'Tab') event.preventDefault();
  });
  let choose = null;
  ctx.on(ctx.svg, 'click', (event) => {
    const slot = event.target.closest('.slot');
    if (choose && slot && state.get().destinations.includes(Number(slot.dataset.i))) {
      const resolve = choose;
      choose = null;
      resolve(Number(slot.dataset.i));
    }
  });
  ctx.signal.addEventListener(
    'abort',
    () => {
      if (choose) {
        choose(null);
        choose = null;
      }
    },
    { once: true },
  );

  async function fly() {
    const destinations = slots.filter((i) => i !== state.get().position && state.get().filled[i]);
    if (!destinations.length) return;
    state.destinations(destinations);
    const focus = document.activeElement;
    ctx.svg.querySelector(`.slot[data-i="${destinations[0]}"]`).focus();
    const to = await new Promise((resolve) => {
      choose = resolve;
    });
    ctx.check();
    state.destinations([]);
    const a = pts[state.get().position],
      b = pts[to];
    const route = ctx.el('path', {
      d: `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 120} ${b.x} ${b.y}`,
      fill: 'none',
      stroke: '#2b9ac0',
      'stroke-width': 3,
      'stroke-dasharray': '3 9',
      'stroke-linecap': 'round',
    });
    const plane = ctx.el('text', { 'font-size': 34, 'text-anchor': 'middle' });
    plane.textContent = '✈️';
    const motion = ctx.animate(
      plane,
      [
        { transform: `translate(${a.x}px,${a.y}px)` },
        { transform: `translate(${(a.x + b.x) / 2}px,${Math.min(a.y, b.y) - 60}px) scale(1.4)` },
        { transform: `translate(${b.x}px,${b.y}px)` },
      ],
      { duration: 1500, easing: 'ease-in-out', fill: 'forwards' },
    );
    try {
      await motion.finished;
      await step(ctx, state, player, to);
    } finally {
      ctx.cancel(motion);
      plane.remove();
      route.remove();
    }
    ui.toast(
      '✈️ ' + state.get().places.find((p) => p.id === state.get().filled[to]).n + '(으)로 이동!',
    );
    if (focus?.isConnected) focus.focus();
  }

  async function land() {
    const position = state.get().position;
    const kind = FIX[position];
    if (kind === 'key') {
      const event = EV[Math.floor(Math.random() * EV.length)];
      render(
        ctx.$('mc'),
        `<span class="e">${event.e}</span><b>${event.t}</b><span>${event.d}</span>`,
      );
      const focus = document.activeElement;
      ctx.$('modal').classList.add('on');
      ctx.$('modal').focus();
      try {
        await ctx.wait(2000);
      } finally {
        ctx.$('modal').classList.remove('on');
      }
      if (focus?.isConnected) focus.focus();
      if (event.a === 'next') {
        let index = position;
        do {
          index = (index + 1) % N;
        } while (FIX[index]);
        await step(ctx, state, player, index);
      } else if (event.a === 'plane') {
        while (state.get().position !== 6)
          await step(ctx, state, player, (state.get().position + 1) % N);
        await fly();
      }
    } else if (kind === 'plane') await fly();
    else if (!kind) {
      const place = state.get().places.find((p) => p.id === state.get().filled[position]);
      const rewarded = state.claimReward(position);
      if (rewarded) {
        ui.toast(
          place
            ? t('🎁 새 여행지 {name}에 도착! 보상 +1', { name: place.n })
            : t('🎁 다녀온 자리에 다시 왔어요! 보상 +1'),
        );
        await ctx.wait(1200);
      } else if (place) ui.toast(t('{emoji} {name} 도착!', { emoji: place.e, name: place.n }));
      // 다녀온 여행지는 비운다. 다음에 다시 오면 보상
      if (place) state.visit(position);
    }
  }
  return { land };
}
