import * as THREE from 'three';
import { GLSL_NOISE, GLSL_RIVER } from './math';
import { FOG_GLSL, type Shared } from './atmosphere';

export function createWater(shared: Shared) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uDeep: { value: new THREE.Color('#163a33') }, uShallow: { value: new THREE.Color('#4d6e57') }, uBankShade: { value: new THREE.Color('#1c2f22') } },
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFogDensity; uniform vec3 uSkyTop, uHorizon, uSunColor, uSunDir, uFogColor, uDeep, uShallow, uBankShade;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      ${GLSL_RIVER}
      ${FOG_GLSL}
      float waves(vec2 p) {
        float t = uTime;
        float h = sin(dot(p, vec2(0.12, 0.9)) * 1.4 + t * 1.1) * 0.5;
        h += sin(dot(p, vec2(-0.7, 0.5)) * 2.3 + t * 1.7) * 0.25;
        h += vnoise(p * vec2(1.6, 0.5) + vec2(0.0, t * 0.9)) * 0.9;
        h += vnoise(p * 3.0 + vec2(t * 0.3, t * 1.1)) * 0.12;
        return h;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.08;
        float h0 = waves(p);
        vec3 n = normalize(vec3(-(waves(p + vec2(e, 0.0)) - h0) / e * 0.035, 1.0, -(waves(p + vec2(0.0, e)) - h0) / e * 0.035));
        vec3 v = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uSkyTop, smoothstep(0.0, 0.5, r.y));
        float d = abs(vWorld.x - riverX(vWorld.z)) - riverHalf(vWorld.z);
        float bank = smoothstep(-7.0, 0.0, d);
        // Mirror-like dark band where wooded banks and cliffs reflect.
        vec3 refl = mix(sky, uBankShade, bank * 0.75);
        vec3 body = mix(uDeep, uShallow, smoothstep(-3.5, 0.0, d) * 0.7);
        vec3 col = mix(body, refl, clamp(fres * 0.9 + 0.12, 0.0, 1.0));
        float spec = pow(max(dot(r, uSunDir), 0.0), 220.0);
        float glint = smoothstep(0.55, 0.9, vnoise(p * 3.0 + uTime * 0.8));
        col += uSunColor * (spec * 2.2 + spec * glint * 3.0);
        float flow = smoothstep(0.72, 0.95, vnoise(vec2(p.x * 2.0, p.y * 0.18 + uTime * 0.35))) * (1.0 - bank) * 0.06;
        col += vec3(flow);
        col = mix(col, uShallow * 1.2, smoothstep(-0.6, 0.0, d) * 0.35);
        col = applyFog(col, dist);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(320, 420, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -140);
  return mesh;
}
