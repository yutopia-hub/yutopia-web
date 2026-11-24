import { pts, FIX } from './config.js';
import { dia } from './svg-utils.js';
import { escapeHtml } from './svg-utils.js';
import { qs, render } from '../../utils/dom.js';
export function drawTiles({ el }) {
  const T = {
    start: ['#ffeaa3', '#f0c030', '#c99700', 'START', '여행 시작', 100, ''],
    key: ['#ffd84a', '#e9ad00', '#b07f00', '황금 열쇠', '랜덤 이벤트', 108, ''],
    plane: ['#d2f0fb', '#6fc3e4', '#2b9ac0', '공항', '원하는 곳으로 이동', 150, '✈️'],
  };
  pts.forEach((p, i) => {
    const g = el('g', { class: 'slot', 'data-i': i }),
      k = FIX[i],
      t = T[k] || ['#fffdf6', '#e9dfb6', '#e8d98a'],
      W = k ? 150 : 112,
      H = k ? 88 : 66;
    el('polygon', { points: dia(p.x, p.y + (k ? 16 : 10), W, H), fill: t[1] }, g);
    el(
      'polygon',
      {
        class: 'top',
        points: dia(p.x, p.y, W, H),
        fill: t[0],
        stroke: t[2],
        'stroke-width': k ? 3.5 : 2,
        'stroke-dasharray': k ? '' : '6 5',
      },
      g,
    );
    if (k) {
      el(
        'polygon',
        {
          points: dia(p.x, p.y, W - 34, H - 20),
          fill: 'none',
          stroke: t[2],
          'stroke-width': 1.5,
          'stroke-dasharray': '4 5',
          opacity: 0.7,
        },
        g,
      );
      el(
        'text',
        { x: p.x, y: p.y + 12, 'text-anchor': 'middle', 'font-size': 42, class: 'sp' },
        g,
      ).textContent = k === 'key' ? (i === 3 ? '🗝️' : '🎫') : t[6];
      if (k === 'key') {
        el('text', { x: p.x - 46, y: p.y - 2, 'font-size': 16, class: 'sp' }, g).textContent = '✨';
        el('text', { x: p.x + 34, y: p.y - 12, 'font-size': 16, class: 'sp' }, g).textContent =
          '✨';
      }
      const w = t[5];
      // Attach the plaque to the bottom edge of the tile's top face.
      const labelY = p.y + H / 2;
      el('rect', { x: p.x - w / 2, y: labelY, width: w, height: 36, rx: 13, fill: t[2] }, g);
      el(
        'text',
        {
          x: p.x,
          y: labelY + 14,
          'text-anchor': 'middle',
          'font-size': 13,
          'font-weight': 700,
          fill: '#fff',
        },
        g,
      ).textContent = t[3];
      el(
        'text',
        {
          x: p.x,
          y: labelY + 29,
          'text-anchor': 'middle',
          'font-size': 10.5,
          fill: '#fff',
          opacity: 0.92,
        },
        g,
      ).textContent = t[4];
    } else
      el(
        'g',
        { class: 'cont' },
        g,
        `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" fill="#a89a5c">+ 여행지를 놓아주세요</text>`,
      );
  });
}

export function renderLandmark(ctx, index, place) {
  const pt = pts[index];
  const cont = qs(`.slot[data-i="${index}"] .cont`, ctx.svg);
  render(cont, '');
  if (!place) {
    ctx.el(
      'text',
      { x: pt.x, y: pt.y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#a89a5c' },
      cont,
    ).textContent = '+ 여행지를 놓아주세요';
    return;
  }
  ctx.el(
    'g',
    { class: 'pop' },
    cont,
    `<polygon points="${pt.x},${pt.y - 6} ${pt.x + 22},${pt.y + 4} ${pt.x},${pt.y + 14} ${pt.x - 22},${pt.y + 4}" fill="${place.col}"/><polygon points="${pt.x - 22},${pt.y + 4} ${pt.x},${pt.y + 14} ${pt.x},${pt.y + 26} ${pt.x - 22},${pt.y + 16}" fill="#0002" opacity=".5"/><text x="${pt.x}" y="${pt.y - 4}" text-anchor="middle" font-size="36">${escapeHtml(place.e)}</text><text x="${pt.x}" y="${pt.y + 22}" text-anchor="middle" font-size="11" font-weight="700" fill="#4a4120">${escapeHtml(place.n)}</text><text x="${pt.x}" y="${pt.y + 34}" text-anchor="middle" font-size="9" fill="#8a8160">📍 ${escapeHtml(place.r.replace(/특별.*|광역시|특별자치도/, ''))}</text>`,
  );
}
