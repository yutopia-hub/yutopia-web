export function drawStars({ $, el }) {
  let seed = 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 36; i++) {
    const star = el(
      'circle',
      {
        cx: random() * 1440,
        cy: random() * 900,
        r: 0.5 + random() * 1.6,
        fill: i % 7 ? '#fff' : '#ffe9a0',
        class: 'tw',
      },
      $('stars'),
    );
    star.style.animationDelay = -random() * 4 + 's';
    star.style.animationDuration = 2 + random() * 3 + 's';
  }
}
