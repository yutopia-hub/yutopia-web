import { request, HAS_BACKEND } from './http.js';
import { carrierStore, replaceCarrier } from '../store/carrierStore.js';
import { authStore, logout } from '../store/authStore.js';

/**
 * 보따리(carrierStore) ↔ 백엔드 찜(/api/members/me/favorites) 동기화.
 *
 * - 화면은 지금처럼 carrierStore 만 바꾼다 (로컬 우선 · 즉시 반영).
 * - 로그인 상태 + VITE_API_BASE_URL 이 있으면, 스토어 변경을 감지해서 서버에 담기/빼기/메모를 보낸다.
 * - 로그인하는 순간 서버 목록을 받아 로컬에만 있던 항목을 올리고, 합친 결과로 스토어를 맞춘다.
 * 백엔드가 없으면 아무 일도 하지 않는다.
 */

const path = (id) => `/api/members/me/favorites/${encodeURIComponent(id)}`;

function toPayload(item) {
  return {
    provider: String(item.id).startsWith('kakao:') ? 'KAKAO' : 'TOUR_API',
    title: item.title,
    address: item.address,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    image: item.image || '',
    thumbnail: item.thumbnail || '',
    contentTypeId: item.contentTypeId ?? null,
    placeUrl: item.placeUrl ?? null,
    memo: item.memo || null,
  };
}

/** 서버 응답 + (있으면) 로컬 항목의 풍부한 필드를 합친다. 서버에 없는 tags·setting 등은 로컬 값을 유지. */
function mergeItem(server, local) {
  return {
    ...local,
    id: server.id,
    contentTypeId: server.contentTypeId ?? local?.contentTypeId,
    title: server.title ?? local?.title,
    address: server.address ?? local?.address,
    image: server.image ?? local?.image ?? '',
    thumbnail: server.thumbnail ?? local?.thumbnail ?? '',
    lat: server.lat ?? local?.lat ?? null,
    lng: server.lng ?? local?.lng ?? null,
    ...(server.placeUrl || local?.placeUrl ? { placeUrl: server.placeUrl ?? local.placeUrl } : {}),
    cat1: local?.cat1 ?? server.cat1 ?? '',
    cat2: local?.cat2 ?? server.cat2 ?? '',
    cat3: local?.cat3 ?? server.cat3 ?? '',
    areaCode: local?.areaCode ?? server.areaCode ?? '',
    tags: local?.tags?.length ? local.tags : (server.tags ?? []),
    setting: local?.setting ?? server.setting,
    memo: server.memo ?? '',
    addedAt: server.addedAt ?? local?.addedAt ?? new Date().toISOString(),
  };
}

let applyingServerState = false;
let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch((error) => {
    if (error?.status === 401)
      logout(); // 토큰 만료 → 로그아웃 (로컬 보따리는 유지)
    else console.warn('[carrier-sync]', error.message);
  });
  return queue;
}

const isOnline = () => HAS_BACKEND && Boolean(authStore.getState().token);

/** 로그인 직후: 서버 ∪ 로컬. 로컬에만 있던 항목은 서버로 올린다. */
export function pullAndMerge() {
  if (!isOnline()) return Promise.resolve();
  return enqueue(async () => {
    const serverItems = (await request('/api/members/me/favorites', { auth: true })) ?? [];
    const localItems = carrierStore.getState().items;
    const serverIds = new Set(serverItems.map((item) => item.id));
    const uploaded = [];
    for (const item of localItems.filter((local) => !serverIds.has(local.id))) {
      uploaded.push(
        await request(path(item.id), { method: 'PUT', body: toPayload(item), auth: true }),
      );
    }
    const localById = new Map(localItems.map((item) => [item.id, item]));
    const merged = [...serverItems, ...uploaded].map((server) =>
      mergeItem(server, localById.get(server.id)),
    );
    applyingServerState = true;
    try {
      replaceCarrier(merged);
    } finally {
      applyingServerState = false;
    }
  });
}

function diff(prevItems, nextItems) {
  const prev = new Map(prevItems.map((item) => [item.id, item]));
  const next = new Map(nextItems.map((item) => [item.id, item]));
  nextItems.forEach((item) => {
    const before = prev.get(item.id);
    if (!before) {
      enqueue(() => request(path(item.id), { method: 'PUT', body: toPayload(item), auth: true }));
    } else if ((before.memo || '') !== (item.memo || '')) {
      enqueue(() =>
        request(path(item.id), { method: 'PATCH', body: { memo: item.memo || '' }, auth: true }),
      );
    }
  });
  prevItems.forEach((item) => {
    if (!next.has(item.id)) {
      enqueue(() => request(path(item.id), { method: 'DELETE', auth: true }));
    }
  });
}

let started = false;

/** main.js 에서 한 번 호출한다. */
export function startCarrierSync() {
  if (started || !HAS_BACKEND) return;
  started = true;

  let lastItems = carrierStore.getState().items;
  carrierStore.subscribe(({ items }) => {
    const prev = lastItems;
    lastItems = items;
    if (applyingServerState || prev === items || !isOnline()) return;
    diff(prev, items);
  });

  let lastToken = authStore.getState().token;
  authStore.subscribe(({ token }) => {
    const loggedIn = token && token !== lastToken;
    lastToken = token;
    if (loggedIn) pullAndMerge();
  });

  // 새로고침 시 이미 로그인 상태라면 서버 상태를 한 번 반영한다.
  pullAndMerge();
}

/** 테스트용 */
export const __test__ = { toPayload, mergeItem };
