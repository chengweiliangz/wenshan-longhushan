import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, fbm, lerp, noise3, riverHalf, riverX, rng, smoothstep } from './math';

/** Height of the ground (water surface is y = 0). */
export function groundHeight(x: number, z: number) {
  const d = Math.abs(x - riverX(z)) - riverHalf(z);
  if (d < 0) return Math.max(-0.25 + d * 0.28, -2.4);
  const valley = lerp(1, 0.55, smoothstep(-120, -200, z));
  const hills = (smoothstep(5, 48, d) * 13 + fbm(x * 0.026, z * 0.026, 1.3) * 8 * smoothstep(4, 30, d)) * valley;
  return -0.25 + smoothstep(0, 5, d) * 1.5 + d * 0.025 + hills + fbm(x * 0.14, z * 0.14, 7, 2) * 0.45 * smoothstep(1, 6, d);
}

const C = (hex: string) => new THREE.Color(hex);
const PAL = {
  sand: C('#8b8066'), grass: C('#55703f'), moss: C('#6d8448'), forest: C('#26392b'), deep: C('#1d2f25'),
  ochre: C('#a4523a'), ochreLight: C('#c0714d'), stain: C('#4a3a31'), rockGrey: C('#7c7466'),
};

function paint(geometry: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    fn(p, n, c); c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createTerrain(segX: number, segZ: number) {
  const geometry = new THREE.PlaneGeometry(320, 420, segX, segZ);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -140);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();
  const tmp = new THREE.Color();
  return paint(geometry, (p, n, out) => {
    const d = Math.abs(p.x - riverX(p.z)) - riverHalf(p.z);
    const v = fbm(p.x * 0.05, p.z * 0.05, 4, 3) * 0.5 + 0.5;
    out.copy(PAL.grass).lerp(PAL.moss, v);
    out.lerp(PAL.forest, smoothstep(6, 26, d) * 0.85);
    out.lerp(PAL.deep, smoothstep(0.92, 0.7, n.y) * 0.6);
    out.lerp(tmp.copy(PAL.ochre).multiplyScalar(0.8), smoothstep(0.82, 0.62, n.y) * 0.45 * (noise3(p.x * 0.08, p.z * 0.08) * 0.5 + 0.5));
    out.lerp(PAL.sand, smoothstep(1.6, 0.2, d) * 0.85);
    if (d < 0) out.copy(PAL.sand).multiplyScalar(0.55);
  });
}

type RockSpec = { x: number; z: number; rx: number; rz: number; h: number; seed: number; arch?: number };
export const ROCKS: RockSpec[] = [
  { x: riverX(-95) + 36, z: -98, rx: 17, rz: 12, h: 36, seed: 1 },
  { x: riverX(-40) + 20, z: -40, rx: 8, rz: 6, h: 15, seed: 2 },
  { x: riverX(-64) + 31, z: -64, rx: 10, rz: 8.5, h: 21, seed: 3, arch: 1 },
  { x: riverX(-120) - 40, z: -122, rx: 19, rz: 14, h: 29, seed: 4 },
  { x: riverX(-150) + 23, z: -150, rx: 5.5, rz: 4.5, h: 24, seed: 5 },
  { x: riverX(-160) + 32, z: -162, rx: 4.5, rz: 4, h: 18, seed: 6 },
  { x: riverX(-205) + 4, z: -215, rx: 24, rz: 16, h: 50, seed: 7 },
  { x: -58, z: -245, rx: 21, rz: 15, h: 40, seed: 8 },
  { x: 66, z: -232, rx: 25, rz: 18, h: 55, seed: 9 },
  { x: riverX(-30) - 34, z: -26, rx: 9, rz: 7, h: 13, seed: 10 },
  { x: riverX(-175) - 30, z: -178, rx: 7, rz: 6, h: 26, seed: 11 },
];

// Profile of a 丹霞 mesa: vertical red cliffs, rounded shoulder, vegetated cap.
const PROFILE: [number, number][] = [[1.14, -0.12], [1.06, 0], [1.02, 0.1], [1.0, 0.22], [0.99, 0.36], [0.98, 0.5], [0.97, 0.62], [0.95, 0.73], [0.91, 0.82], [0.84, 0.89], [0.72, 0.95], [0.55, 0.99], [0.34, 1.02], [0.14, 1.035], [0, 1.04]];

