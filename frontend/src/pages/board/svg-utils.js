import { createElement, render } from '../../utils/dom.js';

export const dia = (x, y, w, h) =>
  `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`;

export function svgFactory(svg) {
  return (tag, attributes = {}, parent = svg, html) => {
    const node = createElement(tag, attributes, parent, 'http://www.w3.org/2000/svg');
    if (html) render(node, html);
    return node;
  };
}

export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
