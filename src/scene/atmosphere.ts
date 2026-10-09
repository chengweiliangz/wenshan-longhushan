import * as THREE from 'three';
import { GLSL_NOISE, clamp, smoothstep } from './math';

/** Uniforms shared by every custom shader. The scene owns them; only LandscapeScene.update writes them. */
export function createShared() {
  return {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
    uSunColor: { value: new THREE.Color() },
    uSkyTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.005 },
  };
}
export type Shared = ReturnType<typeof createShared>;

type Mood = { p: number; skyTop: string; horizon: string; fog: string; sun: string; sunI: number; hemi: number; dir: [number, number, number]; fogD: number };
// Keyed to chapter progress: morning haze → clear river light → golden valley → 丹霞 dusk.
const MOODS: Mood[] = [
  { p: 0, skyTop: '#8fa5a2', horizon: '#e4e0cf', fog: '#c9cfc1', sun: '#fff0d6', sunI: 2.3, hemi: 1.05, dir: [0.62, 0.5, 0.6], fogD: 0.0052 },
  { p: 1.5, skyTop: '#8aa3a3', horizon: '#e1e2d2', fog: '#c3cdc0', sun: '#fff3e2', sunI: 2.4, hemi: 1.1, dir: [0.7, 0.6, 0.25], fogD: 0.0056 },
  { p: 3, skyTop: '#879aa0', horizon: '#ead9bd', fog: '#cdc8b4', sun: '#ffe2b8', sunI: 2.4, hemi: 1.0, dir: [0.55, 0.42, -0.4], fogD: 0.0046 },
  { p: 4, skyTop: '#7b8b96', horizon: '#efcca2', fog: '#d4bfa0', sun: '#ffc98c', sunI: 2.5, hemi: 0.92, dir: [0.3, 0.2, -0.93], fogD: 0.0036 },
  { p: 6, skyTop: '#4d5966', horizon: '#e49f78', fog: '#b39385', sun: '#ff9a66', sunI: 2.1, hemi: 0.72, dir: [0.18, 0.09, -0.98], fogD: 0.0038 },
];
const parsed = MOODS.map(m => ({ ...m, c: { skyTop: new THREE.Color(m.skyTop), horizon: new THREE.Color(m.horizon), fog: new THREE.Color(m.fog), sun: new THREE.Color(m.sun) }, v: new THREE.Vector3(...m.dir).normalize() }));

export function sampleMood(p: number, out: { skyTop: THREE.Color; horizon: THREE.Color; fog: THREE.Color; sun: THREE.Color; dir: THREE.Vector3 }) {
  let i = 0;
  while (i < parsed.length - 2 && p > parsed[i + 1].p) i++;
  const a = parsed[i], b = parsed[i + 1];
  const t = smoothstep(0, 1, clamp((p - a.p) / (b.p - a.p)));
  out.skyTop.copy(a.c.skyTop).lerp(b.c.skyTop, t);
  out.horizon.copy(a.c.horizon).lerp(b.c.horizon, t);
  out.fog.copy(a.c.fog).lerp(b.c.fog, t);
  out.sun.copy(a.c.sun).lerp(b.c.sun, t);
  out.dir.copy(a.v).lerp(b.v, t).normalize();
  return { sunI: a.sunI + (b.sunI - a.sunI) * t, hemi: a.hemi + (b.hemi - a.hemi) * t, fogD: a.fogD + (b.fogD - a.fogD) * t };
}

const FOG = /* glsl */`
vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}`;

