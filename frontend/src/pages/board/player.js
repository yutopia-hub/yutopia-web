export function drawPlayer({ svg, el }) {
  el(
    'text',
    { 'font-size': 26, 'text-anchor': 'middle', opacity: 0.9 },
    svg,
    '<animateMotion dur="18s" repeatCount="indefinite" path="M130 90 Q500 10 870 90 Q500 190 130 90Z"/>✈️',
  );
  const tokG = el('g', {});
  const tok = el(
    'g',
    {},
    tokG,
    '<ellipse cx="0" cy="4" rx="13" ry="4.5" fill="#0003"/><path d="M13 -18 V-46" stroke="#b07f00" stroke-width="2.2" stroke-linecap="round"/><path d="M13 -46 L29 -40 L13 -34Z" fill="#e8553a" stroke="#a83a24" stroke-width="1"/><rect x="-16" y="-27" width="10" height="17" rx="4" fill="#e8a600" stroke="#a87f00" stroke-width="1.2"/><rect x="-7" y="-4" width="5.5" height="7" rx="2.5" fill="#2b6b80"/><rect x="1.5" y="-4" width="5.5" height="7" rx="2.5" fill="#2b6b80"/><rect x="-10" y="-27" width="20" height="25" rx="9" fill="#5fb7d4" stroke="#2b6b80" stroke-width="1.5"/><circle cx="0" cy="-35" r="9.5" fill="#ffe0bd" stroke="#c99a6a" stroke-width="1"/><path d="M-10 -37 Q0 -52 10 -37Z" fill="#f6d84a" stroke="#b07f00" stroke-width="1.5"/><rect x="-14" y="-38" width="28" height="4.5" rx="2.2" fill="#f0c030" stroke="#b07f00" stroke-width="1.2"/><circle cx="-3.5" cy="-32" r="1.4" fill="#333"/><circle cx="3.5" cy="-32" r="1.4" fill="#333"/><path d="M-3 -29 Q0 -26 3 -29" stroke="#b55" fill="none" stroke-width="1.2" stroke-linecap="round"/>',
  );

  const ring = el('ellipse', {
    rx: 34,
    ry: 19,
    fill: 'none',
    stroke: '#f6d84a',
    'stroke-width': 4,
    opacity: 0.9,
  });
  svg.appendChild(tokG);
  return { tokG, tok, ring };
}

export async function step(ctx, state, player, index) {
  ctx.check();
  player.tokG.style.transition = 'transform .3s';
  state.move(index);
  const hop = ctx.animate(
    player.tok,
    [
      { transform: 'translateY(0)' },
      { transform: 'translateY(-16px)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 300 },
  );
  await ctx.wait(340);
  ctx.cancel(hop);
}
