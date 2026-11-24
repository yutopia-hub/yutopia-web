import { createElement, render } from '../../utils/dom.js';
import { N } from './config.js';
import { step } from './player.js';
import { rollYut } from './yut-result.js';

export function bindYut(ctx, state, player, events, ui) {
  const { $ } = ctx;
  const overlay = $('thrown'),
    bubble = $('bub');
  function clearThrow() {
    overlay.style.opacity = '0';
    bubble.style.opacity = '0';
    render(overlay, '');
  }
  ctx.signal.addEventListener('abort', clearThrow, { once: true });
  ctx.on($('roll'), 'click', async () => {
    if (state.get().isBusy || !state.get().isReady) return;
    state.busy(true);
    state.start();
    state.result('');
    const result = rollYut();
    const animations = [];
    try {
      const button = $('roll').getBoundingClientRect();
      const board = ctx.svg.getBoundingClientRect();
      const centerX = board.left + board.width / 2;
      const centerY = board.top + board.height / 2 - 50;
      overlay.style.opacity = '1';
      bubble.style.opacity = '0';
      for (let index = 0; index < 4; index++) {
        const flat = result.flatFaces[index];
        const flight = createElement(
          'div',
          { class: 'yut-flight', 'data-flat': String(flat) },
          overlay,
        );
        const stick = createElement('div', { class: 'yut-stick' }, flight);
        render(
          stick,
          '<i class="yut-flat"></i><i class="yut-round"></i><i class="yut-edge left"></i><i class="yut-edge right"></i>',
        );
        const shadow = createElement('i', { class: 'yut-shadow' }, overlay);
        const x0 = button.left + button.width / 2 - 12 + (index - 1.5) * 9;
        const y0 = button.top - 50;
        const x1 = centerX + (index - 1.5) * 55 + Math.random() * 22 - 11;
        const y1 = centerY + (index % 2) * 32 + Math.random() * 18;
        const mx = (x0 + x1) / 2;
        const endAngle = (index - 1.5) * 18 + Math.random() * 24 - 12;
        const spin = index % 2 ? -720 : 720;
        const duration = 1500 + index * 70;
        const key = (x, y, scale, angle, offset, easing = 'linear') => ({
          transform: `translate(${x}px,${y}px) scale(${scale}) rotate(${angle}deg)`,
          offset,
          easing,
        });
        animations.push(
          ctx.animate(
            flight,
            [
              key(x0, y0, 0.5, 0, 0, 'ease-out'),
              key(mx, Math.min(y0, y1) - 170 - index * 12, 1.4, spin * 0.4, 0.35, 'ease-in'),
              key(x1, y1, 1, spin * 0.7, 0.62, 'ease-out'),
              key(x1 + 18, y1 - 45 - index * 5, 1.08, spin * 0.85, 0.76, 'ease-in'),
              key(x1 + 28, y1, 1, spin + endAngle, 0.92, 'ease-out'),
              key(x1 + 30, y1, 1, spin + endAngle, 1),
            ],
            { duration, fill: 'forwards' },
          ),
        );
        const faceAngle = flat ? 0 : 180;
        animations.push(
          ctx.animate(
            stick,
            [
              { transform: 'rotateX(18deg) rotateY(0deg)', offset: 0 },
              { transform: `rotateX(38deg) rotateY(${1080 + index * 360}deg)`, offset: 0.6 },
              {
                transform: `rotateX(18deg) rotateY(${1440 + index * 360 + faceAngle}deg)`,
                offset: 1,
              },
            ],
            { duration, easing: 'ease-out', fill: 'forwards' },
          ),
        );
        animations.push(
          ctx.animate(
            shadow,
            [
              key(x0 - 12, y1 + 105, 0.3, 0, 0),
              key(mx - 12, y1 + 105, 0.45, endAngle, 0.35),
              key(x1 - 12, y1 + 105, 1, endAngle, 0.62),
              key(x1 + 6, y1 + 105, 0.7, endAngle, 0.76),
              key(x1 + 18, y1 + 105, 1, endAngle, 1),
            ],
            { duration, fill: 'forwards' },
          ),
        );
      }
      await Promise.all(animations.map((animation) => animation.finished));
      ctx.check();
      const message = `${result.name}! ${result.steps}칸 이동!`;
      state.result(message);
      bubble.textContent = message;
      bubble.style.left = centerX + 'px';
      bubble.style.top = centerY - 45 + 'px';
      bubble.style.opacity = '1';
      await ctx.wait(900);
      overlay.style.opacity = '0';
      bubble.style.opacity = '0';
      await ctx.wait(350);
      animations.forEach(ctx.cancel);
      render(overlay, '');
      for (let i = 0; i < result.steps; i++) {
        await step(ctx, state, player, (state.get().position + 1) % N);
      }
      await events.land();
    } catch (error) {
      if (!ctx.signal.aborted) ui.toast('윷을 다시 던져주세요: ' + error.message);
    } finally {
      animations.forEach(ctx.cancel);
      clearThrow();
      if (!ctx.signal.aborted) {
        state.busy(false);
        $('roll').focus();
      }
    }
  });
}
