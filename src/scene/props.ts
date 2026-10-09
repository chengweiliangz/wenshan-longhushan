import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, lerp } from './math';
import type { Shared } from './atmosphere';
import { groundHeight } from './landscape';

function tinted(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, stripe?: (y: number) => number) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = stripe ? stripe(pos.getY(i)) : 1;
    arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));

/** A 竹筏 with a boatman in a straw hat. Local +Z points downstream. */
export function createRaft(material: THREE.Material) {
  const parts: THREE.BufferGeometry[] = [];
  const nodes = (y: number) => (Math.abs(((y + 3.5) % 1.1) - 0.55) < 0.05 ? 0.62 : 1);
  for (let i = 0; i < 9; i++) {
    const g = tinted(new THREE.CylinderGeometry(0.12, 0.12, 7.2 - Math.abs(i - 4) * 0.12, 8, 12), i % 2 ? '#b59d63' : '#a68d55', nodes);
    parts.push(place(g, (i - 4) * 0.245, 0.12, 0, Math.PI / 2));
  }
  // Bamboo poles curve up at the bow like the real rafts on 泸溪河.
  parts.forEach(p => { const pos = p.getAttribute('position'); for (let v = 0; v < pos.count; v++) { const z = pos.getZ(v); pos.setY(v, pos.getY(v) + (z > 2.4 ? (z - 2.4) ** 2 * 0.26 : 0)); } });
  for (const z of [-2.6, -0.6, 1.4]) parts.push(place(tinted(new THREE.BoxGeometry(2.4, 0.08, 0.16), '#7d6a42'), 0, 0.27, z));
  // Two low bamboo seats.
  for (const z of [-0.6, 1.1]) { parts.push(place(tinted(new THREE.BoxGeometry(1.5, 0.08, 0.5), '#c2aa70'), 0, 0.62, z)); for (const x of [-0.65, 0.65]) parts.push(place(tinted(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 5), '#8a7346'), x, 0.43, z)); }
  // Boatman at the stern.
  parts.push(place(tinted(new THREE.CylinderGeometry(0.2, 0.3, 1.0, 10), '#2f3f47'), 0, 0.85, -3.0));
  parts.push(place(tinted(new THREE.CylinderGeometry(0.24, 0.2, 0.75, 10), '#4d5b52'), 0, 1.7, -3.0));
  parts.push(place(tinted(new THREE.SphereGeometry(0.17, 12, 10), '#b98d6b'), 0, 2.22, -3.0));
  parts.push(place(tinted(new THREE.ConeGeometry(0.58, 0.32, 18, 1, true), '#d1b878'), 0, 2.43, -3.0));
  parts.push(place(tinted(new THREE.CylinderGeometry(0.035, 0.035, 6.6, 5), '#9c8551'), 0.45, 1.9, -2.2, 0.55, 0, -0.2));
  const geometry = mergeGeometries(parts.map(p => { if (!p.getAttribute('normal')) p.computeVertexNormals(); return p; }));
  const raft = new THREE.Mesh(geometry, material);
  raft.castShadow = false;
  return raft;
}

