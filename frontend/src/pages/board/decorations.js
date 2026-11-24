export function drawDecorations({ el }) {
  const garden = el('g', {
    class: 'board-decorations',
    'aria-hidden': 'true',
    'pointer-events': 'none',
  });
  el(
    'ellipse',
    { cx: 500, cy: 345, rx: 172, ry: 75, fill: '#e4f0ce', stroke: '#c3d7ad', 'stroke-width': 2 },
    garden,
  );
  el(
    'path',
    { d: 'M426 330 Q500 355 586 332', stroke: '#f6e5b9', 'stroke-width': 14, fill: 'none' },
    garden,
  );
  const palace = el(
    'g',
    { class: 'decor-object decor-palace', transform: 'translate(390 326)' },
    garden,
  );
  el(
    'g',
    {},
    palace,
    '<ellipse cy="20" rx="46" ry="10" fill="#0001"/><rect x="-34" y="-6" width="68" height="24" fill="#b67b50"/><g fill="#f6e2b8"><rect x="-27" y="-2" width="13" height="19"/><rect x="-6" y="-2" width="12" height="19"/><rect x="14" y="-2" width="13" height="19"/></g><path class="decor-roof" d="M-45 -8 Q-30 -10 -24 -21 H24 Q30 -10 45 -8 L39 -3 H-39Z" fill="#426964"/><path d="M-23 -22 Q0 -33 23 -22" fill="#426964"/><path class="snow-cap" d="M-43 -9 Q-30 -12 -24 -22 H24 Q30 -12 43 -9" fill="none" stroke="#fff" stroke-width="4"/>',
  );
  const tower = el(
    'g',
    { class: 'decor-object decor-tower', transform: 'translate(635 357)' },
    garden,
  );
  el(
    'g',
    {},
    tower,
    '<ellipse cy="19" rx="25" ry="7" fill="#0001"/><path d="M-9 18 L-5 -39 H5 L9 18Z" fill="#e8e6d5" stroke="#b3b4a7"/><rect x="-16" y="-47" width="32" height="9" rx="4" fill="#aebdcc"/><rect class="decor-light" x="-14" y="-46" width="28" height="4" rx="2" fill="#bee8e8"/><path d="M0 -47 V-62" stroke="#aebdcc" stroke-width="3"/><path class="snow-cap" d="M-16 -48 H16" stroke="#fff" stroke-width="3"/>',
  );
  const wheel = el(
    'g',
    { class: 'decor-object decor-waterwheel', transform: 'translate(350 393)' },
    garden,
  );
  el(
    'g',
    {},
    wheel,
    '<ellipse cy="16" rx="27" ry="7" fill="#0001"/><path d="M-20 14 L-12 -13 H12 L20 14" fill="#c69861"/><path d="M-31 20 Q0 30 31 20" stroke="#76b9d1" stroke-width="6" fill="none"/>',
  );
  const rotor = el('g', { class: 'decor-rotor' }, wheel);
  el('circle', { r: 16, fill: 'none', stroke: '#a57543', 'stroke-width': 4 }, rotor);
  for (let i = 0; i < 8; i++)
    el(
      'path',
      {
        d: 'M0 0 V-16 M-4 -16 H4',
        stroke: '#ad7c49',
        'stroke-width': 3,
        transform: `rotate(${i * 45})`,
      },
      rotor,
    );
  el('circle', { r: 4, fill: '#795435' }, rotor);
  const sign = el(
    'g',
    { class: 'decor-object decor-sign', transform: 'translate(510 380)' },
    garden,
  );
  el(
    'g',
    {},
    sign,
    '<path d="M-40 8 V22 M40 8 V22" stroke="#8e643d" stroke-width="4"/><rect x="-68" y="-18" width="136" height="36" rx="9" fill="#7f5b3c" stroke="#cda975" stroke-width="2"/>',
  );
  el(
    'text',
    {
      y: 9,
      'text-anchor': 'middle',
      'font-size': 28,
      'font-family': 'Jua, sans-serif',
      fill: '#fff0c5',
    },
    sign,
  ).textContent = '윷토피아';
}
