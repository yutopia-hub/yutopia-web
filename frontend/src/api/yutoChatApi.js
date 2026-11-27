import { HAS_BACKEND, request } from './http.js';

const BASE = '/api/ai/yuto/conversations';

// Never manufacture chat answers when the backend is unavailable or mock mode is requested.
export const yutoChatApi = {
  available: HAS_BACKEND && import.meta.env.VITE_USE_MOCK !== 'true',
  create: (course, { signal } = {}) =>
    request(BASE, { method: 'POST', body: { course }, auth: true, signal }),
  read: (id, { signal } = {}) =>
    request(`${BASE}/${encodeURIComponent(id)}`, { auth: true, signal }),
  send: (id, message, { signal } = {}) =>
    request(`${BASE}/${encodeURIComponent(id)}/messages`, {
      method: 'POST', body: { message }, auth: true, signal,
    }),
  remove: (id, { signal } = {}) =>
    request(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true, signal }),
};
