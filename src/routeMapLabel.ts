export type RouteMapLabel = { x: number; y: number; anchor: 'start' | 'end' };
// Only annotation placement changes; path/circles/live marker keep their exact coordinates.
const leftLabels: Readonly<Record<string, readonly string[]>> = {
 'tianshi-court-route': ['enclosure-approach', 'stair-front'],
 'shangqing-entry-route': ['east-approach', 'east-platform', 'east-return'],
};
export function routeMapLabel(routeId: string, nodeId: string, position: readonly number[], fontSize: number, bounds: readonly number[]): RouteMapLabel {
 const left = leftLabels[routeId]?.includes(nodeId) ?? false;
 const scale = 11 / fontSize;
 const shiftX = routeId === 'shangqing-entry-route' && nodeId === 'east-platform' ? -2 / scale : 0;
 const shiftY = routeId === 'shangqing-entry-route' && nodeId === 'east-return' ? -3 / scale
   : routeId === 'tianshi-court-route' && nodeId === 'stair-front' ? -2 / scale : 0;
 const y = Math.max(bounds[1] + 12.5 / scale, Math.min(bounds[1] + bounds[3] - 3.5 / scale, position[2] + fontSize * .35 + shiftY));
 return { x: position[0] + (left ? -2.1 : 2.1) + shiftX, y, anchor: left ? 'end' : 'start' };
}
