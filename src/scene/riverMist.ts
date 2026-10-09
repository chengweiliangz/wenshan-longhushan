import * as THREE from 'three';

/** Display atmosphere only. Coordinates remain in the scene's 10 metres/unit.
 * This replaces the ordinary fog blend; it adds no surfaces, lights or textures.
 * Keep scene.fog for its colour and for materials that intentionally opt out. */
export type RiverMistSettings = {
  strength: number;
  clearStart: number;
  clearEnd: number;
  walkClearStart: number;
  walkClearEnd: number;
  baseDensity: number;
  lowDensity: number;
  lowHeight: number;
  lowThickness: number;
  slopeDensity: number;
  slopeHeight: number;
  slopeThickness: number;
  farStart: number;
  farDensity: number;
  maxOpacity: number;
  patchScale: number;
  driftSpeed: number;
};

export const DEFAULT_RIVER_MIST: Readonly<RiverMistSettings> = Object.freeze({
  strength: 1,
  clearStart: 2.8,
  clearEnd: 7.5,
  walkClearStart: 4.5,
  walkClearEnd: 11.5,
  baseDensity: .0028,
  lowDensity: .030,
  lowHeight: .9,
  lowThickness: 1.05,
  slopeDensity: .016,
  slopeHeight: 6.5,
  slopeThickness: 3,
  farStart: 32,
  farDensity: .006,
  maxOpacity: .80,
  patchScale: .0425,
  driftSpeed: .009,
});

/** The old .018/.010 + speed*.002 writer must be removed at integration.
 * This mild fallback is only for an unsupported, otherwise fog-enabled shader. */
export const RIVER_MIST_FALLBACK_DENSITY = .003;

export type RiverMistFrame = {
  deltaSeconds: number;
  /** False freezes the field without clearing it, including suspended views. */
  motion: boolean;
  reducedMotion?: boolean;
  /** Local river surface in scene units, sampled at the active camera/raft. */
  waterLevel: number;
  exploring?: boolean;
  /** Existing smoothed [0,1] speed value; its effect is limited to 4%. */
  speedAtmosphere?: number;
};

type FogMaterial = THREE.Material & {fog?: boolean; isRawShaderMaterial?: boolean};
type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];
type Patch = {
  before: THREE.Material['onBeforeCompile'];
  cache: THREE.Material['customProgramCacheKey'];
  wrapped: THREE.Material['onBeforeCompile'];
  wrappedCache: THREE.Material['customProgramCacheKey'];
  release: () => void;
  enabled: {value: number};
  compiled: boolean;
  unsupported: boolean;
};

function checkedSettings(settings: Partial<RiverMistSettings>): RiverMistSettings {
  const next = {...DEFAULT_RIVER_MIST, ...settings};
  for (const [key, value] of Object.entries(next)) {
    if (!Number.isFinite(value)) throw new RangeError(`River mist ${key} must be finite`);
  }
  if (next.clearStart < 0 || next.clearEnd <= next.clearStart ||
      next.walkClearStart < 0 || next.walkClearEnd <= next.walkClearStart ||
      next.lowThickness <= 0 || next.slopeThickness <= 0 || next.patchScale <= 0 ||
      next.strength < 0 || next.strength > 2 || next.maxOpacity < 0 || next.maxOpacity > .9 ||
      [next.baseDensity, next.lowDensity, next.slopeDensity, next.farStart, next.farDensity, next.driftSpeed].some(v => v < 0)) {
    throw new RangeError('Invalid river mist layer, density or visibility range');
  }
  return next;
}

const vertexAssignment = `
#include <fog_vertex>
#ifdef USE_FOG
  // mvPosition already includes skinning, instancing and custom water displacement.
  // The inverse rotation also uses the actual reflection camera in a planar pass.
  vCCMistWorld = cameraPosition + vec3(
    dot(viewMatrix[0].xyz, mvPosition.xyz),
    dot(viewMatrix[1].xyz, mvPosition.xyz),
    dot(viewMatrix[2].xyz, mvPosition.xyz));
#endif
`;