export function createSky(shared: Shared) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSkyTop, uHorizon, uFogColor, uSunColor, uSunDir; uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(uHorizon, uSkyTop, smoothstep(-0.02, 0.5, h));
        col = mix(uFogColor, col, smoothstep(-0.12, 0.04, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(sd, 5.0) * 0.16 + pow(sd, 48.0) * 0.4 + pow(sd, 900.0) * 1.6);
        vec2 cp = d.xz / max(h + 0.08, 0.06) * 0.9 + vec2(uTime * 0.006, 0.0);
        float cloud = smoothstep(0.5, 0.82, fbm2(cp * 0.7)) * smoothstep(0.03, 0.3, h);
        col = mix(col, mix(uHorizon, vec3(1.0), 0.35) + uSunColor * 0.08 * sd, cloud * 0.4);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/** Layered painted ridgelines far behind the 3D mountains: atmospheric perspective at almost no cost. */
export function createRidges(shared: Shared, layers: { z: number; depth: number; seed: number; base: number; amp: number; color: string }[]) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1600, 260);
  layers.forEach((l, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uSeed: { value: l.seed }, uBase: { value: l.base }, uAmp: { value: l.amp }, uDepth: { value: l.depth }, uColor: { value: new THREE.Color(l.color) } },
      transparent: true, depthWrite: false, fog: false,
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        uniform float uSeed, uBase, uAmp, uDepth; uniform vec3 uColor, uFogColor, uSunColor, uSunDir, uHorizon;
        varying vec3 vWorld;
        ${GLSL_NOISE}
        void main() {
          float x = vWorld.x;
          float h = uBase + uAmp * fbm2(vec2(x * 0.0065 + uSeed, uSeed * 1.7));
          float m = fbm2(vec2(x * 0.014 + uSeed * 3.1, 2.0 + uSeed));
          h += smoothstep(0.5, 0.56, m) * uAmp * 0.55 + smoothstep(0.62, 0.66, m) * uAmp * 0.25;
          float aa = fwidth(vWorld.y) * 1.5;
          float alpha = 1.0 - smoothstep(h - aa, h + aa, vWorld.y);
          if (alpha < 0.01) discard;
          vec3 col = mix(uColor, uFogColor, uDepth);
          float mist = 1.0 - smoothstep(uBase - 10.0, uBase + uAmp * 0.7, vWorld.y);
          col = mix(col, mix(uFogColor, uHorizon, 0.5), mist * 0.6);
          float rim = smoothstep(4.0, 0.0, h - vWorld.y) * max(-uSunDir.z, 0.0);
          col += uSunColor * rim * 0.12 * (1.0 - uDepth);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 110, l.z);
    mesh.renderOrder = -9 + i * 0.01;
    group.add(mesh);
  });
  return group;
}

/** Drifting cloud-sea sheets and vertical mist veils between the mountain layers. */
export function createMist(shared: Shared, veils: { x: number; y: number; z: number; w: number; h: number; opacity: number; speed: number; ry?: number }[], sheetOpacity: number) {
  const group = new THREE.Group();
  const common = /* glsl */`
    uniform float uTime, uOpacity, uSpeed, uFogDensity; uniform vec3 uFogColor, uHorizon, uSunColor, uSunDir;
    varying vec2 vUv; varying vec3 vWorld;
    ${GLSL_NOISE}
    ${FOG}
  `;
  const vertexShader = /* glsl */`
    varying vec2 vUv; varying vec3 vWorld;
    void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  veils.forEach((v, i) => {
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uOpacity: { value: v.opacity }, uSpeed: { value: v.speed } },
      transparent: true, depthWrite: false, fog: false,
      vertexShader,
      fragmentShader: /* glsl */`${common}
        void main() {
          vec2 p = vec2(vWorld.x * 0.018 + uTime * uSpeed, vWorld.y * 0.05 + vWorld.z * 0.01);
          float n = fbm2(p) * 1.25 + fbm2(p * 2.6 - uTime * uSpeed * 0.6) * 0.35;
          float vertical = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
          float side = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float a = smoothstep(0.35, 0.95, n) * vertical * side * uOpacity;
          float camFade = smoothstep(6.0, 28.0, distance(cameraPosition, vWorld));
          vec3 col = mix(uFogColor, uHorizon, 0.45) + uSunColor * 0.06;
          gl_FragColor = vec4(col, a * camFade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(v.w, v.h), material);
    mesh.position.set(v.x, v.y, v.z);
    mesh.rotation.y = v.ry ?? 0;
    mesh.renderOrder = 5 + i * 0.01;
    group.add(mesh);
  });
  // Low cloud-sea sheet hugging the river valley.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(320, 420), new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: sheetOpacity }, uSpeed: { value: 0.01 } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader,
    fragmentShader: /* glsl */`${common}
      void main() {
        vec2 p = vWorld.xz * 0.028 + vec2(uTime * 0.012, uTime * 0.02);
        float n = fbm2(p) + fbm2(p * 2.3 + 9.0 - uTime * 0.01) * 0.4;
        float d = distance(cameraPosition, vWorld);
        float a = smoothstep(0.42, 0.95, n) * uOpacity * smoothstep(10.0, 45.0, d) * (1.0 - smoothstep(260.0, 380.0, d));
        vec3 col = mix(uFogColor, uHorizon, 0.5) + uSunColor * 0.05;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(0, 2.2, -140);
  sheet.renderOrder = 4;
  group.add(sheet);
  return group;
}

export const FOG_GLSL = FOG;
