// Small decorative SVG icons, independent of travel destination cards and slots.
const ICONS = {
  hanok:
    '<ellipse cy="2" rx="19" ry="4" fill="#0001"/><rect x="-14" y="-12" width="28" height="14" fill="#c48c58"/><path d="M-20 -13 Q-14 -14 -10 -23 H10 Q14 -14 20 -13 L17 -10 H-17Z" fill="#416863"/><rect x="-5" y="-9" width="10" height="11" fill="#f5deaf"/><path d="M0 -9 V2 M-5 -3 H5" stroke="#8b6947"/><path class="snow-cap" d="M-19 -14 Q-14 -15 -10 -23 H10 Q14 -15 19 -14" stroke="#fff" stroke-width="3" fill="none"/>',
  jangseung:
    '<ellipse cy="3" rx="12" ry="3" fill="#0001"/><path d="M-8 2 L-7 -29 Q0 -35 7 -29 L8 2Z" fill="#bd8553" stroke="#8b603b"/><path d="M-5 -22 L-1 -20 M1 -20 L5 -22" stroke="#3e392e" stroke-width="2"/><path d="M0 -19 V-13 H3 M-5 -8 Q0 -5 5 -8" fill="none" stroke="#5f4230" stroke-width="1.6"/><path d="M-3 -4 V1 M3 -2 V2" stroke="#dab181"/>',
  kite: '<path d="M0 -4 Q12 3 5 9 Q-3 14 8 20" fill="none" stroke="#d3ad58" stroke-width="1.3"/><path d="M0 -33 L14 -18 L0 -3 L-14 -18Z" fill="#f6e6b5" stroke="#a67745"/><path d="M0 -33 V-3 M-14 -18 H14" stroke="#a67745"/><path d="M0 -33 L14 -18 H0Z" fill="#df7459"/><path d="M0 -3 L-14 -18 H0Z" fill="#609bb3"/><circle cy="-18" r="3" fill="#f5d372"/>',
  lotus:
    '<ellipse cy="2" rx="17" ry="5" fill="#95bb83"/><path d="M0 0 Q-17 -5 -12 -16 Q-1 -15 0 0" fill="#efacb5"/><path d="M0 0 Q17 -5 12 -16 Q1 -15 0 0" fill="#efacb5"/><path d="M0 0 Q-10 -12 0 -23 Q10 -12 0 0" fill="#f8c7cb"/><ellipse cy="-2" rx="5" ry="3" fill="#f0d478"/>',
};

export function drawKoreanIcon(el, parent, type, x, y) {
  el(
    'g',
    {
      class: `korean-scenery korean-${type}`,
      transform: `translate(${x} ${y}) scale(.8)`,
      'aria-hidden': 'true',
      'pointer-events': 'none',
    },
    parent,
    ICONS[type],
  );
}
