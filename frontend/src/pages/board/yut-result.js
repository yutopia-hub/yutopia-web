const RESULTS = [
  { name: '모', steps: 5 },
  { name: '도', steps: 1 },
  { name: '개', steps: 2 },
  { name: '걸', steps: 3 },
  { name: '윷', steps: 4 },
];

export function rollYut(random = Math.random) {
  const flatFaces = Array.from({ length: 4 }, () => random() < 0.5);
  const flatCount = flatFaces.filter(Boolean).length;
  return { ...RESULTS[flatCount], flatFaces, flatCount };
}
