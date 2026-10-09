/** Camera-only heading on the unchanged sourced river polyline.
 * Distance is the existing waterDomain metre chainage, not scene XZ units.
 * Stateless sampling preserves pause, reduced motion and backwards seek behavior.
 */
export type RiverFollowPoint = { readonly x: number; readonly z: number };
export type RiverFollowDirection = { x: number; z: number };
export type RiverFollowTurn = { readonly at: number; readonly start: number; readonly end: number; readonly before: number; readonly delta: number };
const shortestTurn = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export function createRiverFollowDirection(points: readonly RiverFollowPoint[], distances: readonly number[], halfWindowMeters = 6) {
  if (points.length < 2 || points.length !== distances.length || !(halfWindowMeters > 0) || !Number.isFinite(halfWindowMeters)) throw new Error('Invalid river follow path');
  const headings: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (!Number.isFinite(points[i].x) || !Number.isFinite(points[i].z) || !Number.isFinite(distances[i]) || (i > 0 && distances[i] <= distances[i - 1])) throw new Error('Invalid river follow chainage');
    if (i > 0) {
      const dx = points[i].x - points[i - 1].x, dz = points[i].z - points[i - 1].z;
      if (Math.hypot(dx, dz) <= 1e-12) throw new Error('Empty river follow segment');
      headings.push(Math.atan2(dx, dz));
    }
  }
  const bends: { at: number; before: number; delta: number }[] = [];
  let held = headings[0];
  for (let i = 1; i < headings.length; i++) {
    const delta = shortestTurn(headings[i] - held);
    // Omit numerical angle noise from collinear subdivisions, without moving points.
    if (Math.abs(delta) <= 1e-7) continue;
    bends.push({ at: distances[i], before: held, delta });
    held += delta;
  }
  const turns: readonly RiverFollowTurn[] = bends.map((bend, i) => {
    const previous = i ? bends[i - 1].at : distances[0], next = i + 1 < bends.length ? bends[i + 1].at : distances.at(-1)!;
    const half = Math.min(halfWindowMeters, (bend.at - previous) * .45, (next - bend.at) * .45);
    const start = bend.at - half, end = bend.at + half;
    if (!Number.isFinite(start) || !Number.isFinite(end) || !(start < end)) throw new Error('Unrepresentable river follow window');
    return { ...bend, start, end };
  });
  function sample(distance: number, out: RiverFollowDirection): RiverFollowDirection {
    if (!Number.isFinite(distance)) throw new Error('Invalid river follow distance');
    let heading = headings[0];
    for (const turn of turns) {
      if (distance < turn.start) break;
      if (distance <= turn.end) {
        const u = (distance - turn.start) / (turn.end - turn.start), eased = u * u * (3 - 2 * u);
        heading = turn.before + turn.delta * eased;
        break;
      }
      heading = turn.before + turn.delta;
    }
    out.x = Math.sin(heading); out.z = Math.cos(heading);
    return out;
  }
  return { sample, turns };
}
