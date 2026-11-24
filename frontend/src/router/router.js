/**
 * 해시 기반 초경량 라우터.
 * 프레임워크 없이 페이지 전환을 처리하기 위한 최소 구현.
 */
import { render } from '../utils/dom.js';

const routes = new Map();
let disposePage = null;
let resolution = 0;
let notFoundHandler = () => '<h1>404 Not Found</h1>';

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function registerNotFound(handler) {
  notFoundHandler = handler;
}

function parseHash() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString));
  return { path, params };
}

async function resolve() {
  const current = ++resolution;
  disposePage?.();
  disposePage = null;
  const { path, params } = parseHash();

  // 정적 경로 우선 매칭, 없으면 /notices/:id 같은 동적 경로 매칭
  let handler = routes.get(path);
  let routeParams = params;

  if (!handler) {
    for (const [pattern, fn] of routes.entries()) {
      const match = matchDynamic(pattern, path);
      if (match) {
        handler = fn;
        routeParams = { ...params, ...match };
        break;
      }
    }
  }

  const root = document.getElementById('app-root');
  if (!handler) {
    const html = await notFoundHandler();
    if (current === resolution) render(root, html);
    return;
  }

  const html = await handler(routeParams);
  if (current !== resolution) return;
  render(root, html);
  disposePage = handler.mount?.(root, routeParams) ?? null;
}

function matchDynamic(pattern, path) {
  if (!pattern.includes(':')) return null;
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function navigate(path) {
  window.location.hash = path;
}

// module 스크립트는 DOM 파싱이 끝난 뒤 실행되므로 DOMContentLoaded를 따로 기다리지 않는다.
// (기다리면 첫 화면이 두 번 렌더링되어 이벤트가 중복 등록된다)
export function initRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
