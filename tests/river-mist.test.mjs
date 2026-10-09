import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import * as THREE from 'three';

const sceneDir = new URL('../src/scene/', import.meta.url);
const code = buildSync({stdin: {contents: readFileSync(new URL('riverMist.ts', sceneDir), 'utf8'),
  loader: 'ts', resolveDir: fileURLToPath(sceneDir), sourcefile: 'riverMist.ts'},
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent'}).outputFiles[0].text;
const {createRiverMist, DEFAULT_RIVER_MIST, RIVER_MIST_FALLBACK_DENSITY} =
  await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

const shaderFor = (material, shaderName = 'standard') => {
  const source = THREE.ShaderLib[shaderName];
  const shader = {vertexShader: source.vertexShader, fragmentShader: source.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(source.uniforms)};
  material.onBeforeCompile(shader, {});
  return shader;
};
const objectFor = material => new THREE.Mesh(new THREE.BufferGeometry(), material);

test('PBR and canopy-style extension survive; shared materials attach exactly once', () => {
  const material = new THREE.MeshStandardMaterial({roughness: .96, alphaTest: .42});
  let calls = 0;
  material.onBeforeCompile = shader => { calls++; shader.uniforms.existingCover = {value: 7};
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\nif (diffuseColor.a < .42) discard;'); };
  material.customProgramCacheKey = () => 'canopy-existing-v2';
  const before = material.onBeforeCompile, cache = material.customProgramCacheKey;
  const depth = new THREE.MeshDepthMaterial();
  const root = new THREE.Group(), first = objectFor(material), second = objectFor([material, material]);
  first.customDepthMaterial = depth; root.add(first, second);
  const mist = createRiverMist();
  assert.equal(mist.attach(root), 1); assert.equal(mist.attach(root), 0);
  const shader = shaderFor(material);
  assert.equal(calls, 1); assert.equal(shader.uniforms.existingCover.value, 7);
  assert.ok(shader.fragmentShader.includes('if (diffuseColor.a < .42) discard;'));
  assert.ok(shader.fragmentShader.includes('#include <lights_physical_fragment>'));
  assert.ok(shader.vertexShader.includes('#include <shadowmap_vertex>'));
  assert.ok(shader.vertexShader.includes('dot(viewMatrix[0].xyz, mvPosition.xyz)'));
  assert.ok(material.customProgramCacheKey().startsWith('canopy-existing-v2:CC-river-mist'));
  assert.equal(depth.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  assert.equal(material.roughness, .96); assert.equal(material.alphaTest, .42);
  mist.dispose(); mist.dispose();
  assert.equal(material.onBeforeCompile, before); assert.equal(material.customProgramCacheKey, cache);
  assert.equal(shader.uniforms.uCCMistEnabled.value, 0); assert.equal(mist.getStats().materials, 0);
});

test('native default cache keys preserve distinct pre-existing material hooks', () => {
  const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
  a.onBeforeCompile = function firstSurface() {};
  b.onBeforeCompile = function secondSurface() {};
  const firstKey = a.customProgramCacheKey(), secondKey = b.customProgramCacheKey();
  const mist = createRiverMist(); mist.attach(objectFor([a,b]));
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
  assert.ok(a.customProgramCacheKey().startsWith(firstKey));
  assert.ok(b.customProgramCacheKey().startsWith(secondKey));
  mist.dispose();
});

test('uses the real water shader fog hooks and leaves water displacement/shadow code intact', () => {
  const waterSource = readFileSync(new URL('riverFlow.ts', sceneDir), 'utf8');
  const vertexShader = waterSource.match(/vertexShader:`([\s\S]*?)`,\s*fragmentShader:/)[1];
  const fragmentShader = waterSource.match(/fragmentShader:`([\s\S]*?)`\}\);/)[1];
  const water = new THREE.ShaderMaterial({vertexShader, fragmentShader, fog: true,
    uniforms: THREE.UniformsUtils.clone(THREE.UniformsLib.fog)});
  const mist = createRiverMist(); mist.attach(objectFor(water));
  const shader = {vertexShader, fragmentShader, uniforms: {...water.uniforms}};
  water.onBeforeCompile(shader, {});
  assert.equal(mist.getStats().compiled, 1); assert.equal(mist.getStats().unsupported, 0);
  assert.ok(shader.vertexShader.includes('p.y+=amplitude*uStrength'));
  assert.ok(shader.fragmentShader.includes('float sunVisibility=getShadowMask()'));
  assert.ok(shader.fragmentShader.includes('#include <colorspace_fragment>'));
  assert.ok(shader.fragmentShader.includes('ccMistAmount(vCCMistWorld)'));
  // Ordinary fog remains solely in the disabled fallback branch.
  assert.equal(shader.fragmentShader.match(/#include <fog_fragment>/g).length, 1);
  assert.equal(shader.fragmentShader.match(/float ccMistAmount/g).length, 1);
  mist.dispose();
});

test('every built-in fog surface used by the world accepts the extension', () => {
  const types = [['standard',THREE.MeshStandardMaterial], ['physical',THREE.MeshPhysicalMaterial],
    ['basic',THREE.MeshBasicMaterial], ['lambert',THREE.MeshLambertMaterial],
    ['phong',THREE.MeshPhongMaterial], ['basic',THREE.LineBasicMaterial], ['points',THREE.PointsMaterial]];
  for (const [name, Material] of types) {
    const material = new Material(), mist = createRiverMist();
    mist.attach(objectFor(material)); const shader = shaderFor(material, name);
    assert.equal(mist.getStats().compiled, 1, name);
    assert.ok(shader.vertexShader.includes('vCCMistWorld = cameraPosition'), name);
    mist.dispose();
  }
});

test('motion freezes without phase reset; exploration clearance and local water update stay active', () => {
  const material = new THREE.MeshStandardMaterial(), mist = createRiverMist();
  mist.attach(objectFor(material)); const shader = shaderFor(material);
  const u = shader.uniforms;
  mist.update({deltaSeconds: .05, motion: true, waterLevel: 4, speedAtmosphere: 1});
  const drift = u.uCCMistField.value.z;
  assert.ok(drift > 0); assert.equal(u.uCCMistField.value.x, 4);
  assert.equal(u.uCCMistField.value.w, 1.04);
  mist.update({deltaSeconds: 60, motion: true, reducedMotion: true, waterLevel: 5, exploring: true});
  assert.equal(u.uCCMistField.value.z, drift); assert.equal(u.uCCMistField.value.x, 5);
  assert.equal(u.uCCMistRange.value.x, DEFAULT_RIVER_MIST.walkClearStart);
  assert.equal(u.uCCMistRange.value.y, DEFAULT_RIVER_MIST.walkClearEnd);
  mist.update({deltaSeconds: 60, motion: false, waterLevel: 5});
  assert.equal(u.uCCMistField.value.z, drift);
  mist.update({deltaSeconds: 60, motion: true, waterLevel: 5});
  assert.ok(Math.abs(mist.getStats().elapsed-.15)<1e-12);
  mist.configure({strength: .7, maxOpacity: .74});
  assert.equal(u.uCCMistSlope.value.w, .74); assert.equal(u.uCCMistField.value.w, .7);
  assert.throws(() => mist.configure({clearEnd: 1}), RangeError);
  assert.throws(() => mist.configure({maxOpacity: 1}), RangeError);
  assert.throws(() => mist.configure({patchScale: NaN}), RangeError);
  mist.dispose();
});

test('low quality needs no new allocation/render pass and has a separate two-sample program', () => {
  const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial();
  const high = createRiverMist(), low = createRiverMist({low: true});
  high.attach(objectFor(a)); low.attach(objectFor(b));
  const highShader = shaderFor(a), lowShader = shaderFor(b);
  assert.notEqual(a.customProgramCacheKey(), b.customProgramCacheKey());
  assert.equal(high.getStats().samples, 3); assert.equal(low.getStats().samples, 2);
  assert.ok(highShader.fragmentShader.includes('mat2(.81,-.59,.59,.81)'));
  assert.ok(lowShader.fragmentShader.includes('float b = a;'));
  assert.equal(Object.keys(lowShader.uniforms).filter(k => k.startsWith('uCCMist')).length, 5);
  assert.ok(RIVER_MIST_FALLBACK_DENSITY < .010);
  high.dispose(); low.dispose();
});

test('fog opt-out/raw materials are untouched; unsupported custom shaders report a fallback', () => {
  const mist = createRiverMist();
  const noFog = new THREE.MeshBasicMaterial({fog: false}), raw = new THREE.RawShaderMaterial({fog: true});
  const custom = new THREE.ShaderMaterial({fog: true, vertexShader: 'void main(){}', fragmentShader: 'void main(){}'});
  assert.equal(mist.attach(objectFor([noFog, raw, custom])), 1);
  const shader = {vertexShader: custom.vertexShader, fragmentShader: custom.fragmentShader, uniforms: {}};
  custom.onBeforeCompile(shader, {});
  assert.equal(mist.getStats().unsupported, 1); assert.equal(mist.getStats().compiled, 0);
  assert.deepEqual(shader.uniforms, {}); mist.dispose();
});

test('clear/material disposal restore callbacks and do not dispose scene resources', () => {
  const material = new THREE.MeshStandardMaterial(), original = material.onBeforeCompile;
  const object = objectFor(material), mist = createRiverMist(); let disposed = 0;
  material.addEventListener('dispose', () => disposed++);
  mist.attach(object); const shader = shaderFor(material); mist.clear(object);
  assert.equal(disposed, 0); assert.equal(material.onBeforeCompile, original);
  assert.equal(shader.uniforms.uCCMistEnabled.value, 0); assert.equal(mist.getStats().materials, 0);
  mist.attach(object); material.dispose();
  assert.equal(disposed, 1); assert.equal(mist.getStats().materials, 0);
  assert.equal(material.onBeforeCompile, original); mist.dispose();
});

test('disposing after another extension wraps the mist never overwrites the newer hook', () => {
  const material = new THREE.MeshStandardMaterial(), mist = createRiverMist();
  mist.attach(objectFor(material)); const shader = shaderFor(material), previous = material.onBeforeCompile;
  const next = (shader, renderer) => previous.call(material, shader, renderer);
  material.onBeforeCompile = next;
  mist.dispose();
  assert.equal(material.onBeforeCompile, next); assert.equal(shader.uniforms.uCCMistEnabled.value, 0);
});
