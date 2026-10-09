import * as THREE from 'three';
import { createMist, createRidges, createShared, createSky, sampleMood, type Shared } from './atmosphere';
import { createBrandText, loadDisplayFont } from './brandText';
import { bankClumps, createBamboo, createMossyBoulder, type Clump } from './foliage';
import { createBankRocks, createForest, createRocks, createTerrain, groundHeight, ROCKS } from './landscape';
import { createEgrets, createMotes } from './life';
import { clamp, lerp, riverHalf, riverX, smoothstep } from './math';
import { createRaft, createRipples, createTemple, templeBase } from './props';
import { createWater } from './water';

export type Tier = 'high' | 'low';
export type AnchorId = 'river' | 'danxia' | 'elephant' | 'zhengyi';
export type FrameState = { progress: number; pointerX: number; pointerY: number; time: number; motion: boolean };
export type SnapshotId = 'river' | 'danxia' | 'elephant' | 'zhengyi' | 'sunset';
/** `at` is chapter progress (0 = 山水 … 5 = 收藏, 6 = page end); `shift` is the horizontal lens shift. */
type Key = { at: number; pos: THREE.Vector3; target: THREE.Vector3; shift: number };

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const cx = riverX;

// World placements shared by props, camera keys and hotspots.
const RAFT = { z: 8, x: cx(8) + 3.5 };
const TEMPLE = (() => { const z = -84, x = cx(z) - riverHalf(z) - 15; return { x, z, y: templeBase(x, z) }; })();
const ELEPHANT = ROCKS[2];

function cameraKeys(): Key[] {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Guide view: aim left of the temple so it lands right of the text panel.
  const gp = v(cx(-52) + 1, 6.5, -52);
  const toTemple = Math.atan2(TEMPLE.x - gp.x, TEMPLE.z - gp.z) + 0.16;
  return [
    { at: 0, pos: v(cx(38) + 7.5, 7.6, 38), target: v(cx(-70) + 8, 9.2, -70), shift: 0.13 },
    { at: 1, pos: v(cx(8) - 2.6, 3.3, 8), target: v(cx(-45) + 3, 4.4, -45), shift: 0 },
    { at: 1.55, pos: v(cx(-24) - 3, 4.2, -24), target: v(ELEPHANT.x - 6, 9, ELEPHANT.z + 2), shift: 0 },
    { at: 2, pos: gp, target: v(gp.x + Math.sin(toTemple) * 40, 8, gp.z + Math.cos(toTemple) * 40), shift: 0.1 },
    // Hold on the temple while the 问道 panel is read, drifting gently forward.
    { at: 2.6, pos: v(gp.x - 1.2, gp.y + 0.8, gp.z - 5), target: v(gp.x + Math.sin(toTemple) * 40 - 1, 8.5, gp.z + Math.cos(toTemple) * 40 - 3), shift: 0.1 },
    { at: 3, pos: v(cx(-96), 18, -96), target: v(cx(-210) + 2, 17, -270), shift: 0 },
    { at: 4, pos: v(cx(-112) + 3, 24, -112), target: v(cx(-220) + 16, 20, -285), shift: 0 },
    { at: 5, pos: v(cx(-118) + 5, 28, -120), target: v(cx(-230) + 24, 23, -295), shift: 0 },
    { at: 6, pos: v(cx(-122) + 6, 31, -126), target: v(cx(-235) + 30, 25, -300), shift: 0 },
  ];
}

