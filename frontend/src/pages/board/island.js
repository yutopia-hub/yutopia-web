import { pts } from './config.js';
import { drawKoreanIcon } from './scenery-icons.js';
export function drawIsland({ svg, el }) {
  /* ground island */
  el(
    'defs',
    {},
    svg,
    '<clipPath id="board-cl"><ellipse cx="500" cy="350" rx="440" ry="240"/></clipPath>',
  );
  el('path', { d: 'M42 372 Q230 540 500 618 Q770 540 958 372Z', fill: '#b9a878' });
  el('path', { d: 'M120 392 Q300 520 500 590 Q700 520 880 392Z', fill: '#a39162', opacity: 0.7 });

  el('ellipse', { cx: 500, cy: 372, rx: 458, ry: 254, fill: '#e3d6a4' });
  el('ellipse', { cx: 500, cy: 350, rx: 458, ry: 254, fill: '#f7ecc4' });
  el('ellipse', { cx: 500, cy: 350, rx: 440, ry: 240, fill: '#fbfae9' });
  const gr = el('g', { 'clip-path': 'url(#board-cl)' });
  for (let c = -760; c < 760; c += 120) {
    el(
      'path',
      {
        d: `M-50 ${350 + c + 0.612 * 550} L1050 ${350 + c - 0.612 * 550}`,
        stroke: '#f0e3a8',
        'stroke-width': 2,
        opacity: 0.7,
      },
      gr,
    );
    el(
      'path',
      {
        d: `M-50 ${350 + c - 0.612 * 550} L1050 ${350 + c + 0.612 * 550}`,
        stroke: '#f0e3a8',
        'stroke-width': 2,
        opacity: 0.7,
      },
      gr,
    );
  }
  [
    [250, 330, 90, 40],
    [760, 340, 90, 40],
    [500, 160, 110, 26],
    [500, 525, 110, 26],
    [330, 225, 60, 24],
    [690, 455, 60, 24],
  ].forEach(([x, y, a, b]) =>
    el('ellipse', { cx: x, cy: y, rx: a, ry: b, fill: '#e0f0cc', opacity: 0.9 }, gr),
  );
  el('ellipse', { cx: 500, cy: 338, rx: 176, ry: 92, fill: '#e3f1cf' });
  el('ellipse', {
    cx: 500,
    cy: 350,
    rx: 440,
    ry: 240,
    fill: 'none',
    stroke: '#f6d84a',
    'stroke-width': 3,
    'stroke-dasharray': '2 10',
    'stroke-linecap': 'round',
  });
  el('ellipse', { cx: 500, cy: 346, rx: 194, ry: 84, fill: '#8cd0e6' });
  el('ellipse', { cx: 500, cy: 338, rx: 190, ry: 80, fill: '#b8e8f4' });
  el('ellipse', {
    cx: 470,
    cy: 330,
    rx: 40,
    ry: 10,
    fill: 'none',
    stroke: '#fff',
    'stroke-width': 2,
    opacity: 0.8,
  });
  /* road */
  const d = 'M' + pts.map((p) => p.x + ' ' + p.y).join(' L') + ' Z';
  el('path', {
    d,
    fill: 'none',
    stroke: '#eadfb8',
    'stroke-width': 34,
    'stroke-linejoin': 'round',
  });
  const road = el('path', {
    d,
    class: 'road',
    fill: 'none',
    stroke: '#fff',
    'stroke-width': 26,
    'stroke-linejoin': 'round',
  });
  el('path', {
    d,
    fill: 'none',
    stroke: '#e0cd7c',
    'stroke-width': 2,
    'stroke-dasharray': '8 8',
    'stroke-linejoin': 'round',
  });
  /* scenery */
  const tree = (x, y, s = 1) =>
    el(
      'g',
      { class: 'decor-tree', transform: `translate(${x},${y}) scale(${s})` },
      svg,
      '<ellipse cx="0" cy="2" rx="8" ry="3" fill="#0001"/><polygon points="0,-26 9,0 -9,0" fill="#9ccf8a"/><polygon points="0,-34 6,-14 -6,-14" fill="#b6e0a4"/><path class="snow-cap" d="M-4 -22 L0 -34 L4 -22" fill="#fff"/>',
    );
  [
    [330, 200],
    [690, 200],
    [300, 470],
    [705, 470],
    [500, 230],
    [440, 180],
    [560, 170],
  ].forEach(([x, y], i) => tree(x, y, 0.8 + (i % 3) * 0.15));
  for (let i = 0; i < 3; i++)
    el(
      'g',
      { class: `cloud cloud-${i}` },
      svg,
      `<ellipse cx="${60 + i * 40}" cy="${70 + i * 50}" rx="46" ry="14" fill="#fff" opacity=".85"/><ellipse cx="${84 + i * 40}" cy="${60 + i * 50}" rx="28" ry="12" fill="#fff" opacity=".85"/>`,
    );
  /* decor */
  let sd = 11;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const RL = road.getTotalLength(),
    rs = [...Array(90)].map((_, i) => road.getPointAtLength((i / 90) * RL));
  const FX = [
    [310, 320],
    [690, 325],
  ];
  const ok = (x, y, r = 46) =>
    !(x > 325 && x < 695 && y > 270 && y < 430) &&
    ((x - 500) / 425) ** 2 + ((y - 350) / 225) ** 2 < 1 &&
    ((x - 500) / 160) ** 2 + ((y - 335) / 88) ** 2 > 1 &&
    rs.every((q) => Math.hypot(q.x - x, q.y - y) > r) &&
    pts.every((q) => Math.hypot(q.x - x, q.y - y) > 92) &&
    FX.every((q) => Math.hypot(q.x - x, q.y - y) > 56);
  const items = [];
  for (let n = 0, g = 0; n < 34 && g < 900; g++) {
    const x = 60 + rnd() * 880,
      y = 70 + rnd() * 500;
    if (ok(x, y)) {
      const sc = 0.75 + rnd() * 0.5;
      items.push({ y, f: () => tree(x, y, sc) });
      n++;
    }
  }
  for (let n = 0, g = 0; n < 20 && g < 900; g++) {
    const x = 60 + rnd() * 880,
      y = 70 + rnd() * 500;
    if (ok(x, y, 52)) {
      const h = 10 + rnd() * 20,
        c = ['#fff', '#fff', '#fff', '#fff4b8', '#dff3fa'][n % 5];
      items.push({
        y,
        f: () =>
          el(
            'g',
            {},
            svg,
            `<ellipse cx="${x}" cy="${y + 10}" rx="18" ry="6" fill="#0001"/><polygon points="${x - 14},${y} ${x},${y + 8} ${x},${y + 8 - h} ${x - 14},${y - h}" fill="#f1ebd6"/><polygon points="${x + 14},${y} ${x},${y + 8} ${x},${y + 8 - h} ${x + 14},${y - h}" fill="#ddd3b0"/><polygon points="${x},${y - 8 - h} ${x + 14},${y - h} ${x},${y + 8 - h} ${x - 14},${y - h}" fill="${c}"/>`,
          ),
      });
      n++;
    }
  }
  items.sort((a, b) => a.y - b.y).forEach((o) => o.f());
  [
    [195, 'hanok'],
    [212, 'jangseung'],
    [338, 'lotus'],
    [350, 'kite'],
    [75, 'hanok'],
    [105, 'jangseung'],
    [258, 'lotus'],
    [282, 'kite'],
  ].forEach(([d, type]) => {
    const a = (d * Math.PI) / 180;
    drawKoreanIcon(el, svg, type, 500 + 449 * Math.cos(a), 358 + 247 * Math.sin(a));
  });
  el(
    'text',
    { 'font-size': 22, 'text-anchor': 'middle' },
    svg,
    '<animateMotion dur="16s" repeatCount="indefinite" path="M440 335 Q500 305 560 335 Q500 365 440 335Z"/>⛵',
  );
  el(
    'text',
    { 'font-size': 18, 'text-anchor': 'middle' },
    svg,
    '<animateMotion dur="22s" begin="-9s" repeatCount="indefinite" path="M560 345 Q500 372 440 345 Q500 318 560 345Z"/>⛵',
  );

  return road;
}