function danxiaRock(spec: RockSpec, tops: THREE.Vector3[], detail: number) {
  const r = rng(spec.seed * 97);
  const points = new THREE.SplineCurve(PROFILE.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(Math.round(44 * detail));
  let geometry: THREE.BufferGeometry = new THREE.LatheGeometry(points, Math.round(54 * detail));
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  geometry = mergeVertices(geometry, 1e-4);
  const pos = geometry.getAttribute('position');
  const seed = spec.seed * 13.7;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const a = Math.atan2(p.z, p.x), radial = Math.hypot(p.x, p.z);
    const ca = Math.cos(a), sa = Math.sin(a);
    const plan = 1 + 0.22 * fbm(ca * 1.3 + seed, sa * 1.3, p.y * 0.8, 3) + 0.035 * Math.sin(a * 17 + fbm(ca, sa, seed) * 6) * smoothstep(1.0, 0.4, p.y);
    const lump = p.y > 0.86 ? fbm(ca * 2 + seed, sa * 2, 4, 3) * 0.07 * smoothstep(0.86, 1.0, p.y) : 0;
    const ledge = 1 - 0.025 * smoothstep(0.55, 1, Math.sin(p.y * spec.h * 0.55 + fbm(ca * 3, sa * 3, seed, 2) * 2.5)) * smoothstep(0.92, 0.2, p.y);
    const scale = radial * plan * ledge;
    pos.setXYZ(i, ca * scale * spec.rx, (p.y + lump) * spec.h, sa * scale * spec.rz);
  }
  geometry.computeVertexNormals();
  const tmp = new THREE.Color();
  paint(geometry, (q, n, out) => {
    const yn = q.y / spec.h;
    const a = Math.atan2(q.z, q.x);
    const band = Math.sin(q.y * 1.15 + fbm(a * 2, q.y * 0.1, seed) * 3) * 0.5 + 0.5;
    out.copy(PAL.ochre).lerp(PAL.ochreLight, band * 0.45 + noise3(a * 6, q.y * 0.3, seed) * 0.15);
    const streak = smoothstep(0.25, 0.7, noise3(a * 26 + seed, q.y * 0.06, 1));
    out.lerp(PAL.stain, streak * 0.55 * smoothstep(0.95, 0.3, yn));
    out.lerp(tmp.copy(PAL.rockGrey), smoothstep(0.25, 0, yn) * 0.35);
    const ledge = smoothstep(0.55, 0.85, n.y) * smoothstep(0.2, 0.6, noise3(q.x * 0.3, q.y * 0.3, q.z * 0.3) * 0.5 + 0.5);
    const cap = smoothstep(0.8, 0.9, yn) * smoothstep(0.35, 0.7, n.y);
    out.lerp(tmp.copy(PAL.forest).lerp(PAL.moss, noise3(q.x * 0.2, q.z * 0.2, seed) * 0.5 + 0.5), clamp(cap + ledge * 0.8));
    out.lerp(PAL.deep, smoothstep(0.12, 0, yn) * 0.5);
  });
  // Remember a few vegetated top points for canopy blobs.
  const nor = geometry.getAttribute('normal');
  const y0 = groundHeight(spec.x, spec.z) - 1.5;
  for (let i = 0; i < pos.count; i += 3) if (nor.getY(i) > 0.75 && pos.getY(i) > spec.h * 0.86 && r() < 0.35) tops.push(new THREE.Vector3(pos.getX(i) + spec.x, pos.getY(i) + y0, pos.getZ(i) + spec.z));
  geometry.translate(spec.x, y0, spec.z);
  return geometry;
}

/** The 象鼻山 trunk: a natural stone arch leaning from the cliff into the riverbank. */
function elephantArch(spec: RockSpec) {
  const y0 = groundHeight(spec.x, spec.z) - 1.5;
  const toRiver = Math.sign(riverX(spec.z) - spec.x);
  const base = new THREE.Vector3(spec.x + toRiver * spec.rx * 0.82, y0 + spec.h * 0.66, spec.z + 2);
  const foot = new THREE.Vector3(spec.x + toRiver * (spec.rx + 6), groundHeight(spec.x + toRiver * (spec.rx + 6), spec.z + 4) - 0.6, spec.z + 4);
  const curve = new THREE.CatmullRomCurve3([
    base,
    new THREE.Vector3(lerp(base.x, foot.x, 0.45), base.y + 1.6, base.z + 1.2),
    new THREE.Vector3(lerp(base.x, foot.x, 0.85), lerp(base.y, foot.y, 0.45), foot.z - 0.6),
    foot,
  ]);
  const geometry = new THREE.TubeGeometry(curve, 48, 1, 14, false);
  const pos = geometry.getAttribute('position');
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / 15) / 48;
    curve.getPointAt(t, c);
    p.fromBufferAttribute(pos, i).sub(c);
    const radius = lerp(2.9, 1.3, t) * (1 + fbm(p.x * 0.7 + 3, p.y * 0.7, p.z * 0.7, 3) * 0.4);
    p.multiplyScalar(radius).add(c);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  return paint(geometry, (q, n, out) => {
    const band = Math.sin(q.y * 1.4 + noise3(q.x * 0.3, q.z * 0.3, 2) * 2) * 0.5 + 0.5;
    out.copy(PAL.ochre).lerp(PAL.ochreLight, band * 0.4 + noise3(q.x * 0.4, q.y * 0.4, q.z * 0.4) * 0.2);
    out.lerp(PAL.stain, smoothstep(0.3, 0.7, noise3(q.x * 1.5, q.y * 0.2, q.z * 1.5)) * 0.35);
    out.lerp(PAL.forest, smoothstep(0.55, 0.9, n.y) * 0.75);
    out.lerp(PAL.stain, smoothstep(-0.2, -0.8, n.y) * 0.4);
  });
}

