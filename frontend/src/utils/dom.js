/**
 * innerHTML 기반 렌더링 헬퍼. 페이지/컴포넌트는 HTML 문자열을 반환하고
 * 이 함수로 실제 DOM에 꽂아 넣는다.
 */
export function render(target, html) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  el.innerHTML = html;
  return el;
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function createElement(tag, attributes = {}, parent, namespace) {
  const node = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}

export function on(target, event, selectorOrHandler, maybeHandler) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;

  if (typeof selectorOrHandler === 'function') {
    el.addEventListener(event, selectorOrHandler);
    return;
  }

  // 이벤트 위임: el 안에서 selector에 매칭되는 요소에서 발생한 이벤트만 처리
  el.addEventListener(event, (e) => {
    const match = e.target.closest(selectorOrHandler);
    if (match && el.contains(match)) {
      maybeHandler(e, match);
    }
  });
}

export function setText(target, text) {
  const el = typeof target === 'string' ? qs(target) : target;
  if (el) el.textContent = text;
}
export function setFormBusy(form, busy) {
  if (!form) return;
  if (busy) form.dataset.busy = 'true';
  else delete form.dataset.busy;
  qsa('button', form).forEach((button) => {
    button.disabled = busy;
  });
}

export function isFormBusy(form) {
  return Boolean(form.dataset.busy);
}

export function showFormErrors(form, errors, { focus = false, fields } = {}) {
  let firstInvalid;
  qsa('input[name]', form).forEach((input) => {
    if (fields && !fields.includes(input.name)) return;
    const message = errors[input.name] || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    const output = qsa('[data-error-for]', form).find((el) => el.dataset.errorFor === input.name);
    setText(output, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  if (focus && firstInvalid) firstInvalid.focus();
  return Object.keys(errors).length === 0;
}
export function bindFormValidation(selector, validate) {
  const touched = new WeakSet();
  on(document, 'focusout', `${selector} input[name]`, (event, input) => {
    touched.add(input);
    const form = input.form;
    showFormErrors(form, validate(Object.fromEntries(new FormData(form))), {
      fields: [input.name],
    });
  });
  on(document, 'input', `${selector} input[name]`, (event, input) => {
    const form = input.form;
    const fields = qsa('input[name]', form)
      .filter((field) => touched.has(field) || field.getAttribute('aria-invalid') === 'true')
      .map((field) => field.name);
    showFormErrors(form, validate(Object.fromEntries(new FormData(form))), { fields });
  });
}

export function syncNavIndicator(target, path) {
  const container = typeof target === 'string' ? qs(target) : target;
  if (!container) return;
  let selected;
  qsa('.nav-tab', container).forEach((link) => {
    const route = link.getAttribute('href').slice(1);
    const active = route === '/' ? path === '/' : path === route || path.startsWith(`${route}/`);
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    if (active && !link.classList.contains('nav-brand')) selected = link;
  });
  const indicator = qs('.nav-indicator', container);
  if (!indicator) return;
  if (!selected) {
    indicator.style.opacity = '0';
    return;
  }
  const bounds = container.getBoundingClientRect();
  const tab = selected.getBoundingClientRect();
  indicator.style.width = `${tab.width}px`;
  indicator.style.transform = `translate(${tab.left - bounds.left}px, ${tab.bottom - bounds.top}px)`;
  indicator.style.opacity = '1';
}
export function observeSize(target, callback) {
  const element = typeof target === 'string' ? qs(target) : target;
  if (!element) return;
  const observer = new ResizeObserver(callback);
  observer.observe(element);
  return () => observer.disconnect();
}
