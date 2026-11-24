import { slots, N } from './config.js';

// 마일리지(한 바퀴 돌 때마다 +1)와 보상 수는 보드를 초기화해도 남도록 따로 저장한다.
const PROGRESS_KEY = 'travel-notice:board-progress';
function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    return { mileage: Number(saved?.mileage) || 0, rewards: Number(saved?.rewards) || 0 };
  } catch {
    return { mileage: 0, rewards: 0 };
  }
}
function writeProgress({ mileage, rewards }) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ mileage, rewards }));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function createBoardState() {
  let value = {
    places: [],
    source: 'carrier',
    carrierIds: [],
    recommendationIds: [],
    recommendationStatus: 'idle',
    recommendationError: '',
    recommendationNote: '',
    revision: 0,
    filled: {},
    position: 0,
    isBusy: false,
    selected: null,
    destinations: [],
    status: 'loading',
    error: '',
    result: '',
    // started: 한 번 출발하면 빈 칸이 생겨도 계속 던질 수 있다
    started: false,
    // visited: 들러서 비워진 칸. 다음에 다시 오면 보상을 준다
    visited: [],
    ...readProgress(),
    environment: {
      weather: null,
      status: 'loading',
      location: '서울 기준',
      locating: false,
      note: '',
    },
  };
  const subscribers = new Set();
  function set(patch) {
    if ('filled' in patch || 'places' in patch) patch = { ...patch, revision: value.revision + 1 };
    value = { ...value, ...patch };
    value.isReady = value.started || Object.keys(value.filled).length === slots.length;
    subscribers.forEach((fn) => fn(value));
  }
  return {
    environment(patch) {
      set({ environment: { ...value.environment, ...patch } });
    },
    get: () => value,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    load(places) {
      const merged = [...new Map([...value.places, ...places].map((p) => [p.id, p])).values()];
      set({
        places: merged,
        carrierIds: places.map((p) => p.id),
        status: 'loaded',
        error: '',
        selected: null,
      });
    },
    source(source) {
      if (['carrier', 'recommended'].includes(source)) set({ source, selected: null });
    },
    recommendations({ places, status, error = '', note = '' }) {
      const patch = {
        recommendationStatus: status,
        recommendationError: error,
        recommendationNote: note,
      };
      if (places) {
        patch.places = [...new Map([...value.places, ...places].map((p) => [p.id, p])).values()];
        patch.recommendationIds = places.slice(0, 8).map((p) => p.id);
      }
      set(patch);
    },
    fail(error) {
      set({ status: 'error', error });
    },
    select(id) {
      if (!value.isBusy) set({ selected: id });
    },
    put(index, id) {
      const place = value.places.find((p) => p.id === id);
      if (
        !place ||
        value.isBusy ||
        !slots.includes(index) ||
        value.filled[index] ||
        Object.values(value.filled).includes(id)
      )
        return false;
      set({ filled: { ...value.filled, [index]: id }, selected: null });
      return true;
    },
    applyRecommendation(cells, places, expectedRevision) {
      if (
        value.status !== 'loaded' ||
        value.started ||
        value.isBusy ||
        value.revision !== expectedRevision ||
        !Array.isArray(cells) ||
        cells.length !== slots.length ||
        new Set(cells.map((c) => c.index)).size !== slots.length ||
        new Set(cells.map((c) => c.placeId)).size !== slots.length ||
        cells.some((c) => !slots.includes(c.index) || !places.some((p) => p.id === c.placeId))
      )
        return false;
      // One notification, no reset: mileage, rewards and progress are left intact.
      set({
        places,
        filled: Object.fromEntries(cells.map((c) => [c.index, c.placeId])),
        selected: null,
      });
      return true;
    },
    restore(cells, savedPlaces = []) {
      const savedIds = new Set((Array.isArray(cells) ? cells : []).map((c) => String(c?.placeId)));
      const places = [
        ...new Map(
          [...savedPlaces.filter((p) => savedIds.has(p.id)), ...value.places].map((p) => [p.id, p]),
        ).values(),
      ];
      const filled = {};
      for (const cell of Array.isArray(cells) ? cells : []) {
        if (
          slots.includes(cell?.index) &&
          places.some((p) => p.id === String(cell.placeId)) &&
          !filled[cell.index] &&
          !Object.values(filled).includes(String(cell.placeId))
        )
          filled[cell.index] = String(cell.placeId);
      }
      set({ filled, places });
    },
    busy(isBusy) {
      set({ isBusy });
    },
    move(position) {
      const next = ((position % N) + N) % N;
      const prev = value.position;
      // 앞으로 몇 칸 가다가 출발점을 지나치면 한 바퀴. (공항 비행처럼 크게 점프한 건 제외)
      const lapped = next < prev && next + N - prev <= 6;
      if (lapped) writeProgress({ mileage: value.mileage + 1, rewards: value.rewards });
      set({ position: next, ...(lapped ? { mileage: value.mileage + 1 } : {}) });
    },
    start() {
      if (!value.started) set({ started: true });
    },
    /** 도착한 칸을 비우고 방문 표시를 남긴다. */
    visit(index) {
      if (!value.filled[index]) return;
      const filled = { ...value.filled };
      delete filled[index];
      set({ filled, visited: [...new Set([...value.visited, index])] });
    },
    /** 방문했던 칸에 다시 오면 보상 1개. 보상을 받으면 true. */
    claimReward(index) {
      if (!value.visited.includes(index)) return false;
      const rewards = value.rewards + 1;
      writeProgress({ mileage: value.mileage, rewards });
      set({ rewards, visited: value.visited.filter((i) => i !== index) });
      return true;
    },
    result(result) {
      set({ result });
    },
    destinations(destinations) {
      set({ destinations });
    },
    reset() {
      if (!value.isBusy)
        set({
          filled: {},
          position: 0,
          selected: null,
          destinations: [],
          result: '',
          started: false,
          visited: [],
        });
    },
    payload(boardId) {
      return {
        boardId,
        places: value.places.filter((p) => Object.values(value.filled).includes(p.id)),
        cells: Object.entries(value.filled).map(([index, placeId]) => ({
          index: Number(index),
          placeId,
        })),
      };
    },
  };
}
