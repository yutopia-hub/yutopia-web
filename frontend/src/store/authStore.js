import { createStore } from './store.js';
import { getItem, setItem, removeItem } from '../utils/storage.js';

export const authStore = createStore({
  user: getItem('user', null),
  token: getItem('token', null),
});

export function login(user, token) {
  setItem('user', user);
  setItem('token', token);
  authStore.setState({ user, token });
}

export function logout() {
  removeItem('user');
  removeItem('token');
  authStore.setState({ user: null, token: null });
}

export function isAuthenticated() {
  return Boolean(authStore.getState().token);
}

export function updateUser(user) {
  setItem('user', user);
  authStore.setState({ user });
}
