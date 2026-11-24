import { carrierStore } from '../../store/carrierStore.js';
import { toBoardPlace } from '../../api/favoriteApi.js';
import { getRecommendationCatalog } from '../../api/recommendationApi.js';
import { getRecommendationWeather } from '../../api/recommendationWeatherApi.js';
import { recommendPlaces } from '../../algorithm/recommendation/recommendationEngine.js';
import { normalizeCandidates } from '../../algorithm/recommendation/normalizePlaces.js';
import { normalizePlaces } from './data.js';
import { slots } from './config.js';
import '../../styles/board-recommendation.css';

export function bindRecommendations(ctx, state) {
  let dirty = true;
  let running = false;
  let version = 0;
  let request = null;
  let previousFilled = state.get().filled;

  function cancel() {
    version++;
    request?.abort();
    running = false;
  }
  async function load() {
    if (!dirty || running || state.get().source !== 'recommended' || ctx.signal.aborted) return;
    const currentVersion = ++version;
    request = new AbortController();
    const signal = request.signal;
    running = true;
    const value = state.get();
    const carrier = carrierStore.getState().items;
    const board = slots.flatMap((index) => {
      const place = value.places.find((p) => p.id === value.filled[index]);
      return place ? [place] : [];
    });
    state.recommendations({ places: [], status: 'loading' });
    try {
      const catalog = await getRecommendationCatalog({ signal });
      const candidates = normalizeCandidates([...catalog.places, ...carrier, ...board]);
      const weather = await getRecommendationWeather(candidates, { signal });
      signal.throwIfAborted();
      if (ctx.signal.aborted || currentVersion !== version) return;
      const result = recommendPlaces({
        carrier,
        board,
        candidates: catalog.places,
        weatherById: weather.weatherById,
      });
      const originals = new Map(
        [...catalog.places, ...carrier, ...board].map((p) => [String(p.id), p]),
      );
      const places = normalizePlaces(
        result.recommendations.map((recommendation) => {
          const original = originals.get(recommendation.id);
          return { ...(original.n ? original : toBoardPlace(original)), recommendation };
        }),
      );
      const notes = ['전국 여행지에서 골랐어요. 마음에 드는 곳을 한 곳씩 놓아보세요.'];
      if (catalog.isMock) notes.push('현재는 예시 여행지로 추천해요.');
      if (catalog.failedAreas) notes.push('일부 지역을 불러오지 못해 확인된 여행지로 추천했어요.');
      if (places.length < 8) notes.push(`현재 확인된 추천 여행지는 ${places.length}곳이에요.`);
      dirty = false;
      state.recommendations({ places, status: 'loaded', note: notes.join(' ') });
    } catch (error) {
      if (!ctx.signal.aborted && currentVersion === version) {
        state.recommendations({
          places: [],
          status: 'error',
          error: error.message || '추천 여행지를 불러오지 못했어요.',
        });
      }
    } finally {
      if (currentVersion === version) running = false;
    }
  }
  ctx.on(ctx.$('source-carrier'), 'click', () => {
    if (state.get().isBusy) return;
    if (running) {
      cancel();
      state.recommendations({ places: [], status: 'idle' });
    }
    state.source('carrier');
  });
  ctx.on(ctx.$('source-recommended'), 'click', () => {
    if (state.get().isBusy || state.get().status !== 'loaded') return;
    state.source('recommended');
    void load();
  });
  ctx.on(ctx.$('recommend-retry'), 'click', () => {
    if (state.get().isBusy) return;
    dirty = true;
    void load();
  });
  const unsubscribeState = state.subscribe((value) => {
    if (value.filled === previousFilled) return;
    previousFilled = value.filled;
    dirty = true;
    if (running) {
      cancel();
      queueMicrotask(() => {
        void load();
      });
    }
  });
  const unsubscribeBag = carrierStore.subscribe(({ items }) => {
    dirty = true;
    cancel();
    state.load(normalizePlaces(items.map(toBoardPlace)));
    if (state.get().source === 'recommended') void load();
  });
  ctx.signal.addEventListener(
    'abort',
    () => {
      cancel();
      unsubscribeState();
      unsubscribeBag();
    },
    { once: true },
  );
}
