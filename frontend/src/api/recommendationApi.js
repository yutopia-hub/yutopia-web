import { getTourAreas, listTourPlaces, IS_TOUR_MOCK } from './tourApi.js';
import { createRecommendationCatalogLoader } from './recommendationCatalogApi.js';

const loadCatalog = createRecommendationCatalogLoader({
  getAreas: getTourAreas,
  listPlaces: listTourPlaces,
});

export async function getRecommendationCatalog(options) {
  return { ...(await loadCatalog(options)), isMock: IS_TOUR_MOCK };
}
