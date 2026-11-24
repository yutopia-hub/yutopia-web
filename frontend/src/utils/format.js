export function formatDate(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return String(dateLike);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function truncate(text, length = 80) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// 외부 API 문자열을 innerHTML 템플릿에 넣을 때는 항상 이걸 거친다.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function nl2br(text) {
  return escapeHtml(text).replace(/\n/g, '<br />');
}
