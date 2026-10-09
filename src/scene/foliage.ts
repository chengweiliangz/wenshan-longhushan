import * as THREE from 'three';
import { lerp, riverHalf, riverX, rng, smoothstep } from './math';
import type { Shared } from './atmosphere';
import { boulderGeometry, groundHeight, paintBoulder } from './landscape';

export type Clump = { x: number; z: number; y?: number; lean: number; dir: number; stalks: number; height: number; sprays: number; leaf: number; spread?: number };

/** Narrow lanceolate bamboo leaf along +X (length 1), drooping toward the tip. */
function leafGeometry() {
  const seg = 7, pts: number[] = [], idx: number[] = [], uvs: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = 0.072 * Math.sin(Math.PI * Math.pow(t, 0.62)) + (i === 0 ? 0.008 : 0);
    const droop = -0.22 * t * t;
    pts.push(t, droop - w * 0.25, -w, t, droop + 0.012, 0, t, droop - w * 0.25, w);
    uvs.push(t, 0, t, 0.5, t, 1);
    if (i < seg) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function stalkGeometry() {
  const g = new THREE.CylinderGeometry(1, 1.12, 1, 7, 28, true);
  g.translate(0, 0.5, 0);
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#6f8a4a'), node = new THREE.Color('#3f5130'), pale = new THREE.Color('#9aa266'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const ring = (y * 28) % 4 < 0.6 ? 1 : 0;
    c.copy(base).lerp(pale, smoothstep(0.35, 0, y) * 0.5).lerp(node, ring * 0.7);
    c.toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** World-space wind shared by stalks, twigs and leaves so attached parts move together. */
function windMaterial(shared: Shared, leaf: boolean) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: !leaf, color: leaf ? 0xffffff : 0xffffff, roughness: leaf ? 0.62 : 0.55, metalness: 0,
    side: leaf ? THREE.DoubleSide : THREE.FrontSide, emissive: new THREE.Color(leaf ? '#16240f' : '#0c140a'),
  });
  m.onBeforeCompile = shader => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uWind = shared.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aBase;\nuniform float uTime;\nuniform float uWind;`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        ${leaf ? `float tip = clamp(position.x, 0.0, 1.0);
        float lph = dot(instanceMatrix[3].xyz, vec3(1.7, 2.3, 1.1));
        transformed.y += sin(uTime * 2.6 + lph) * 0.07 * tip * tip * uWind;
        transformed.z += sin(uTime * 1.9 + lph * 1.4) * 0.05 * tip * uWind;` : ''}`)
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wpos = modelMatrix * mvPosition;
        float hN = clamp((wpos.y - aBase.y) / aBase.w, 0.0, 1.3);
        float ph = aBase.x * 0.31 + aBase.z * 0.17;
        float sway = (sin(uTime * 0.85 + ph) * 0.65 + sin(uTime * 1.9 + ph * 2.1) * 0.22) * uWind;
        wpos.x += sway * hN * hN * 0.32;
        wpos.z += cos(uTime * 0.63 + ph) * 0.14 * hN * hN * uWind;
        mvPosition = viewMatrix * wpos;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => (leaf ? 'wind-leaf' : 'wind-stalk');
  return m;
}