function fragmentDeclarations(low: boolean) {
  return `
#ifdef USE_FOG
varying vec3 vCCMistWorld;
uniform float uCCMistEnabled;
uniform vec4 uCCMistRange; // near start/end, far start/density
uniform vec4 uCCMistLow; // height, thickness, density, base density
uniform vec4 uCCMistSlope; // height, thickness, density, maximum opacity
uniform vec4 uCCMistField; // water level, patch scale, drift, strength

float ccMistHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float ccMistNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(ccMistHash(i), ccMistHash(i+vec2(1.,0.)), f.x),
             mix(ccMistHash(i+vec2(0.,1.)), ccMistHash(i+vec2(1.)), f.x), f.y);
}
float ccMistDensity(vec3 p) {
  vec2 q = p.xz*uCCMistField.y + vec2(uCCMistField.z, -.63*uCCMistField.z);
  float a = ccMistNoise(q);
  float b = ${low ? 'a' : 'ccMistNoise(mat2(.81,-.59,.59,.81)*q*.53 + vec2(19.7,47.1))'};
  float h = p.y-uCCMistField.x;
  float lowCentre = uCCMistLow.x+(b-.5)*1.6;
  float lowHeight = (h-lowCentre)/(uCCMistLow.y*(.72+.65*a));
  float lowPatch = .06+.94*smoothstep(.27,.76,a);
  float lowBand = exp(-lowHeight*lowHeight)*lowPatch*smoothstep(-.8,.15,h);
  float slopeCentre = uCCMistSlope.x+(a-.5)*7.;
  float slopeHeight = (h-slopeCentre)/(uCCMistSlope.y*(.75+.6*b));
  float slopePatch = .12+.88*smoothstep(.24,.78,b);
  float slopeBand = exp(-slopeHeight*slopeHeight)*slopePatch;
  // Peaks keep their colour and silhouette; low and middle layers stay distinct.
  float base = uCCMistLow.w*exp(-max(h,0.)*.028);
  return base+uCCMistLow.z*lowBand+uCCMistSlope.z*slopeBand;
}
float ccMistAmount(vec3 worldPoint) {
  vec3 ray = worldPoint-cameraPosition;
  float distanceToPoint = length(ray);
  float travel = max(0.,distanceToPoint-uCCMistRange.x);
  if (travel <= 0.) return 0.;
  vec3 direction = ray/max(distanceToPoint,.0001);
  vec3 start = cameraPosition+direction*uCCMistRange.x;
  // Fixed quadrature, not a screen-space overlay or a ray-marching render pass.
  float density = ${low ?
    '(ccMistDensity(start+direction*travel*.25)+ccMistDensity(start+direction*travel*.75))*.5' :
    '(ccMistDensity(start+direction*travel*(1./6.))+ccMistDensity(start+direction*travel*.5)+ccMistDensity(start+direction*travel*(5./6.)))/3.'};
  float distant = max(0.,distanceToPoint-uCCMistRange.z)*uCCMistRange.w;
  float nearWeight = smoothstep(uCCMistRange.x,uCCMistRange.y,distanceToPoint);
  float opticalDepth = (travel*density+distant)*nearWeight*uCCMistField.w;
  // A soft asymptote avoids making every distant ridge hit one flat opacity.
  return uCCMistSlope.w*(1.-exp(-opticalDepth/max(uCCMistSlope.w,.0001)));
}
#endif
`;
}

const fogBlend = `
#ifdef USE_FOG
  if (uCCMistEnabled > .5) {
    float ccAmount = ccMistAmount(vCCMistWorld);
    vec3 ccRay = normalize(vCCMistWorld-cameraPosition+vec3(0.,.000001,0.));
    // Broad, very small warm/cool variation follows the existing daylight vector.
    // fogColor is supplied by Three in the correct output colour space per pass.
    float ccLight = .35+.30*pow(max(dot(ccRay,normalize(vec3(-300.,600.,180.))),0.),2.);
    vec3 ccTint = mix(vec3(.975,1.,1.02),vec3(1.025,1.015,.985),ccLight);
    gl_FragColor.rgb = mix(gl_FragColor.rgb,clamp(fogColor*ccTint,0.,1.),ccAmount);
  } else {
    #include <fog_fragment>
  }
#endif
`;