export class LandscapeScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.3, 1600);
  readonly shared: Shared = createShared();
  private keys = cameraKeys();
  private posCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.pos), false, 'centripetal');
  private targetCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.target), false, 'centripetal');
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private hemi = new THREE.HemisphereLight(0xcfd8d0, 0x2b3a2a, 1);
  private mood = { skyTop: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), dir: new THREE.Vector3() };
  private raft?: THREE.Object3D;
  private ripples?: THREE.Object3D;
  private brand?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private egrets?: ReturnType<typeof createEgrets>;
  private motes?: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private width = 1;
  private height = 1;
  private basePixelRatio = 1;
  private pixelRatio = 1;
  private slowFrames = 0;
  private lastFrame = 0;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private anchors: Record<AnchorId, { pos: THREE.Vector3; range: [number, number] }>;
  disposed = false;

  private constructor(canvas: HTMLCanvasElement, readonly tier: Tier) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', alpha: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false; // vertex-baked occlusion instead of shadow maps keeps draw cost flat
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, tier === 'high' ? 1.75 : 1.35);
    this.pixelRatio = this.basePixelRatio;
    this.scene.fog = new THREE.FogExp2(0xcfd3c8, 0.005);
    this.anchors = {
      river: { pos: new THREE.Vector3(RAFT.x, 3.4, RAFT.z), range: [-0.1, 0.9] },
      danxia: { pos: new THREE.Vector3(ROCKS[0].x - ROCKS[0].rx * 0.55, groundHeight(ROCKS[0].x, ROCKS[0].z) + ROCKS[0].h * 0.42, ROCKS[0].z + ROCKS[0].rz * 0.7), range: [-0.1, 1.2] },
      elephant: { pos: new THREE.Vector3(ELEPHANT.x - ELEPHANT.rx - 2, groundHeight(ELEPHANT.x, ELEPHANT.z) + ELEPHANT.h * 0.8, ELEPHANT.z + 4), range: [1.15, 1.8] },
      zhengyi: { pos: new THREE.Vector3(TEMPLE.x, TEMPLE.y + 11.5, TEMPLE.z), range: [1.8, 2.9] },
    };
  }

  static async create(canvas: HTMLCanvasElement, tier: Tier, onProgress: (value: number, label: string) => void, isCancelled: () => boolean) {
    const self = new LandscapeScene(canvas, tier);
    const step = async (value: number, label: string) => {
      onProgress(value, label);
      await nextFrame();
      if (isCancelled()) { self.dispose(); throw new DOMException('cancelled', 'AbortError'); }
    };
    try {
      await self.build(step);
    } catch (error) {
      if (!self.disposed) self.dispose();
      throw error;
    }
    return self;
  }

  private async build(step: (v: number, label: string) => Promise<void>) {
    const high = this.tier === 'high';
    const { scene, shared } = this;
    await step(0.06, '准备画布');
    const fontReady = loadDisplayFont();

    scene.add(this.hemi, this.sun, this.sun.target);
    const ground = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
    const props = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });

    await step(0.14, '铺陈山谷');
    scene.add(new THREE.Mesh(createTerrain(high ? 170 : 96, high ? 230 : 130), ground));

    await step(0.3, '堆叠丹霞');
    const rocks = createRocks(high ? 1 : 0.6);
    scene.add(new THREE.Mesh(rocks.geometry, ground));

    await step(0.42, '生长林木');
    scene.add(createForest(high ? 1500 : 650, rocks.tops, ground));
    scene.add(new THREE.Mesh(createBankRocks(high ? 120 : 60), ground));

    await step(0.52, '引入泸溪河');
    scene.add(createSky(shared));
    scene.add(createRidges(shared, [
      { z: -300, depth: 0.32, seed: 1.3, base: -10, amp: 70, color: '#3d4f3f' },
      { z: -360, depth: 0.5, seed: 4.1, base: -5, amp: 85, color: '#4f5e52' },
      { z: -430, depth: 0.66, seed: 7.7, base: 0, amp: 95, color: '#647063' },
      { z: -520, depth: 0.8, seed: 2.9, base: 5, amp: 110, color: '#7d8679' },
    ]));
    scene.add(createWater(shared));
    scene.add(createMist(shared, [
      { x: 10, y: 14, z: -125, w: 340, h: 34, opacity: 0.55, speed: 0.012 },
      { x: -30, y: 18, z: -175, w: 380, h: 42, opacity: 0.6, speed: 0.009 },
      { x: 20, y: 22, z: -250, w: 520, h: 54, opacity: 0.7, speed: 0.007 },
      { x: 30, y: 6, z: -58, w: 120, h: 16, opacity: 0.42, speed: 0.016 },
      ...(high ? [{ x: -40, y: 9, z: -92, w: 150, h: 20, opacity: 0.45, speed: 0.014 }] : []),
    ], high ? 0.42 : 0.32));

    await step(0.64, '种下竹林');
    // Hero foreground, placed relative to the first camera key so it frames the right edge of the shot.
    const k0 = this.keys[0].pos;
    const leaf = 0.62;
    const near: Clump[] = [
      { x: k0.x + 4.6, z: k0.z - 7.5, y: -0.6, lean: 0.2, dir: Math.PI * 1.02, stalks: high ? 5 : 3, height: 17, sprays: high ? 18 : 12, leaf, spread: 0.7 },
      { x: k0.x + 7.5, z: k0.z - 15, y: -0.6, lean: 0.12, dir: Math.PI, stalks: high ? 4 : 3, height: 18, sprays: high ? 16 : 11, leaf: leaf * 0.9, spread: 0.6 },
      { x: k0.x + 8.5, z: k0.z - 4, y: -0.6, lean: 0.72, dir: Math.PI * 1.06, stalks: 2, height: 15, sprays: high ? 20 : 14, leaf, spread: 0.3 },
      { x: cx(12) - riverHalf(12) - 1, z: 12, lean: 0.12, dir: 0.1, stalks: 5, height: 14, sprays: 12, leaf: 0.5 },
    ];
    const bamboo = createBamboo(shared, [...near, ...bankClumps(high ? 22 : 12)]);
    scene.add(bamboo.group);
    // Mossy boulder entering from the left edge of the hero shot, clear of the camera's descent.
    scene.add(createMossyBoulder(ground, new THREE.Vector3(k0.x - 11, 3.0, k0.z - 11), 2.2));

    await step(0.76, '放下竹筏');
    const raft = createRaft(props);
    raft.position.set(RAFT.x, 0, RAFT.z);
    // Bow heads downstream (−Z) with a slight diagonal so the raft reads in three-quarter view.
    raft.rotation.y = Math.atan2(cx(RAFT.z - 6) - cx(RAFT.z + 6), -12) + 0.45;
    this.raft = raft;
    const ripples = createRipples(shared);
    ripples.position.set(RAFT.x, 0.03, RAFT.z);
    ripples.rotation.z = raft.rotation.y + Math.PI;
    this.ripples = ripples;
    scene.add(raft, ripples);

    const temple = new THREE.Mesh(createTemple(), props);
    temple.position.set(TEMPLE.x, TEMPLE.y, TEMPLE.z);
    temple.rotation.y = Math.atan2(this.keys[3].pos.x - TEMPLE.x, this.keys[3].pos.z - TEMPLE.z) - 0.25;
    temple.scale.setScalar(0.9);
    scene.add(temple);

    const egretMat = new THREE.MeshStandardMaterial({ color: '#f4f1e8', emissive: '#77746a', roughness: 0.6, side: THREE.DoubleSide });
    this.egrets = createEgrets(egretMat, high ? 3 : 2);
    scene.add(this.egrets.group);
    this.motes = createMotes(shared, high ? 240 : 90);
    scene.add(this.motes);

    await step(0.84, '题写山名');
    await fontReady;
    this.brand = createBrandText(this.renderer.capabilities.getMaxAnisotropy());
    // Stand the lettering 70 units out, a little right of the hero's line of sight, between the raft and the cliffs.
    const aim = this.keys[0].target.clone().sub(k0).setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.14);
    this.brand.position.copy(k0).addScaledVector(aim, 70).setY(k0.y + 6.5);
    this.brand.scale.setScalar(0.58);
    this.brand.lookAt(k0.x, k0.y + 6.5, k0.z);
    scene.add(this.brand);

    await step(0.9, '编译光影');
    this.applyMood(0);
    this.placeCamera(0, 0, 0, 0);
    try { await this.renderer.compileAsync(scene, this.camera); } catch { this.renderer.compile(scene, this.camera); }
    await step(0.97, '第一帧');
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;
    // Keep enough horizontal field on portrait screens without fisheye distortion.
    this.camera.fov = aspect < 1 ? lerp(62, 50, clamp((aspect - 0.45) / 0.55)) : aspect < 1.4 ? 44 : 38;
    this.camera.updateProjectionMatrix();
    this.motes!.material.uniforms.uPixelRatio.value = this.pixelRatio;
  }

  private applyMood(progress: number) {
    const m = sampleMood(progress, this.mood);
    const s = this.shared;
    s.uSkyTop.value.copy(this.mood.skyTop);
    s.uHorizon.value.copy(this.mood.horizon);
    s.uFogColor.value.copy(this.mood.fog);
    s.uSunColor.value.copy(this.mood.sun);
    s.uSunDir.value.copy(this.mood.dir);
    s.uFogDensity.value = m.fogD;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(this.mood.fog); fog.density = m.fogD;
    this.sun.color.copy(this.mood.sun); this.sun.intensity = m.sunI;
    this.sun.position.copy(this.mood.dir).multiplyScalar(200).add(this.camera.position);
    this.sun.target.position.copy(this.camera.position);
    this.hemi.intensity = m.hemi;
    this.hemi.color.copy(this.mood.skyTop).lerp(this.mood.horizon, 0.5);
  }

  /** Camera rig: path sample + damped pointer parallax. Near objects shift visibly, far ridges barely. */
  private placeCamera(progress: number, px: number, py: number, time: number) {
    // Map chapter progress onto the curves' uniform index space via the keys' `at` stops.
    const keys = this.keys;
    let i = 0;
    while (i < keys.length - 2 && progress > keys[i + 1].at) i++;
    const local = clamp((progress - keys[i].at) / (keys[i + 1].at - keys[i].at));
    const t = (i + local) / (keys.length - 1);
    const pos = this.posCurve.getPoint(t, this.tmpA);
    const target = this.targetCurve.getPoint(t, this.tmpB);
    const keyShift = lerp(keys[i].shift, keys[i + 1].shift, smoothstep(0, 1, local));
    const portrait = this.width < this.height;
    if (portrait) pos.lerp(target, -0.06).y += 1.2;
    const forward = this.tmpC.subVectors(target, pos).normalize();
    const right = forward.cross(this.camera.up).normalize();
    const breathe = Math.sin(time * 0.16) * 0.12;
    pos.addScaledVector(right, px * 0.95 + breathe).y += -py * 0.45 + Math.sin(time * 0.21) * 0.06;
    target.addScaledVector(right, px * 0.25).y += -py * 0.12;
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    // Lens shift frames the scene beside text columns on wide screens; portrait keeps the subject low.
    const hero = 1 - smoothstep(0, 1, progress);
    const shiftX = portrait ? 0 : keyShift;
    const shiftY = portrait ? -0.12 * hero : 0;
    this.camera.setViewOffset(this.width, this.height, -shiftX * this.width, shiftY * this.height, this.width, this.height);
  }

  resetFrameClock() { this.lastFrame = 0; }

  update(state: FrameState) {
    const now = performance.now();
    if (this.lastFrame) this.trackPerformance(now - this.lastFrame);
    this.lastFrame = now;
    const { progress, time } = state;
    this.shared.uTime.value = time;
    this.shared.uWind.value = state.motion ? 1 : 0;
    this.placeCamera(progress, state.pointerX, state.pointerY, state.motion ? time : 0);
    this.applyMood(progress);
    if (this.raft) {
      this.raft.position.y = 0.04 + Math.sin(time * 1.1) * 0.05;
      this.raft.rotation.z = Math.sin(time * 0.9) * 0.018;
      this.raft.rotation.x = Math.sin(time * 0.7 + 1) * 0.012;
    }
    this.egrets?.update(time);
    if (this.brand) {
      const fade = 1 - smoothstep(0.08, 0.62, progress);
      this.brand.material.opacity = 0.9 * fade;
      this.brand.visible = fade > 0.001;
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Drop resolution step by step when frames are consistently slow; never raises it again mid-session. */
  private trackPerformance(delta: number) {
    if (delta > 100) return; // tab switch or breakpoint
    this.slowFrames = delta > 26 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90 && this.pixelRatio > 0.75) {
      this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25);
      this.slowFrames = 0;
      this.resize(this.width, this.height);
    }
  }

  /** Projects hotspot anchors to CSS pixels. Writes into `out` to avoid allocations per frame. */
  projectAnchors(progress: number, out: Record<AnchorId, { x: number; y: number; visible: boolean }>) {
    const v = this.tmpA;
    for (const id of Object.keys(this.anchors) as AnchorId[]) {
      const a = this.anchors[id];
      const target = out[id];
      if (id === 'river' && this.raft) a.pos.set(this.raft.position.x, this.raft.position.y + 3.4, this.raft.position.z);
      v.copy(a.pos).project(this.camera);
      const inRange = progress >= a.range[0] && progress <= a.range[1];
      target.x = (v.x * 0.5 + 0.5) * this.width;
      target.y = (-v.y * 0.5 + 0.5) * this.height;
      // Portrait chapters are covered by stacked cards, so mid-page hotspots would sit on text; keep only the hero ones.
      const allowed = this.width >= this.height || progress < 0.9;
      target.visible = allowed && inRange && v.z < 1 && Math.abs(v.x) < 0.92 && v.y > -0.85 && v.y < 0.88;
    }
  }

  /** Renders still images of named views for the content cards. Must run before the canvas is revealed. */
  async snapshots(ids: SnapshotId[], w: number, h: number) {
    const views: Record<SnapshotId, { pos: THREE.Vector3; target: THREE.Vector3; mood: number; time: number }> = {
      river: { pos: new THREE.Vector3(RAFT.x - 6.5, 3.2, RAFT.z + 10), target: new THREE.Vector3(RAFT.x + 3, 2.2, RAFT.z - 10), mood: 0.6, time: 4 },
      danxia: { pos: new THREE.Vector3(cx(-58) + 2, 4, -58), target: new THREE.Vector3(ROCKS[0].x - 4, 18, ROCKS[0].z), mood: 1.4, time: 9 },
      elephant: { pos: new THREE.Vector3(cx(-56) - 5, 6, -54), target: new THREE.Vector3(ELEPHANT.x - 6, 10, ELEPHANT.z - 2), mood: 1.6, time: 2 },
      zhengyi: { pos: new THREE.Vector3(TEMPLE.x + 26, TEMPLE.y + 8, TEMPLE.z + 22), target: new THREE.Vector3(TEMPLE.x, TEMPLE.y + 4, TEMPLE.z), mood: 2.8, time: 6 },
      sunset: { pos: new THREE.Vector3(cx(-100), 14, -100), target: new THREE.Vector3(cx(-200) + 20, 18, -260), mood: 5.6, time: 12 },
    };
    const { renderer, camera } = this;
    const savedRatio = this.pixelRatio;
    camera.clearViewOffset();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = 42; camera.updateProjectionMatrix();
    if (this.brand) this.brand.visible = false;
    const canvases: [SnapshotId, HTMLCanvasElement][] = [];
    for (const id of ids) {
      const view = views[id];
      camera.position.copy(view.pos);
      camera.lookAt(view.target);
      this.shared.uTime.value = view.time;
      this.applyMood(view.mood);
      renderer.render(this.scene, camera);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(renderer.domElement, 0, 0, w, h);
      canvases.push([id, c]);
    }
    this.pixelRatio = savedRatio;
    this.resize(this.width, this.height);
    const urls = {} as Record<SnapshotId, string>;
    await Promise.all(canvases.map(([id, c]) => new Promise<void>(resolve => c.toBlob(blob => { if (blob) urls[id] = URL.createObjectURL(blob); resolve(); }, 'image/jpeg', 0.86))));
    return urls;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const textures = new Set<THREE.Texture>();
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      }
      if ((obj as THREE.InstancedMesh).isInstancedMesh) (obj as THREE.InstancedMesh).dispose();
    });
    textures.forEach(t => t.dispose());
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
