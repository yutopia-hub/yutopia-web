/** Preserve retained locations; distribute new entries only over ordinary travel slots. */
export function createRecommendedCells(recommendations, filled, slots) {
  const ids = recommendations.map((p) => String(p.id));
  if (ids.length !== slots.length || new Set(ids).size !== ids.length) return null;
  const cells = [];
  const used = new Set();
  for (const index of slots) {
    const id = String(filled[index] ?? '');
    if (ids.includes(id) && !used.has(id)) {
      cells.push({ index, placeId: id });
      used.add(id);
    }
  }
  const empty = slots.filter((i) => !cells.some((c) => c.index === i));
  for (const id of ids.filter((id) => !used.has(id)))
    cells.push({ index: empty.shift(), placeId: id });
  return cells.sort((a, b) => a.index - b.index);
}