export function createRocks(detail: number) {
  const tops: THREE.Vector3[] = [];
  const parts = ROCKS.map(spec => danxiaRock(spec, tops, detail));
  ROCKS.filter(s => s.arch).forEach(s => parts.push(elephantArch(s)));
  return { geometry: mergeGeometries(parts), tops };
}

export function rockAnchor(index: number, height = 1) {
  const s = ROCKS[index];
  return new THREE.Vector3(s.x, groundHeight(s.x, s.z) - 1.5 + s.h * height, s.z);
}

/** Broadleaf canopy as instanced lumps: gives hills and mesa tops their forested volume. */
export function createForest(count: number, extraTops: THREE.Vector3[], material: THREE.Material) {
  let blob: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 2);
  blob.deleteAttribute('uv'); blob.deleteAttribute('normal');
  blob = mergeVertices(blob);
  const bp = blob.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const k = 1 + noise3(x * 2.2, y * 2.2, z * 2.2) * 0.22;
    bp.setXYZ(i, x * k, Math.max(y * k, -0.35), z * k);
  }
  blob.computeVertexNormals();
  paint(blob, (p, _n, out) => out.setScalar(lerp(0.55, 1.0, smoothstep(-0.4, 0.9, p.y))));
  const r = rng(42);
  const mesh = new THREE.InstancedMesh(blob, material, count + extraTops.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color(), dark = C('#1f3326'), light = C('#4c6a3b'), olive = C('#5f6d36');
  let n = 0;
  for (let tries = 0; n < count && tries < count * 8; tries++) {
    const x = (r() - 0.5) * 300, z = 60 - r() * 400;
    const d = Math.abs(x - riverX(z)) - riverHalf(z);
    if (d < 2.5 + r() * 4) continue;
    if (ROCKS.some(k => ((x - k.x) / (k.rx * 1.15)) ** 2 + ((z - k.z) / (k.rz * 1.15)) ** 2 < 1)) continue;
    if (z > 18 && d < 14) continue; // keep the foreground lens clear for the hand-placed bamboo
    const size = lerp(1.3, 3.4, r()) * lerp(0.85, 1.4, smoothstep(0, -250, z));
    t.set(x, groundHeight(x, z) + size * 0.55, z);
    s.set(size * lerp(0.9, 1.3, r()), size * lerp(0.9, 1.5, r()), size * lerp(0.9, 1.3, r()));
    q.setFromEuler(e.set(0, r() * Math.PI * 2, 0));
    mesh.setMatrixAt(n, m.compose(t, q, s));
    mesh.setColorAt(n, col.copy(dark).lerp(r() > 0.75 ? olive : light, r() * 0.9));
    n++;
  }
  for (const top of extraTops) {
    const size = lerp(1.6, 3.2, r());
    t.copy(top).y += size * 0.3;
    s.set(size, size * 0.8, size);
    q.setFromEuler(e.set(0, r() * 6, 0));
    mesh.setMatrixAt(n, m.compose(t, q, s));
    mesh.setColorAt(n, col.copy(dark).lerp(light, r() * 0.7));
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function boulderGeometry(seed: number, detail = 2) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + fbm(x * 1.3 + seed, y * 1.3, z * 1.3, 3) * 0.42;
    pos.setXYZ(i, x * k * 1.25, y * k * (y < 0 ? 0.5 : 0.78), z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function paintBoulder(g: THREE.BufferGeometry, mossy = 0.7) {
  const stone = C('#7f7464'), ochre = C('#93583f');
  return paint(g, (p, n, out) => {
    out.copy(stone).lerp(ochre, noise3(p.x * 2, p.y * 2, p.z * 2) * 0.3 + 0.3);
    out.lerp(PAL.moss, smoothstep(0.25, 0.75, n.y) * mossy * (0.7 + noise3(p.x * 4, p.z * 4, 2) * 0.3));
    out.multiplyScalar(lerp(0.55, 1, smoothstep(-0.6, 0.4, p.y)));
  });
}

export function createBankRocks(count: number) {
  const r = rng(7);
  const variants = Array.from({ length: 6 }, (_, i) => paintBoulder(boulderGeometry(i * 3.1), 0.6));
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const z = 50 - r() * 260, side = r() > 0.5 ? 1 : -1;
    const x = riverX(z) + side * (riverHalf(z) + lerp(-0.6, 1.8, r()));
    const s = lerp(0.45, 1.7, r() ** 2);
    const g = variants[i % variants.length].clone();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, Math.max(groundHeight(x, z), -0.4) + s * 0.18, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s, s)));
    parts.push(g);
  }
  return mergeGeometries(parts);
}
