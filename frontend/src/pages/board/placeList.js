export function getVisiblePlaces(value) {
  const ids = value.source === 'recommended' ? value.recommendationIds : value.carrierIds;
  const places = new Map(value.places.map((p) => [p.id, p]));
  return ids.flatMap((id) => (places.has(id) ? [places.get(id)] : []));
}
