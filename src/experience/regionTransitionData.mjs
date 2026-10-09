import { placeAssets, spots } from '../../shared/catalog.mjs';
import { geoToWorld } from '../../shared/geography.mjs';

// Same north-up, equal-scale bounds as GeoMap.tsx; the segment is not a route.
export const REGION_MAP_BOUNDS = Object.freeze({ left: -5200, top: -4500, width: 11500, height: 10000 });
export const REGION_PLACE_IDS = Object.freeze(['zhengyi', 'elephant', 'tianshi', 'shangqing']);

function endpoint(id) {
  if (!REGION_PLACE_IDS.includes(id)) return null;
  const asset = placeAssets[id], spot = spots.find(item => item.id === id);
  if (!spot || !asset?.geo || asset.geo.crs !== 'EPSG:4326') return null;
  let world;
  try { world = geoToWorld(asset.geo.coordinates); } catch { return null; }
  const { left, top } = REGION_MAP_BOUNDS;
  // One SVG unit = 100 m: both axes retain their true relative scale.
  const point = [(world[0] - left) / 100, (world[1] - top) / 100];
  if (point[0] < 0 || point[0] > 115 || point[1] < 0 || point[1] > 100) return null;
  return { id, name: spot.name, zone: spot.zone, coordinates: [...asset.geo.coordinates], world, point };
}

/** Pure metadata. Null, unknown endpoints and within-region trips fail closed. */
export function createRegionTransitionModel(transition = null) {
  if (!transition || typeof transition.id !== 'string' || !transition.id.trim()) return null;
  const from = endpoint(transition.fromId), to = endpoint(transition.toId);
  if (!from || !to || from.id === to.id || from.zone === to.zone) return null;
  const distanceMeters = Math.hypot(to.world[0] - from.world[0], to.world[1] - from.world[1]);
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  return {
    id: transition.id, from, to, distanceMeters,
    distanceLabel: `直线约 ${(distanceMeters / 1000).toFixed(1)} km`,
    relationLabel: `${from.zone}与${to.zone}`,
  };
}

/** Director compares this key before notifying React; this is not a timer. */
export function regionTransitionKey(transition = null) {
  const model = createRegionTransitionModel(transition);
  return model ? JSON.stringify([model.id, model.from.id, model.to.id]) : '';
}
