let courseSequence = 0;

/** Keep visit order and coordinates, without mutating the recommendation or exposing source IDs. */
export function makeYutoCourse(course) {
  if (!Array.isArray(course?.stops) || course.stops.length < 2 || course.stops.length > 12) {
    throw new Error('유토와 대화하려면 위치 정보가 있는 장소가 2~12곳 필요해요.');
  }
  const stops = course.stops.map((stop, index) => {
    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number'
      || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)
      || Math.abs(stop.lat) > 85 || Math.abs(stop.lng) > 180 || !String(stop.title ?? '').trim()) {
      throw new Error('코스 장소의 위치 정보를 확인할 수 없어 유토 대화를 시작하지 못했어요.');
    }
    return Object.freeze({ id: `stop-${index + 1}`, title: String(stop.title).trim().slice(0, 100), lat: stop.lat, lng: stop.lng });
  });
  return Object.freeze({
    courseId: globalThis.crypto?.randomUUID?.() ?? `course-${Date.now()}-${++courseSequence}`,
    title: String(course.title || '추천 코스').slice(0, 100),
    stops: Object.freeze(stops),
  });
}

function turns(value) {
  if (!Array.isArray(value)) throw new Error('대화 이력을 확인하지 못했어요.');
  return value.slice(-20).map((turn) => {
    if (typeof turn.user !== 'string' || typeof turn.assistant !== 'string') throw new Error('대화 이력을 확인하지 못했어요.');
    return { user: turn.user, assistant: turn.assistant, evidence: Array.isArray(turn.evidence) ? turn.evidence : [] };
  });
}

/** Per-course API session; request ownership and stale responses are independent of the DOM. */
export function createYutoChatSession(course, { api, getIdentity }) {
  const context = makeYutoCourse(course);
  const listeners = new Set();
  const identityKey = () => {
    const { token, user } = getIdentity();
    return `${user?.id ?? ''}\0${token ?? ''}`;
  };
  let owner = identityKey();
  let sequence = 0;
  let version = 0;
  let disposed = false;
  let controller;
  const empty = () => ({ conversationId: null, messages: [], phase: 'idle', error: '',
    pendingMessage: '', expired: false, requiresLogin: false, needsRefresh: false, expiresAt: null });
  let state = empty();
  const busy = () => ['loading', 'sending'].includes(state.phase);
  const emit = () => listeners.forEach((listener) => listener());

  function syncIdentity() {
    if (disposed || owner === identityKey()) return;
    owner = identityKey();
    sequence++;
    version++;
    controller?.abort();
    state = empty();
    emit();
  }

  function canConnect() {
    const identity = getIdentity();
    return Boolean(api.available && identity.token && identity.user?.id && !state.requiresLogin);
  }

  async function perform(phase, work, pendingMessage = '') {
    syncIdentity();
    if (disposed || busy() || !canConnect()) return false;
    const ticket = ++sequence;
    controller = new AbortController();
    const current = () => {
      syncIdentity();
      return !disposed && ticket === sequence;
    };
    state = { ...state, phase, error: '', pendingMessage };
    emit();
    try {
      const patch = await work(controller.signal, current);
      if (!current() || !patch) return false;
      state = { ...state, ...patch, phase: 'ready', pendingMessage: '', error: '', needsRefresh: false,
        expired: false, requiresLogin: false };
      emit();
      return true;
    } catch (error) {
      if (!current()) return false;
      const status = error?.status;
      state = { ...state, phase: 'error', pendingMessage: '', expired: status === 404,
        requiresLogin: status === 401,
        needsRefresh: Boolean(state.conversationId && ![400, 401, 404].includes(status)),
        error: status === 404 ? '대화가 만료되었어요. 새 대화를 시작해 주세요.'
          : status === 401 ? '로그인이 만료되었어요. 다시 로그인해 주세요.'
            : status ? error.message : '연결을 확인하지 못했어요. 답변 상태를 확인한 뒤 다시 질문해 주세요.' };
      emit();
      return false;
    }
  }

  function snapshot(data) {
    if (typeof data?.conversationId !== 'string' || !data.conversationId
      || data.course?.courseId !== context.courseId) throw new Error('이 코스의 대화를 확인하지 못했어요.');
    return { conversationId: data.conversationId, messages: turns(data.turns), expiresAt: data.expiresAt };
  }

  function open() {
    syncIdentity();
    if (state.conversationId) return Promise.resolve(!state.expired);
    return perform('loading', async (signal) => snapshot(await api.create(context, { signal })));
  }

  function send(value) {
    syncIdentity();
    const message = String(value ?? '').trim();
    if (!message || message.length > 2000 || busy() || state.expired || state.needsRefresh) return Promise.resolve(false);
    return perform('sending', async (signal, current) => {
      if (!state.conversationId) {
        const data = await api.create(context, { signal });
        if (!current()) return null;
        state = { ...state, ...snapshot(data) };
      }
      const data = await api.send(state.conversationId, message, { signal });
      if (!current()) return null;
      if (data?.conversationId !== state.conversationId || typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('답변 상태를 확인하지 못했어요.');
      }
      return { messages: [...state.messages, { user: message, assistant: data.answer,
        evidence: Array.isArray(data.evidence) ? data.evidence : [] }].slice(-20), expiresAt: data.expiresAt };
    }, message);
  }

  function refresh() {
    syncIdentity();
    if (!state.conversationId) return open();
    return perform('loading', async (signal) => snapshot(await api.read(state.conversationId, { signal })));
  }

  function restart() {
    return perform('loading', async (signal, current) => {
      if (state.conversationId && !state.expired) {
        await api.remove(state.conversationId, { signal });
        if (!current()) return null;
      }
      state = { ...empty(), phase: 'loading' };
      return snapshot(await api.create(context, { signal }));
    });
  }

  return {
    open, send, refresh, restart, syncIdentity,
    getState() {
      const identity = getIdentity();
      return { ...state, messages: [...state.messages], course: context, version, disposed,
        busy: busy(), available: Boolean(api.available), loggedIn: Boolean(identity.token && identity.user?.id) };
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose({ deleteConversation = false } = {}) {
      if (disposed) return;
      const canDelete = deleteConversation && state.conversationId && owner === identityKey() && api.available;
      disposed = true;
      sequence++;
      controller?.abort();
      listeners.clear();
      if (canDelete) void api.remove(state.conversationId).catch(() => {});
    },
  };
}