export function createRiverMist(options: {low?: boolean; settings?: Partial<RiverMistSettings>} = {}) {
  const low = options.low === true;
  let settings = checkedSettings(options.settings ?? {}), disposed = false, elapsed = 0;
  let waterLevel = 0, exploring = false, speed = 0;
  const materials = new Map<FogMaterial, Patch>();
  const uniforms = {
    uCCMistRange: {value: new THREE.Vector4()},
    uCCMistLow: {value: new THREE.Vector4()},
    uCCMistSlope: {value: new THREE.Vector4()},
    uCCMistField: {value: new THREE.Vector4()},
  };
  const sync = () => {
    uniforms.uCCMistRange.value.set(exploring ? settings.walkClearStart : settings.clearStart,
      exploring ? settings.walkClearEnd : settings.clearEnd, settings.farStart, settings.farDensity);
    uniforms.uCCMistLow.value.set(settings.lowHeight, settings.lowThickness, settings.lowDensity, settings.baseDensity);
    uniforms.uCCMistSlope.value.set(settings.slopeHeight, settings.slopeThickness, settings.slopeDensity, settings.maxOpacity);
    uniforms.uCCMistField.value.set(waterLevel, settings.patchScale,
      elapsed*settings.driftSpeed*settings.patchScale, settings.strength*(1+speed*.04));
  };
  sync();

  const attachMaterial = (material: FogMaterial) => {
    if (disposed || material.fog !== true || material.isRawShaderMaterial || materials.has(material)) return false;
    const before = material.onBeforeCompile, cache = material.customProgramCacheKey;
    // Evaluate before changing onBeforeCompile: Three's default key reads that hook.
    const baseKey = cache.call(material);
    const record: Patch = {
      before, cache, compiled: false, unsupported: false, enabled: {value: 1},
      wrapped(shader: Shader, renderer: THREE.WebGLRenderer) {
        before.call(material, shader, renderer);
        if (!shader.vertexShader.includes('#include <fog_vertex>') ||
            !shader.fragmentShader.includes('#include <fog_fragment>') ||
            !shader.fragmentShader.includes('#include <fog_pars_fragment>')) {
          record.unsupported = true;
          return;
        }
        Object.assign(shader.uniforms, uniforms, {uCCMistEnabled: record.enabled});
        shader.vertexShader = '#ifdef USE_FOG\nvarying vec3 vCCMistWorld;\n#endif\n'+
          shader.vertexShader.replace('#include <fog_vertex>', vertexAssignment);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\n'+fragmentDeclarations(low))
          .replace('#include <fog_fragment>', fogBlend);
        record.compiled = true;
      },
      wrappedCache: () => `${baseKey}:CC-river-mist-v1:${low ? 'low2' : 'high3'}`,
      release() {
        // Do not overwrite another extension attached after us. A retained wrapper
        // becomes inert through uCCMistEnabled when the controller is disposed.
        record.enabled.value = 0;
        if (material.onBeforeCompile === record.wrapped) material.onBeforeCompile = before;
        if (material.customProgramCacheKey === record.wrappedCache) material.customProgramCacheKey = cache;
        material.removeEventListener('dispose', record.release);
        materials.delete(material);
        material.needsUpdate = true;
      },
    };
    material.onBeforeCompile = record.wrapped;
    material.customProgramCacheKey = record.wrappedCache;
    material.addEventListener('dispose', record.release);
    material.needsUpdate = true;
    materials.set(material, record);
    return true;
  };

  return {
    /** Call after existing landcover/slope/canopy hooks, and on each lazy subtree.
     * Reattaching is idempotent. Custom shadow/depth materials are never patched. */
    attach(root: THREE.Object3D) {
      let count = 0;
      if (!disposed) root.traverse(object => {
        const material = (object as THREE.Mesh).material;
        if (material) for (const item of Array.isArray(material) ? material : [material]) {
          if (attachMaterial(item)) count++;
        }
      });
      return count;
    },
    update(frame: RiverMistFrame) {
      if (disposed) return;
      if (Number.isFinite(frame.waterLevel)) waterLevel = frame.waterLevel;
      exploring = frame.exploring === true;
      speed = Number.isFinite(frame.speedAtmosphere) ? THREE.MathUtils.clamp(frame.speedAtmosphere!, 0, 1) : 0;
      if (frame.motion && !frame.reducedMotion && Number.isFinite(frame.deltaSeconds)) {
        elapsed += THREE.MathUtils.clamp(frame.deltaSeconds, 0, .1);
      }
      sync();
    },
    configure(next: Partial<RiverMistSettings>) {
      if (disposed) return;
      settings = checkedSettings({...settings, ...next});
      sync();
    },
    getStats() {
      return {materials: materials.size, compiled: [...materials.values()].filter(p => p.compiled).length,
        unsupported: [...materials.values()].filter(p => p.unsupported).length,
        samples: low ? 2 : 3, elapsed, exploring, waterLevel, disposed, settings: {...settings}};
    },
    /** Detach this subtree without disposing any of its geometry or materials.
     * A shared material is detached for every object that uses it. */
    clear(root: THREE.Object3D) {
      root.traverse(object => {
        const material = (object as THREE.Mesh).material;
        if (material) for (const item of Array.isArray(material) ? material : [material]) materials.get(item)?.release();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const patch of [...materials.values()]) patch.release();
    },
  };
}