export function createBamboo(shared: Shared, clumps: Clump[], seed = 3) {
  const r = rng(seed);
  const stalks: { m: THREE.Matrix4; base: number[] }[] = [];
  const twigs: { m: THREE.Matrix4; base: number[] }[] = [];
  const leaves: { m: THREE.Matrix4; base: number[]; c: THREE.Color }[] = [];
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  const leafGreens = ['#3f6436', '#557a3e', '#6c8c47', '#86a058', '#4b6e3d', '#a3a865'].map(c => new THREE.Color(c));

  const orient = (dir: THREE.Vector3, roll: number) => {
    const x = dir.clone().normalize();
    const z = new THREE.Vector3().crossVectors(x, Math.abs(x.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    return new THREE.Matrix4().makeBasis(x, y, z).multiply(new THREE.Matrix4().makeRotationX(roll));
  };

  for (const c of clumps) {
    const by = c.y ?? groundHeight(c.x, c.z);
    const base = [c.x, by, c.z, c.height];
    for (let s = 0; s < c.stalks; s++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * (c.spread ?? 0.7);
      const root = new THREE.Vector3(c.x + Math.cos(a) * rad, by - 0.3, c.z + Math.sin(a) * rad);
      const lean = c.lean + (r() - 0.5) * 0.28, dir = c.dir + (r() - 0.5) * 0.6;
      const axis = new THREE.Vector3(Math.sin(lean) * Math.cos(dir), Math.cos(lean), Math.sin(lean) * Math.sin(dir)).normalize();
      const height = c.height * lerp(0.7, 1.05, r());
      const radius = lerp(0.045, 0.085, r()) * (c.height / 12);
      q.setFromUnitVectors(up, axis);
      stalks.push({ m: new THREE.Matrix4().compose(root, q, new THREE.Vector3(radius, height, radius)), base });
      for (let k = 0; k < c.sprays; k++) {
        const t = lerp(0.42, 0.99, (k + r() * 0.6) / c.sprays);
        const origin = root.clone().addScaledVector(axis, height * t);
        const side = new THREE.Vector3(Math.cos(r() * 6.283), 0, Math.sin(r() * 6.283));
        const twigDir = side.clone().addScaledVector(axis, 0.35).add(tmp.set(0, -lerp(0.05, 0.4, t), 0)).normalize();
        const twigLen = lerp(0.5, 1.3, r()) * c.leaf * 2.2;
        q.setFromUnitVectors(up, twigDir);
        twigs.push({ m: new THREE.Matrix4().compose(origin, q, new THREE.Vector3(radius * 0.22, twigLen, radius * 0.22)), base });
        const count = 4 + Math.floor(r() * 4);
        for (let l = 0; l < count; l++) {
          const at = origin.clone().addScaledVector(twigDir, twigLen * lerp(0.35, 1, l / count));
          const yaw = (r() - 0.5) * 1.8;
          const ld = twigDir.clone().applyAxisAngle(axis, yaw).add(tmp.set(0, -lerp(0.15, 0.9, r()), 0)).normalize();
          const m = orient(ld, (r() - 0.5) * 1.2);
          const s = c.leaf * lerp(0.75, 1.25, r());
          m.scale(new THREE.Vector3(s, s, s * lerp(0.9, 1.3, r())));
          m.setPosition(at);
          leaves.push({ m, base, c: leafGreens[Math.floor(r() * leafGreens.length)].clone().multiplyScalar(lerp(0.75, 1.1, r())) });
        }
      }
    }
  }

  const group = new THREE.Group();
  const stalkMat = windMaterial(shared, false), leafMat = windMaterial(shared, true);
  const make = (geometry: THREE.BufferGeometry, material: THREE.Material, list: { m: THREE.Matrix4; base: number[]; c?: THREE.Color }[]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    const bases = new Float32Array(list.length * 4);
    list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); bases.set(it.base, i * 4); if (it.c) mesh.setColorAt(i, it.c); });
    geometry.setAttribute('aBase', new THREE.InstancedBufferAttribute(bases, 4));
    mesh.frustumCulled = false; // wind displacement moves vertices outside the static bounds
    group.add(mesh);
    return mesh;
  };
  const stalkGeo = stalkGeometry();
  make(stalkGeo, stalkMat, stalks);
  make(stalkGeo.clone(), stalkMat, twigs);
  make(leafGeometry(), leafMat, leaves);
  return { group, leafCount: leaves.length };
}

/** Riverside clumps the camera passes on its way downstream. */
export function bankClumps(count: number, seed = 11): Clump[] {
  const r = rng(seed), out: Clump[] = [];
  for (let i = 0; i < count; i++) {
    const z = 2 - i * (140 / count) - r() * 6;
    const side = i % 2 ? 1 : -1;
    const x = riverX(z) + side * (riverHalf(z) + lerp(0.8, 4.5, r()));
    out.push({ x, z, lean: lerp(0.18, 0.5, r()), dir: side > 0 ? Math.PI : 0, stalks: 4 + Math.floor(r() * 4), height: lerp(9, 14, r()), sprays: 9, leaf: 0.42 });
  }
  return out;
}

/** Moss-covered boulder for the lower-left foreground of the hero shot. */
export function createMossyBoulder(material: THREE.Material, at: THREE.Vector3, scale: number) {
  const boulder = new THREE.Mesh(paintBoulder(boulderGeometry(5.3, 4), 1), material);
  boulder.scale.set(scale * 1.25, scale, scale);
  boulder.position.copy(at);
  boulder.rotation.y = 0.6;
  return boulder;
}
