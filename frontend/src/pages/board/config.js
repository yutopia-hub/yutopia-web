export const N = 12,
  FIX = { 0: 'start', 3: 'key', 6: 'plane', 9: 'key' };
export const pts = [...Array(N)].map((_, i) => {
  const t = (i / N) * Math.PI * 2 + Math.PI * 0.5;
  return {
    x: 500 + 370 * Math.cos(t) + 30 * Math.sin(2 * t),
    y: 330 + 175 * Math.sin(t) + 34 * Math.sin(3 * t),
  };
});

export const slots = pts.map((_, i) => i).filter((i) => !FIX[i]);
export const EV = [
  { e: '🎫', t: '여행 쿠폰', d: '다음 관광지로 바로 이동합니다.', a: 'next' },
  { e: '✈️', t: 'Lucky Flight', d: '비행기 칸으로 이동합니다.', a: 'plane' },
  { e: '🎒', t: '잠깐 휴식', d: '한 턴 쉬어갑니다.', a: 'rest' },
];
