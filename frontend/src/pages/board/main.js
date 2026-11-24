import { t, translateDom } from '../../i18n/i18n.js';
import { createLifecycle } from './lifecycle.js';
import { svgFactory } from './svg-utils.js';
import { createBoardState } from './state.js';
import { drawIsland } from './island.js';
import { drawTiles } from './tiles.js';
import { drawPlayer } from './player.js';
import { drawStars } from './background.js';
import { createUI } from './ui.js';
import { bindPlacement } from './drag.js';
import { createEvents } from './events.js';
import { bindYut } from './yut.js';
import { loadPlaces, normalizePlaces } from './data.js';
import { getBoard, saveBoard } from '../../api/boardApi.js';
import { qs } from '../../utils/dom.js';
import { drawDecorations } from './decorations.js';
import { bindEnvironment } from './environment.js';
import { CarrierIcon } from '../../components/CarrierIcon.js';
import { bindRecommendations } from './recommendation.js';

export function mountBoard(root, { id = 'default' } = {}) {
  const ctx = createLifecycle(qs('.travel-board', root));
  ctx.svg = ctx.$('board');
  ctx.el = svgFactory(ctx.svg);
  const state = createBoardState();
  const island = ctx.el('g', { class: 'board-island', 'pointer-events': 'none' });
  const road = drawIsland({ ...ctx, svg: island, el: svgFactory(island) });
  drawDecorations(ctx);
  drawTiles(ctx);
  const player = drawPlayer(ctx);
  drawStars(ctx);
  const ui = createUI(ctx, state, road, player);
  const unsubscribe = state.subscribe(ui.render);
  ui.render(state.get());
  bindPlacement(ctx, state, ui);
  bindYut(ctx, state, player, createEvents(ctx, state, player, ui), ui);
  bindEnvironment(ctx, state);
  bindRecommendations(ctx, state);
  ctx.motion();
  ctx.on(ctx.$('save'), 'click', async () => {
    try {
      await saveBoard(state.payload(id));
      ctx.check();
      ui.toast(t('보드가 저장되었습니다'));
    } catch (error) {
      if (!ctx.signal.aborted) ui.toast('저장하지 못했어요: ' + error.message);
    }
  });
  translateDom(ctx.root ?? root);
  // 패널 토글 버튼은 보따리 아이콘으로 보여준다
  ctx.$('left-toggle').innerHTML = CarrierIcon({ size: 34 });
  ctx.on(ctx.$('left-toggle'), 'click', () => {
    const collapsed = ctx.$('left').classList.toggle('collapsed');
    const toggle = ctx.$('left-toggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? t('보따리 패널 펼치기') : t('보따리 패널 접기'));
  });
  ctx.on(ctx.$('reset'), 'click', () => {
    state.reset();
    ui.toast(t('보드를 초기화했어요. 저장하면 초기화 상태가 유지됩니다.'));
  });
  (async () => {
    try {
      const places = await loadPlaces();
      ctx.check();
      state.load(places);
      try {
        const saved = await getBoard(id);
        ctx.check();
        if (saved?.boardId === id)
          state.restore(
            saved.cells,
            normalizePlaces(Array.isArray(saved.places) ? saved.places : []),
          );
      } catch (error) {
        if (!ctx.signal.aborted) ui.toast('저장된 보드를 불러오지 못했어요: ' + error.message);
      }
    } catch (error) {
      if (!ctx.signal.aborted) state.fail(error.message);
    }
  })();
  return () => {
    unsubscribe();
    ctx.dispose();
  };
}