/** Expanding rings + soft wake under the raft. */
export function createRipples(shared: Shared) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 22), new THREE.ShaderMaterial({
    uniforms: { ...shared },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uHorizon, uSunColor;
      varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        vec2 p = (vUv - vec2(0.5, 0.56)) * vec2(16.0, 22.0);
        vec2 q = p / vec2(1.7, 4.6);
        float r = length(q);
        float rings = sin(r * 7.0 - uTime * 1.6) * 0.5 + 0.5;
        float a = pow(rings, 6.0) * smoothstep(3.2, 1.0, r) * smoothstep(0.85, 1.05, r) * 0.35;
        float wake = smoothstep(0.42, 0.0, abs(p.x) / (1.2 + max(-p.y, 0.0) * 0.18)) * smoothstep(0.0, -2.0, p.y) * smoothstep(-10.0, -3.0, p.y);
        a += wake * vnoise(vec2(p.x * 3.0, p.y * 1.2 + uTime * 2.0)) * 0.22;
        gl_FragColor = vec4(mix(uHorizon, vec3(1.0), 0.5) + uSunColor * 0.1, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

/** Concave Chinese hip roof with lifted corners (飞檐), built from a grid so the curve stays smooth. */
function roof(w: number, d: number, h: number, curl: number, color: string) {
  const seg = 16;
  const g = new THREE.PlaneGeometry(2, 2, seg, seg);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), v = pos.getY(i);
    const m = Math.max(Math.abs(u), Math.abs(v) * 1.0);
    const y = h * Math.pow(1 - m, 1.7) + curl * Math.pow(Math.abs(u * v), 3.5);
    pos.setXYZ(i, u * w / 2 * (1 + 0.04 * Math.abs(v)), y, -v * d / 2);
  }
  g.computeVertexNormals();
  return tinted(g, color);
}

export function createTemple() {
  const parts: THREE.BufferGeometry[] = [];
  const wall = '#e6dfcf', red = '#8d3a2b', stone = '#8f897a', tile = '#2f3a35', ridge = '#3c4741';
  // Raised stone terrace and steps.
  parts.push(place(tinted(new THREE.BoxGeometry(17, 1.4, 13), stone), 0, 0.2, 0));
  for (let s = 0; s < 4; s++) parts.push(place(tinted(new THREE.BoxGeometry(4.2, 0.35, 0.7), '#a29b89'), 0, -0.35 + s * 0.35, 7 - s * 0.55));
  // Main hall with double eaves (重檐).
  parts.push(place(tinted(new THREE.BoxGeometry(9.5, 3.4, 6), red), 0, 2.6, -1.5));
  for (let i = 0; i < 6; i++) parts.push(place(tinted(new THREE.CylinderGeometry(0.18, 0.2, 3.4, 8), '#6f2a20'), -4.4 + i * 1.76, 2.6, 1.7));
  parts.push(place(roof(13.4, 9.4, 1.9, 1.1, tile), 0, 4.25, -1.5));
  parts.push(place(tinted(new THREE.BoxGeometry(7.2, 1.1, 4.2), red), 0, 6.3, -1.5));
  parts.push(place(roof(10.2, 7, 2.5, 0.9, tile), 0, 6.75, -1.5));
  parts.push(place(tinted(new THREE.BoxGeometry(5.4, 0.32, 0.3), ridge), 0, 9.2, -1.5));
  // Side halls.
  for (const x of [-6.2, 6.2]) {
    parts.push(place(tinted(new THREE.BoxGeometry(3.4, 2.4, 6.5), red), x, 2.1, 1.5));
    parts.push(place(roof(4.8, 8.2, 1.3, 0.5, tile), x, 3.3, 1.5));
  }
  // Enclosure wall with tiled coping and a gate.
  for (const [x, z, w, d] of [[0, -8, 20, 0.6], [-10, -1.5, 0.6, 13], [10, -1.5, 0.6, 13], [-6.5, 5, 7, 0.6], [6.5, 5, 7, 0.6]] as const) {
    parts.push(place(tinted(new THREE.BoxGeometry(w, 2, d), wall), x, 1.4, z));
    parts.push(place(tinted(new THREE.BoxGeometry(w + 0.5, 0.25, d + 0.6), tile), x, 2.5, z));
  }
  parts.push(place(roof(5.6, 2.6, 1.0, 0.45, tile), 0, 3.0, 5.4));
  for (const x of [-1.6, 1.6]) parts.push(place(tinted(new THREE.BoxGeometry(0.5, 2.6, 0.5), red), x, 1.7, 5.4));
  const geometry = mergeGeometries(parts.map(p => { if (!p.getAttribute('normal')) p.computeVertexNormals(); return p; }));
  return geometry;
}

export function templeBase(x: number, z: number) {
  let y = -Infinity;
  for (let dx = -8; dx <= 8; dx += 4) for (let dz = -6; dz <= 6; dz += 4) y = Math.max(y, groundHeight(x + dx, z + dz));
  return lerp(y, groundHeight(x, z), 0.35) - 0.2;
}
