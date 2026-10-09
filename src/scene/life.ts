import * as THREE from 'three';
import { rng } from './math';
import type { Shared } from './atmosphere';

/** Slow motes of pollen and dust in the light. Motion is computed on the GPU from uTime. */
export function createMotes(shared: Shared, count: number) {
  const r = rng(5);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 70;
    pos[i * 3 + 1] = 0.6 + r() * 16;
    pos[i * 3 + 2] = 40 - r() * 170;
    seed[i] = r() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime, uPixelRatio; varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.11 + aSeed) * 1.6;
        p.y += sin(uTime * 0.17 + aSeed * 1.7) * 0.9 + mod(uTime * 0.05 + aSeed, 3.0) * 0.4;
        p.z += cos(uTime * 0.09 + aSeed * 0.5) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = -mv.z;
        gl_PointSize = clamp(26.0 * uPixelRatio / depth, 1.0, 9.0 * uPixelRatio);
        vAlpha = (0.45 + 0.35 * sin(uTime * 0.7 + aSeed * 3.0)) * smoothstep(2.0, 8.0, depth) * (1.0 - smoothstep(60.0, 110.0, depth));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSunColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha * 0.55;
        gl_FragColor = vec4(mix(vec3(1.0, 0.97, 0.88), uSunColor, 0.4), a);
      }`,
  });
  const points = new THREE.Points(g, material);
  points.frustumCulled = false;
  points.renderOrder = 8;
  return points;
}

/** A few egrets gliding far over the river. Wings flap on the CPU: three meshes, negligible cost. */
export function createEgrets(material: THREE.Material, count: number) {
  const group = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.3, 1.5, 0.05, 0.05], 3));
  wing.computeVertexNormals();
  const body = new THREE.ConeGeometry(0.12, 1.0, 5);
  body.rotateX(Math.PI / 2);
  const birds = Array.from({ length: count }, (_, i) => {
    const bird = new THREE.Group();
    const left = new THREE.Mesh(wing, material), right = new THREE.Mesh(wing, material);
    right.scale.x = -1;
    bird.add(left, right, new THREE.Mesh(body, material));
    bird.scale.setScalar(0.9 + i * 0.15);
    group.add(bird);
    return { bird, left, right, phase: i * 2.1, radius: 28 + i * 9, height: 14 + i * 3.5, cx: -4 + i * 6, cz: -78 - i * 14 };
  });
  return {
    group,
    update(t: number) {
      for (const b of birds) {
        const a = t * 0.05 + b.phase;
        b.bird.position.set(b.cx + Math.cos(a) * b.radius, b.height + Math.sin(t * 0.3 + b.phase) * 0.8, b.cz + Math.sin(a) * b.radius * 0.45);
        b.bird.rotation.y = -a + Math.PI;
        const flap = Math.sin(t * 3.2 + b.phase) * 0.55;
        b.left.rotation.z = flap; b.right.rotation.z = -flap;
      }
    },
  };
}
