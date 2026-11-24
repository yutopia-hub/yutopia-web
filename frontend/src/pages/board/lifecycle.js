import { qs } from '../../utils/dom.js';

export function createLifecycle(root) {
  const controller = new AbortController();
  const animations = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (id) => qs(`#board-${id}`, root);
  function check() {
    controller.signal.throwIfAborted();
  }
  function wait(ms) {
    check();
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Page left', 'AbortError'));
      };
      const timer = setTimeout(
        () => {
          controller.signal.removeEventListener('abort', abort);
          resolve();
        },
        reduced.matches ? 0 : ms,
      );
      controller.signal.addEventListener('abort', abort, { once: true });
    });
  }
  function animate(node, frames, options) {
    check();
    const animation = node.animate(frames, {
      ...options,
      duration: reduced.matches ? 0 : options.duration,
    });
    animations.add(animation);
    // Register a rejection handler immediately: cancelling during route changes is expected.
    animation.finished.catch(() => {});
    return animation;
  }
  function cancel(animation) {
    animation.cancel();
    animations.delete(animation);
  }
  function on(node, event, handler) {
    node.addEventListener(event, handler, { signal: controller.signal });
  }
  function motion() {
    for (const svg of root.querySelectorAll('svg')) {
      if (reduced.matches) svg.pauseAnimations();
      else svg.unpauseAnimations();
    }
  }
  on(reduced, 'change', motion);
  return {
    root,
    $,
    wait,
    animate,
    cancel,
    on,
    check,
    motion,
    signal: controller.signal,
    dispose() {
      controller.abort();
      animations.forEach((a) => a.cancel());
      animations.clear();
    },
  };
}
