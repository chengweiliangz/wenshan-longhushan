import { useEffect, useRef, useState } from 'react';
import type { BufferGeometry, Material, Object3D, PerspectiveCamera, Scene, Texture, WebGLRenderer, LoadingManager, DirectionalLight } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LandformStudy, StudyVec3 } from './landformStudies';

export type LandformStudyPose = { position: StudyVec3; target: StudyVec3 };
const validVector = (value: unknown): value is StudyVec3 => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));

/** Independent orbit viewer: retains the asset's local units and never loads geographic context. */
export function LandformStudyView({ study, pose, onPose }: { study: LandformStudy; pose?: LandformStudyPose; onPose?: (value: LandformStudyPose) => void }) {
  const host = useRef<HTMLDivElement>(null), save = useRef(onPose);
  save.current = onPose;
  const remembered = useRef(pose), poseKey = useRef(study.id + study.modelSrc);
  const api = useRef<{ zoom: (factor: number) => void; orbit: (yaw: number, pitch: number) => void; reset: () => void } | null>(null);
  const [attempt, setAttempt] = useState(0), [status, setStatus] = useState('载入山体查看器…'), [error, setError] = useState(false), [ready, setReady] = useState(false);
  const sourceHref = /^https?:\/\//i.test(study.source.trim()) ? study.source.trim() : undefined;

  useEffect(() => {
    if (poseKey.current !== study.id + study.modelSrc) {
      poseKey.current = study.id + study.modelSrc;
      remembered.current = pose;
    }
    let cancelled = false, disposed = false, loaded = false, raf = 0;
    let renderer: WebGLRenderer | null = null, scene: Scene | null = null, camera: PerspectiveCamera | null = null;
    let controls: OrbitControlsType | null = null, manager: LoadingManager | null = null, sun: DirectionalLight | null = null;
    let canvas: HTMLCanvasElement | null = null, resize: ResizeObserver | null = null, reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    const abort = new AbortController(), removeListeners: (() => void)[] = [];
    const roots = new Set<Object3D>(), materials = new Set<Material>(), textures = new Set<Texture>();
    const releasedGeometries = new Set<BufferGeometry>(), releasedMaterials = new Set<Material>(), releasedTextures = new Set<Texture>(), closedBitmaps = new Set<ImageBitmap>();
    let releaseResources = (_objects: Object3D[]) => {};
    let timeout: ReturnType<typeof setTimeout>;

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      abort.abort();
      manager?.abort();
      if (reader) void reader.cancel().catch(() => {});
      if (loaded && camera && controls) {
        const value: LandformStudyPose = { position: camera.position.toArray(), target: controls.target.toArray() };
        remembered.current = value;
        save.current?.(value);
      }
      cancelAnimationFrame(raf);
      resize?.disconnect();
      removeListeners.forEach(remove => remove());
      controls?.dispose();
      api.current = null;
      releaseResources(scene ? [scene] : []);
      sun?.shadow.dispose();
      renderer?.dispose();
      if (canvas) Object.assign(canvas.dataset, { ready: 'false', disposed: 'true', controlsDisposed: 'true' });
      if (renderer && !renderer.getContext().isContextLost()) renderer.forceContextLoss();
      canvas?.remove();
      roots.clear();
    };
    const fail = (message: string) => {
      if (cancelled || disposed) return;
      setReady(false);
      setError(true);
      setStatus(message);
      dispose();
    };
    timeout = setTimeout(() => fail('山体模型载入超时，可重试或查看实拍照片。'), 30000);
    setReady(false);
    setError(false);
    setStatus('载入山体查看器…');

    void (async () => {
      const [T, { GLTFLoader }, { OrbitControls }] = await Promise.all([
        import('three'), import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/controls/OrbitControls.js')
      ]);
      if (cancelled || disposed) return;
      releaseResources = objects => {
        for (const object of [...roots, ...objects]) object.traverse(child => {
          const mesh = child as import('three').Mesh;
          if (mesh.geometry && !releasedGeometries.has(mesh.geometry)) {
            releasedGeometries.add(mesh.geometry);
            mesh.geometry.dispose();
          }
          for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) materials.add(material);
        });
        for (const material of materials) {
          for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
          if (!releasedMaterials.has(material)) { releasedMaterials.add(material); material.dispose(); }
        }
        for (const texture of textures) {
          if (!releasedTextures.has(texture)) { releasedTextures.add(texture); texture.dispose(); }
          for (const bitmap of Array.isArray(texture.image) ? texture.image : [texture.image]) {
            if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap && !closedBitmaps.has(bitmap)) {
              closedBitmaps.add(bitmap);
              bitmap.close();
            }
          }
        }
        if (canvas) canvas.dataset.released = JSON.stringify({ geometries: releasedGeometries.size, materials: releasedMaterials.size, textures: releasedTextures.size, bitmaps: closedBitmaps.size });
      };
      const node = host.current!;
      renderer = new T.WebGLRenderer({ antialias: true });
      const view = renderer;
      view.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      view.outputColorSpace = T.SRGBColorSpace;
      view.toneMapping = T.NeutralToneMapping;
      view.shadowMap.enabled = true;
      view.shadowMap.type = T.PCFShadowMap;
      view.shadowMap.autoUpdate = false;
      scene = new T.Scene();
      const world = scene;
      world.background = new T.Color('#e1e7e1');
      camera = new T.PerspectiveCamera(45, 1, .01, 100);
      const lens = camera;
      canvas = view.domElement;
      const element = canvas;
      node.append(element);
      element.tabIndex = 0;
      element.setAttribute('role', 'region');
      element.setAttribute('aria-label', study.label + '：拖动或方向键观察，双指或加减号缩放，Home恢复全貌');
      Object.assign(element.dataset, { study: study.id, georeferenced: 'false', ready: 'false' });
      controls = new OrbitControls(lens, element);
      const orbitControls = controls;
      orbitControls.enableDamping = false;
      orbitControls.autoRotate = false;
      orbitControls.enablePan = false;
      orbitControls.minPolarAngle = .04;
      orbitControls.maxPolarAngle = Math.PI * .49;
      world.add(new T.HemisphereLight('#f3f6ff', '#727461', 2));
      sun = new T.DirectionalLight('#fff4df', 2.4);
      const light = sun;
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -.0002;
      world.add(light, light.target);
      let fitView = () => {}, interacted = false;
      const render = () => {
        raf = 0;
        if (cancelled || disposed || document.hidden) return;
        try { view.render(world, lens); }
        catch (cause) { console.error('山体画面绘制失败', cause); fail('三维画面暂不可用，可重试恢复山体观察。'); return; }
        Object.assign(element.dataset, {
          camera: lens.position.toArray().join(','), target: orbitControls.target.toArray().join(','),
          triangles: String(view.info.render.triangles), drawCalls: String(view.info.render.calls)
        });
      };
      const requestRender = () => { if (!cancelled && !disposed && !raf && !document.hidden) raf = requestAnimationFrame(render); };
      const markInteraction = () => { interacted = true; };
      orbitControls.addEventListener('change', requestRender);
      orbitControls.addEventListener('start', markInteraction);
      removeListeners.push(() => {
        orbitControls.removeEventListener('change', requestRender);
        orbitControls.removeEventListener('start', markInteraction);
      });
      const onVisibility = () => { if (!document.hidden) requestRender(); };
      document.addEventListener('visibilitychange', onVisibility);
      removeListeners.push(() => document.removeEventListener('visibilitychange', onVisibility));
      const onLost = (event: Event) => {
        event.preventDefault();
        fail('三维画面已中断，可重试恢复山体观察。');
      };
      element.addEventListener('webglcontextlost', onLost);
      removeListeners.push(() => element.removeEventListener('webglcontextlost', onLost));
      const updateSize = () => {
        if (disposed) return;
        const rect = node.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
        view.setSize(width, height, false);
        lens.aspect = width / height;
        lens.updateProjectionMatrix();
        if (loaded && !interacted) fitView();
        requestRender();
      };
      resize = new ResizeObserver(updateSize);
      resize.observe(node);
      updateSize();
      const zoom = (factor: number) => {
        if (!loaded) return;
        interacted = true;
        const offset = lens.position.clone().sub(orbitControls.target);
        offset.setLength(T.MathUtils.clamp(offset.length() * factor, orbitControls.minDistance, orbitControls.maxDistance));
        lens.position.copy(orbitControls.target).add(offset);
        orbitControls.update();
        requestRender();
      };
      const orbit = (yaw: number, pitch: number) => {
        if (!loaded) return;
        interacted = true;
        const spherical = new T.Spherical().setFromVector3(lens.position.clone().sub(orbitControls.target));
        spherical.theta += yaw;
        spherical.phi = T.MathUtils.clamp(spherical.phi + pitch, orbitControls.minPolarAngle, orbitControls.maxPolarAngle);
        lens.position.copy(orbitControls.target).add(new T.Vector3().setFromSpherical(spherical));
        orbitControls.update();
        requestRender();
      };
      const reset = () => { if (loaded) { interacted = false; fitView(); requestRender(); } };
      api.current = { zoom, orbit, reset };
      const onKey = (event: KeyboardEvent) => {
        if (['+','=', '-', '_', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'Home') reset();
          else if (['+', '=', '-', '_'].includes(event.key)) zoom(event.key === '-' || event.key === '_' ? 1.15 : 1 / 1.15);
          else orbit(event.key === 'ArrowLeft' ? .15 : event.key === 'ArrowRight' ? -.15 : 0, event.key === 'ArrowUp' ? -.1 : event.key === 'ArrowDown' ? .1 : 0);
        }
      };
      element.addEventListener('keydown', onKey);
      const onPointer = () => element.focus({ preventScroll: true });
      element.addEventListener('pointerdown', onPointer);
      removeListeners.push(() => { element.removeEventListener('keydown', onKey); element.removeEventListener('pointerdown', onPointer); });

      manager = new T.LoadingManager();
      const loader = new GLTFLoader(manager);
      // Track completed dependencies even if another dependency rejects or parsing finishes after disposal.
      loader.register(parser => {
        const dependency = parser.getDependency.bind(parser);
        parser.getDependency = (kind, index) => dependency(kind, index).then(value => {
          if (kind === 'texture' && value instanceof T.Texture) textures.add(value);
          if (kind === 'material' && value instanceof T.Material) materials.add(value);
          if (kind === 'mesh' && value instanceof T.Object3D) roots.add(value);
          if (disposed) releaseResources([]);
          return value;
        });
        return { name: 'LandformStudyResourceTracker' };
      });
      setStatus('载入山体模型…');
      const response = await fetch(study.modelSrc, { signal: abort.signal });
      if (!response.ok) throw new Error('Landform HTTP ' + response.status);
      const total = Number(response.headers.get('content-length')), chunks: Uint8Array[] = [];
      let size = 0, lastProgress = 0;
      reader = response.body?.getReader() ?? null;
      let buffer: ArrayBuffer;
      if (reader) {
        try {
          while (true) {
            const item = await reader.read();
            if (item.done) break;
            chunks.push(item.value);
            size += item.value.length;
            const now = performance.now();
            if (!cancelled && !disposed && now - lastProgress > 80) {
              setStatus(total > 0 ? '山体模型 ' + Math.min(100, Math.round(size / total * 100)) + '%' : '正在读取山体模型…');
              lastProgress = now;
            }
          }
        } finally { reader.releaseLock(); reader = null; }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
      } else buffer = await response.arrayBuffer();
      if (cancelled || disposed) return;
      setStatus('正在解析山体模型…');
      const result = await loader.parseAsync(buffer, new URL('.', new URL(study.modelSrc, location.href)).href);
      result.scenes.forEach(object => roots.add(object));
      if (cancelled || disposed) { releaseResources([]); return; }
      const model = result.scene;
      const bounds = new T.Box3().setFromObject(model);
      if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) throw new Error('Invalid landform bounds');
      const sphere = bounds.getBoundingSphere(new T.Sphere());
      if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error('Invalid landform radius');
      const radius = Math.max(sphere.radius, .001);
      const target = validVector(study.target) ? new T.Vector3().fromArray(study.target) : sphere.center.clone();
      const direction = validVector(study.camera) ? new T.Vector3().fromArray(study.camera).sub(target) : new T.Vector3(1, .65, 1);
      const declaredDistance = validVector(study.camera) ? direction.length() : 0;
      if (direction.lengthSq() < 1e-12) direction.set(1, .65, 1);
      direction.normalize();
      lens.near = radius / 1000;
      lens.far = radius * 100 + sphere.center.distanceTo(target) + declaredDistance;
      lens.updateProjectionMatrix();
      orbitControls.minDistance = radius * .12;
      fitView = () => {
        const halfVertical = T.MathUtils.degToRad(lens.fov) / 2;
        // Fit the complete model, including foliage, in the actual camera direction.
        // Bounding-sphere fitting left excessive space around this broad, low formation.
        const right = new T.Vector3(0, 1, 0).cross(direction);
        if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
        right.normalize();
        const up = direction.clone().cross(right).normalize();
        const tanVertical = Math.tan(halfVertical), tanHorizontal = tanVertical * lens.aspect;
        const framedExtent = .76; // At least 12% margin at each edge of the limiting axis.
        let distance = orbitControls.minDistance;
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
              const corner = new T.Vector3(x, y, z).sub(target), depth = corner.dot(direction);
              distance = Math.max(distance, depth + lens.near * 2,
                depth + Math.abs(corner.dot(right)) / (tanHorizontal * framedExtent),
                depth + Math.abs(corner.dot(up)) / (tanVertical * framedExtent));
            }
        orbitControls.maxDistance = Math.max(radius * 12, distance * 3);
        lens.far = Math.max(radius * 100, orbitControls.maxDistance + sphere.center.distanceTo(target) + radius * 2);
        lens.updateProjectionMatrix();
        orbitControls.target.copy(target);
        lens.position.copy(target).addScaledVector(direction, distance);
        orbitControls.update();
      };
      model.traverse(child => {
        const mesh = child as import('three').Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          for (const value of Object.values(material)) if (value instanceof T.Texture) value.anisotropy = Math.min(4, view.capabilities.getMaxAnisotropy());
      });
      world.add(model);
      const floor = new T.Mesh(new T.PlaneGeometry(radius * 6, radius * 6), new T.ShadowMaterial({ opacity: .14 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(sphere.center.x, bounds.min.y - radius * .005, sphere.center.z);
      floor.receiveShadow = true;
      world.add(floor);
      light.target.position.copy(sphere.center);
      light.position.copy(sphere.center).add(new T.Vector3(-radius * 2, radius * 3, radius * 2));
      Object.assign(light.shadow.camera, { left: -radius * 1.6, right: radius * 1.6, top: radius * 1.6, bottom: -radius * 1.6, near: radius * .01, far: radius * 8 });
      light.shadow.normalBias = .75 * (light.shadow.camera.right - light.shadow.camera.left) / light.shadow.mapSize.width;
      light.shadow.camera.updateProjectionMatrix();
      view.shadowMap.needsUpdate = true;
      fitView();
      const resume = remembered.current;
      if (resume && validVector(resume.position) && validVector(resume.target) && new T.Vector3().fromArray(resume.position).distanceTo(new T.Vector3().fromArray(resume.target)) > radius * .01) {
        lens.position.fromArray(resume.position);
        orbitControls.target.fromArray(resume.target);
        orbitControls.update();
        interacted = true;
      }
      loaded = true;
      Object.assign(element.dataset, { ready: 'true', bounds: [...bounds.min.toArray(), ...bounds.max.toArray()].join(',') });
      clearTimeout(timeout);
      setStatus('');
      setReady(true);
      requestRender();
    })().catch(cause => {
      if (cancelled || disposed) return;
      console.error('山体查看器载入失败', cause);
      fail('山体模型载入失败，可重试或查看实拍照片。');
    });
    return () => { cancelled = true; dispose(); };
  }, [study, attempt]);

  return <section aria-label={study.label + ' · 独立山体观察窗'}>
    <p className="visit-note"><strong>照片参考 · 局部艺术化补全；未定标定位</strong></p>
    <p className="visit-note">{study.notice}</p>
    <p className="visit-note">{sourceHref ? <a className="route-source" href={sourceHref} target="_blank" rel="noreferrer">{study.sourceLabel || '查看模型参考来源'} ↗</a> : (study.sourceLabel || '模型参考来源待补充')}</p>
    <div className="model-view">
      <div className="model-host" ref={host} />
      {status && <div className="model-status" role="status" style={{ flexWrap: 'wrap', padding: 20 }}>{status}{error && <button onClick={() => setAttempt(value => value + 1)}>重试山体模型</button>}</div>}
    </div>
    <div className="visit-mode" role="group" aria-label="山体观察操作" style={{ marginTop: 12 }}>
      <button disabled={!ready} aria-label="向左观察山体" onClick={() => api.current?.orbit(.15, 0)}>←</button>
      <button disabled={!ready} aria-label="向右观察山体" onClick={() => api.current?.orbit(-.15, 0)}>→</button>
      <button disabled={!ready} aria-label="抬高山体观察视角" onClick={() => api.current?.orbit(0, -.1)}>↑</button>
      <button disabled={!ready} aria-label="降低山体观察视角" onClick={() => api.current?.orbit(0, .1)}>↓</button>
      <button disabled={!ready} aria-label="放大山体模型" onClick={() => api.current?.zoom(1 / 1.15)}>＋</button>
      <button disabled={!ready} aria-label="缩小山体模型" onClick={() => api.current?.zoom(1.15)}>－</button>
      <button disabled={!ready} onClick={() => api.current?.reset()}>恢复全貌</button>
    </div>
    <p className="visit-note">拖动或方向键观察 · 双指、滚轮或加减号缩放 · Home恢复全貌</p>
  </section>;
}
