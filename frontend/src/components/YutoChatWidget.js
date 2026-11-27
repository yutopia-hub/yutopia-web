import { authStore, logout } from '../store/authStore.js';
import { createElement, on, render, setText } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import { YutoIcon, yutoMessagesHtml } from './yutoChatMarkup.js';
import '../styles/yuto-chat.css';

let widgetSequence = 0;

/** Views can share a session when a result moves from the modal to the map. */
export function mountYutoChatWidget(container, { session, placement = 'map', onLogin } = {}) {
  const id = `yuto-chat-${++widgetSequence}`;
  const root = createElement('aside', { class: 'yuto-widget', 'data-placement': placement }, container);
  const course = session.getState().course;
  let opened = false;
  let disposed = false;
  let draft = '';
  let confirmReset = false;
  let identityVersion = session.getState().version;
  let previousMessages = '';
  render(root, `
    <section class="yuto-panel" id="${id}" aria-labelledby="${id}-title" hidden>
      <header class="yuto-panel__head">
        <span class="yuto-avatar">${YutoIcon()}</span>
        <div><h3 id="${id}-title">유토</h3><p>이 코스의 이동 도우미</p></div>
        <button type="button" class="yuto-icon-button" data-yuto-action="close" aria-label="유토 대화 닫기">&times;</button>
      </header>
      <details class="yuto-course"><summary>${escapeHtml(course.title)}</summary>
        <ol>${course.stops.map((stop) => `<li>${escapeHtml(stop.title)}</li>`).join('')}</ol>
      </details>
      <div class="yuto-panel__scroll">
        <p class="yuto-welcome">안녕하세요, 유토예요. 이 코스의 이동 시간과 가는 길의 음식점·경찰서 등을 물어보세요.</p>
        <div class="yuto-suggestions">
          <button type="button" data-yuto-question="첫 번째 장소에서 두 번째 장소까지 걸어서 얼마나 걸려?">첫 구간 도보 시간</button>
          <button type="button" data-yuto-question="첫 번째 장소에서 두 번째 장소로 가는 길에 음식점 있어?">가는 길 음식점</button>
          <button type="button" data-yuto-question="첫 번째 장소에서 두 번째 장소로 가는 길에 경찰서나 지구대 있어?">가는 길 경찰서</button>
        </div>
        <ol class="yuto-messages" role="log" aria-label="유토 대화 내용" aria-live="polite" aria-relevant="additions text"></ol>
      </div>
      <div class="yuto-notice" role="status"></div>
      <p class="yuto-error" role="alert" hidden></p>
      <div class="yuto-reset" hidden>현재 대화를 지우고 새로 시작할까요?
        <button type="button" data-yuto-action="reset-confirm">새로 시작</button>
        <button type="button" data-yuto-action="reset-cancel">취소</button>
      </div>
      <form class="yuto-form">
        <label class="sr-only" for="${id}-message">유토에게 질문하기</label>
        <textarea id="${id}-message" name="message" rows="2" maxlength="2000" placeholder="예) 이 식당을 들르면 얼마나 더 걸려?" required></textarea>
        <div class="yuto-form__foot"><button type="button" data-yuto-action="reset">새 대화</button>
          <span class="yuto-counter">0 / 2000</span><button type="submit" class="btn btn-primary">보내기</button></div>
      </form>
    </section>
    <button type="button" class="yuto-launcher" data-yuto-action="toggle" aria-controls="${id}" aria-expanded="false" aria-label="유토와 이 코스 대화하기">
      ${YutoIcon()}<span>유토</span>
    </button>`);
  const panel = root.querySelector('.yuto-panel');
  const textarea = root.querySelector('textarea');
  const log = root.querySelector('.yuto-messages');
  const scroll = root.querySelector('.yuto-panel__scroll');
  const launcher = root.querySelector('.yuto-launcher');

  function focusInput() {
    if (opened && !disposed && !textarea.disabled) textarea.focus();
  }

  function paint() {
    if (disposed) return;
    const state = session.getState();
    if (state.version !== identityVersion) {
      identityVersion = state.version;
      draft = '';
      confirmReset = false;
    }
    panel.hidden = !opened;
    root.classList.toggle('is-open', opened);
    launcher.setAttribute('aria-expanded', String(opened));
    const disabled = state.busy || !state.available || !state.loggedIn || state.requiresLogin || state.expired || state.needsRefresh;
    textarea.disabled = disabled;
    if (textarea.value !== draft) textarea.value = draft;
    root.querySelector('[type="submit"]').disabled = disabled;
    root.querySelector('[data-yuto-action="reset"]').disabled = state.busy || !state.available || !state.loggedIn || state.requiresLogin;
    root.querySelector('.yuto-suggestions').hidden = state.messages.length > 0 || Boolean(state.pendingMessage);
    root.querySelectorAll('[data-yuto-question]').forEach((button) => { button.disabled = disabled; });
    root.querySelector('.yuto-reset').hidden = !confirmReset;
    root.querySelectorAll('.yuto-reset button').forEach((button) => { button.disabled = state.busy; });
    setText(root.querySelector('.yuto-counter'), `${draft.length} / 2000`);
    const notice = !state.available ? '지금은 유토 대화에 연결할 수 없어요. 잠시 후 다시 이용해 주세요.'
      : !state.loggedIn || state.requiresLogin ? '로그인하고 유토와 이 코스에 대해 대화해 보세요. <a href="#/login" data-yuto-action="login">로그인하기</a>'
        : state.phase === 'loading' ? '대화를 준비하고 있어요…'
          : state.expired ? '<button type="button" data-yuto-action="reset-confirm">새 대화 시작</button>'
            : state.needsRefresh ? '<button type="button" data-yuto-action="refresh">답변 상태 확인</button>'
              : state.phase === 'error' && !state.conversationId ? '<button type="button" data-yuto-action="connect">다시 연결</button>' : '';
    render(root.querySelector('.yuto-notice'), notice);
    const error = root.querySelector('.yuto-error');
    error.hidden = !state.error;
    setText(error, state.error);
    const html = yutoMessagesHtml(state);
    if (html !== previousMessages) {
      render(log, html);
      previousMessages = html;
      scroll.scrollTop = scroll.scrollHeight;
    }
  }

  async function submitQuestion(value) {
    const text = value.trim();
    if (!text || text.length > 2000 || textarea.disabled) return;
    const version = session.getState().version;
    draft = '';
    const ok = await session.send(text);
    if (disposed || version !== session.getState().version) return;
    if (!ok && !draft) draft = text;
    paint();
    focusInput();
  }

  on(root, 'input', 'textarea', () => {
    draft = textarea.value;
    setText(root.querySelector('.yuto-counter'), `${draft.length} / 2000`);
  });
  on(root, 'submit', '.yuto-form', (event) => {
    event.preventDefault();
    void submitQuestion(textarea.value);
  });
  on(root, 'keydown', (event) => {
    if (event.key === 'Escape' && opened) {
      event.preventDefault();
      event.stopPropagation();
      opened = false;
      paint();
      launcher.focus();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target === textarea) {
      event.preventDefault();
      void submitQuestion(textarea.value);
    }
  });
  on(root, 'click', '[data-yuto-question]', (_event, button) => { void submitQuestion(button.dataset.yutoQuestion); });
  on(root, 'click', '[data-yuto-action]', async (_event, button) => {
    const action = button.dataset.yutoAction;
    if (action === 'toggle' || action === 'close') {
      opened = action === 'toggle' && !opened;
      paint();
      if (opened) { await session.open(); if (!disposed) { paint(); focusInput(); } }
      else launcher.focus();
    } else if (action === 'login') {
      onLogin?.();
      logout();
    } else if (action === 'reset') {
      confirmReset = true;
      paint();
    } else if (action === 'reset-cancel') {
      confirmReset = false;
      paint();
    } else if (action === 'reset-confirm') {
      confirmReset = false;
      if (await session.restart()) draft = '';
      if (!disposed) { paint(); focusInput(); }
    } else if (action === 'refresh' || action === 'connect') {
      await (action === 'refresh' ? session.refresh() : session.open());
      if (!disposed) {
        const messages = session.getState().messages;
        if (messages.at(-1)?.user === draft) draft = '';
        paint(); focusInput();
      }
    }
  });
  const unsubscribe = session.subscribe(paint);
  const unsubscribeAuth = authStore.subscribe(() => { session.syncIdentity(); paint(); });
  const onStorage = (event) => {
    if (event.storageArea === localStorage && [null, 'travel-notice:user', 'travel-notice:token'].includes(event.key)) {
      session.syncIdentity(); paint();
    }
  };
  window.addEventListener('storage', onStorage);
  session.syncIdentity();
  paint();
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe(); unsubscribeAuth(); root.remove();
      window.removeEventListener('storage', onStorage);
    },
  };
}
