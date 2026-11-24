const PREFIX = 'travel-notice:';

export function setItem(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function getItem(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function removeItem(key) {
  localStorage.removeItem(PREFIX + key);
}
