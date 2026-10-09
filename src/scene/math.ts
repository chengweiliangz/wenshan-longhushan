// Deterministic helpers shared by every procedural builder, so the landscape is identical on each load.

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, z: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}
const fade = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [-1, 1]. */
export function noise3(x: number, y: number, z = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const n = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz);
  const v = l(
    l(l(n(0, 0, 0), n(1, 0, 0), fx), l(n(0, 1, 0), n(1, 1, 0), fx), fy),
    l(l(n(0, 0, 1), n(1, 0, 1), fx), l(n(0, 1, 1), n(1, 1, 1), fx), fy),
    fz,
  );
  return v * 2 - 1;
}

export function fbm(x: number, y: number, z = 0, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) { sum += noise3(x * freq, y * freq, z * freq) * amp; freq *= 2.03; amp *= 0.5; }
  return sum;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Centre line of 泸溪河 in world X for a given depth Z. Mirrored in the water shader. */
export const riverX = (z: number) => 4 * Math.sin(z * 0.028 + 0.6) + 6 * Math.sin(z * 0.009 - 0.3);
export const riverHalf = (z: number) => 8.5 + 2.5 * Math.sin(z * 0.017 + 1.3);

export const GLSL_RIVER = /* glsl */`
float riverX(float z) { return 4.0 * sin(z * 0.028 + 0.6) + 6.0 * sin(z * 0.009 - 0.3); }
float riverHalf(float z) { return 8.5 + 2.5 * sin(z * 0.017 + 1.3); }
`;

export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.03 + 17.0; a *= 0.5; } return s; }
`;
