export type RegionPlaceId = 'zhengyi' | 'elephant' | 'tianshi' | 'shangqing';
export type SceneRegionTransitionMeta = { id: string; fromId: RegionPlaceId; toId: RegionPlaceId };
export type RegionEndpoint = {
  id: RegionPlaceId; name: string; zone: string;
  coordinates: [number, number]; world: [number, number]; point: [number, number];
};
export type RegionTransitionModel = {
  id: string; from: RegionEndpoint; to: RegionEndpoint;
  distanceMeters: number; distanceLabel: string; relationLabel: string;
};
export const REGION_MAP_BOUNDS: Readonly<{ left: number; top: number; width: number; height: number }>;
export const REGION_PLACE_IDS: readonly RegionPlaceId[];
export function createRegionTransitionModel(transition?: SceneRegionTransitionMeta | null): RegionTransitionModel | null;
export function regionTransitionKey(transition?: SceneRegionTransitionMeta | null): string;
