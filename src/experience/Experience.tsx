import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Compass, Map, MousePointer2, Pause, Play, RotateCcw, Settings2, Waves, X } from 'lucide-react';
import { DEFAULT_WATER } from '../../shared/water-settings.mjs';
import { Director } from './director';
import { attachExplorationInput } from './explorationInput';
import type { RaftRideSnapshot } from '../scene/raftRide';
import './raftRide.css';
import './tourExperience.css';
import { useTourSession, getTourSession, setTourReady, selectTourStation, returnTourHome, isTourStation, TOUR_STATIONS, TOUR_NAMES, setTourExploring, setTourCardsCollapsed } from './tourSession';
import type { AnchorId, SnapshotId, Tier } from '../scene/LandscapeScene';

export type SceneViews = Partial<Record<SnapshotId, string>>;
type Stage = 'loading' | 'ready' | 'static';
type Props = {
  chapterIds: string[];
  onChapter: (index: number) => void;
  paused: boolean;
  onSpot: (spotId: string, trigger: HTMLElement) => void;
};
type MoveDirection = 'forward' | 'backward' | 'left' | 'right';
type ExplorePose = { position: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } };
type ExploreMapData = {
  id: string;
  label: string;
  mapBoundsXZ: { minX: number; maxX: number; minZ: number; maxZ: number };
  support?: { polygonXZ: [number, number][] };
  entrance?: [number, number, number];
  landing?: { landPath: [number, number, number][] };
  position?: ExplorePose['position'];
  direction?: ExplorePose['direction'];
};
type MiniMapSnapshot = { layout: ExploreMapData; pose: ExplorePose | null };
const routeShortNames: Record<string, string> = { river: '泸溪河', zhengyi: '正一观', tianshi: '天师府', shangqing: '大上清宫' };
const moveButtons = [
  { direction: 'forward', label: '向前走', Icon: ArrowUp },
  { direction: 'left', label: '向左走', Icon: ArrowLeft },
  { direction: 'backward', label: '向后走', Icon: ArrowDown },
  { direction: 'right', label: '向右走', Icon: ArrowRight },
] as const;

export const HOTSPOTS: { id: AnchorId; spotId: string; label: string; hint: string }[] = [
  { id: 'river', spotId: 'river', label: '泸溪河 · 竹筏', hint: '一筏碧水' },
  { id: 'elephant', spotId: 'elephant', label: '象鼻山观景台', hint: '地点资料' },
  { id: 'tianshi', spotId: 'tianshi', label: '嗣汉天师府', hint: '沿岸场景' },
  { id: 'shangqing', spotId: 'shangqing', label: '大上清宫', hint: '遗址与保护展示' },
  { id: 'zhengyi', spotId: 'zhengyi', label: '正一观', hint: '沿岸场景' },
];

function detectTier(): Tier {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'high' || forced === 'low') return forced;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return coarse || window.innerWidth < 760 || cores < 4 || memory < 4 ? 'low' : 'high';
}

function webgl2Available() {
  if (new URLSearchParams(location.search).has('static')) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch { return false; }
}

function readExploreMap(canvas: HTMLCanvasElement, pose: ExplorePose | null): MiniMapSnapshot | null {
  try {
    const raw = canvas.dataset.exploreMap;
    if (!raw) return null;
    const layout = JSON.parse(raw) as ExploreMapData;
    const bounds = layout.mapBoundsXZ;
    if (!bounds || ![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite) || bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) return null;
    return { layout, pose: pose || (layout.position && layout.direction ? { position: layout.position, direction: layout.direction } : null) };
  } catch { return null; }
}

function ExploreMiniMap({ snapshot }: { snapshot: MiniMapSnapshot }) {
  const { layout, pose } = snapshot;
  const bounds = layout.mapBoundsXZ;
  const scale = Math.min(176 / (bounds.maxX - bounds.minX), 106 / (bounds.maxZ - bounds.minZ));
  const left = 12 + (176 - (bounds.maxX - bounds.minX) * scale) / 2;
  const top = 12 + (106 - (bounds.maxZ - bounds.minZ) * scale) / 2;
  const point = (x: number, z: number) => [left + (x - bounds.minX) * scale, top + (z - bounds.minZ) * scale];
  const polygon = (layout.support?.polygonXZ || []).map(([x, z]) => point(x, z).join(',')).join(' ');
  const path = (layout.landing?.landPath || []).map(([x, , z]) => point(x, z).join(',')).join(' ');
  const entrance = layout.entrance ? point(layout.entrance[0], layout.entrance[2]) : null;
  const camera = pose ? point(pose.position.x, pose.position.z) : null;
  const bearing = pose ? Math.atan2(pose.direction.x, -pose.direction.z) * 180 / Math.PI : 0;
  return <aside className="tour-mini-map" aria-label={layout.label + '局部场景示意'}>
    <div><Map size={12} /><strong>{layout.label || '沿岸'} · 场景示意</strong></div>
    <svg viewBox="0 0 200 134" role="img" aria-label="当前位置、步行区域与入口">
      <rect x="1" y="1" width="198" height="132" rx="8" fill="#d9e4d5" />
      {polygon && <polygon points={polygon} fill="#a8c298" stroke="#6f9561" strokeWidth="1.5" />}
      {path && <polyline points={path} fill="none" stroke="#ad8256" strokeWidth="3" strokeDasharray="4 3" />}
      {entrance && <g><circle cx={entrance[0]} cy={entrance[1]} r="4" fill="#fcf8eb" stroke="#a45237" strokeWidth="2" /><text x={entrance[0] + 6} y={entrance[1] + 3} fontSize="9" fill="#6b4932">入口</text></g>}
      {camera && <g transform={'translate(' + camera[0] + ' ' + camera[1] + ') rotate(' + bearing + ')'}><circle r="8" fill="#fff9e8" fillOpacity=".75" /><path d="M 0 -7 L 4 5 L 0 3 L -4 5 Z" fill="#284f3b" /></g>}
    </svg>
    <small>沿岸布局与内部空间为艺术化展示，非实地导航或考据复原</small>
  </aside>;
}

/** One canvas, one input adapter and the root-owned session govern all scene movement. */
export function Experience({ chapterIds, onChapter, paused, onSpot }: Props) {
  const tour = useTourSession();
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hotspotEls = useRef<Partial<Record<AnchorId, HTMLButtonElement>>>({});
  const callbacks = useRef({ onChapter, onSpot, paused });
  callbacks.current = { onChapter, onSpot, paused };
  const directorRef = useRef<Director | null>(null);
  const inputRef = useRef<ReturnType<typeof attachExplorationInput> | null>(null);
  const uiDirections = useRef(new globalThis.Map<string, MoveDirection>());
  const [pressedDirections, setPressedDirections] = useState<MoveDirection[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showExploreHelp, setShowExploreHelp] = useState(false);
  const exploreHelpShown = useRef(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [sensitivity, setSensitivity] = useState(1);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const [miniMapEnabled, setMiniMapEnabled] = useState(true);
  const [miniMap, setMiniMap] = useState<MiniMapSnapshot | null>(null);
  const [water, setWater] = useState(DEFAULT_WATER);
  const [waterStopped, setWaterStopped] = useState(false);
  const [rideState, setRideState] = useState<RaftRideSnapshot | null>(null);
  const [reduce, setReduce] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>('loading');
  const [load, setLoad] = useState({ value: 0.02, label: '载入三维引擎' });
  const waterRef = useRef(water);
  waterRef.current = { ...water, speed: waterStopped ? 0 : water.speed };
  const canExplore = tour.ready && !paused && tour.phase === 'arrived' && tour.station === tour.targetStation && (['zhengyi', 'tianshi', 'shangqing'].includes(tour.station));
  const exploreReason = !tour.ready ? '三维场景就绪后可探索' : !['zhengyi', 'tianshi', 'shangqing'].includes(tour.station) ? '此站支持背景环视；三处宫观均可步行探索' : tour.phase !== 'arrived' ? '抵达此站后可步行探索' : '走上沿岸台地，近看宫观';

  function clearDirectionPad() {
    uiDirections.current.clear();
    setPressedDirections([]);
    inputRef.current?.clearUIInput();
  }
  function updateDirectionPad() {
    const held = new Set(uiDirections.current.values());
    setPressedDirections(Array.from(held));
    inputRef.current?.setUIInput(Number(held.has('forward')) - Number(held.has('backward')), Number(held.has('right')) - Number(held.has('left')));
  }
  function directionPointerDown(event: ReactPointerEvent<HTMLButtonElement>, direction: MoveDirection) {
    if (paused || !tour.exploring || !tour.ready || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    uiDirections.current.set('pointer-' + event.pointerId, direction);
    updateDirectionPad();
  }
  function directionPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    uiDirections.current.delete('pointer-' + event.pointerId);
    updateDirectionPad();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function directionKey(event: ReactKeyboardEvent<HTMLButtonElement>, direction: MoveDirection, down: boolean) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (down && !paused && tour.exploring && tour.ready) uiDirections.current.set('key-' + direction, direction);
    else uiDirections.current.delete('key-' + direction);
    updateDirectionPad();
  }
  function exitOwnedPointerLock() {
    if (document.pointerLockElement === canvasRef.current) document.exitPointerLock();
  }
  function requestScenePointerLock() {
    if (matchMedia('(pointer: coarse)').matches) return;
    void inputRef.current?.requestPointerLock();
  }
  function toggleExploration() {
    if (paused || (!tour.exploring && !canExplore)) return;
    clearDirectionPad();
    inputRef.current?.clearInput();
    const next = !getTourSession().exploring;
    setTourExploring(next);
    setTourCardsCollapsed(next);
    inputRef.current?.refreshEnabled();
    if (next) requestScenePointerLock();
    else exitOwnedPointerLock();
  }

  useEffect(() => {
    if (tour.mode !== 'tour' || !tour.exploring || exploreHelpShown.current) return;
    exploreHelpShown.current = true;
    setShowExploreHelp(true);
    const timer = window.setTimeout(() => setShowExploreHelp(false), 7000);
    return () => { window.clearTimeout(timer); setShowExploreHelp(false); };
  }, [tour.mode, tour.exploring]);
  useEffect(() => { directorRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { directorRef.current?.configureWater({ ...water, speed: waterStopped ? 0 : water.speed }); }, [water, waterStopped]);
  useEffect(() => { if (directorRef.current) directorRef.current.reducedMotion = reduce; }, [reduce]);
  useEffect(() => {
    inputRef.current?.refreshEnabled();
    if (paused || tour.mode !== 'tour' || !tour.ready || !tour.exploring) clearDirectionPad();
    if (!tour.exploring) exitOwnedPointerLock();
    if (paused || tour.mode !== 'tour' || !tour.ready) {
      inputRef.current?.clearInput();
      exitOwnedPointerLock();
      setSettingsOpen(false);
    }
  }, [paused, tour.mode, tour.ready, tour.exploring]);
  useEffect(() => {
    const clear = () => { clearDirectionPad(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { clearDirectionPad(); setSettingsOpen(false); } };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => {
    if (tour.mode !== 'tour' || !tour.exploring || !miniMapEnabled) { setMiniMap(null); return; }
    const read = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pose = directorRef.current?.getExploreState() || null;
      setMiniMap(readExploreMap(canvas, pose));
    };
    read();
    const timer = window.setInterval(read, 200);
    return () => window.clearInterval(timer);
  }, [tour.mode, tour.exploring, miniMapEnabled]);

  useEffect(() => {
    setStage('loading'); setTourReady(false);
    const stageEl = stageRef.current!, host = hostRef.current!;
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const director = new Director({
      getSections: () => chapterIds.map(id => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el)),
      onChapter: index => callbacks.current.onChapter(index),
      onRaftState: setRideState,
      reducedMotion: motionQuery.matches,
    });
    const onMotion = () => { director.reducedMotion = motionQuery.matches; setReduce(motionQuery.matches); };
    motionQuery.addEventListener('change', onMotion);
    directorRef.current = director;
    director.setPaused(paused);
    director.start(stageEl);
    (Object.entries(hotspotEls.current) as [AnchorId, HTMLButtonElement][]).forEach(([id, el]) => director.registerHotspot(id, el));
    let cancelled = false;
    let scene: import('../scene/LandscapeScene').LandscapeScene | null = null;
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-gl';
    canvasRef.current = canvas;
    const canLook = () => {
      const current = getTourSession();
      return current.mode === 'tour' && current.ready && !callbacks.current.paused && !document.hidden;
    };
    const input = attachExplorationInput({
      canvas,
      controller: {
        setInput: (forward, right, fast) => director.setExploreInput(forward, right, fast),
        clearInput: () => director.setExploreInput(0, 0, false),
        look: (yaw, pitch) => { if (getTourSession().exploring) director.lookExplore(yaw, pitch); else director.lookRaft(yaw, pitch); },
      },
      canLook,
      canMove: () => canLook() && getTourSession().exploring,
      getSensitivity: () => .0025 * sensitivityRef.current,
      pointerLockOnCanvasClick: true,
      onPointerLockChange: locked => { setPointerLocked(locked); clearDirectionPad(); },

    });
    inputRef.current = input;
    const onLost = (event: Event) => {
      event.preventDefault();
      input.clearInput();
      exitOwnedPointerLock();
      director.detachScene();
      setStage('static'); setTourReady(false, true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    if (!webgl2Available()) { setStage('static'); setTourReady(false, true); }
    else {
      host.appendChild(canvas);
      import('../scene/LandscapeScene').then(async ({ LandscapeScene }) => {
        if (cancelled) return;
        scene = await LandscapeScene.create(canvas, detectTier(), (value, label) => setLoad({ value, label }), () => cancelled);
        scene.resize(stageEl.clientWidth, stageEl.clientHeight);
        if (cancelled) return;
        director.attachScene(scene);
        director.configureWater(waterRef.current);
        setLoad({ value: 1, label: '区域地形已就绪' });
        setStage('ready'); setTourReady(true);
        input.refreshEnabled();
      }).catch(error => {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        console.warn('三维场景不可用，已切换为静态山水。', error);
        input.clearInput();
        director.detachScene();
        scene?.dispose();
        setStage('static'); setTourReady(false, true);
      });
    }
    return () => {
      cancelled = true;
      motionQuery.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onLost);
      input.dispose();
      if (inputRef.current === input) inputRef.current = null;
      director.dispose();
      scene?.dispose();
      canvas.remove();
      if (canvasRef.current === canvas) canvasRef.current = null;
      directorRef.current = null;
    };
  }, [attempt]);

  const statusText = tour.fallback ? '实拍资料模式 · 三维暂不可用'
    : !tour.ready ? '正在准备河面…'
    : tour.exploring ? tour.status + (pointerLocked ? ' · Esc释放' : '')
    : rideState?.userPaused ? '竹筏已暂停'
    : reduce ? '减少动态 · 切换站点前往'
    : tour.status;

  return <>
    <div className={'stage is-' + stage + ' mode-' + tour.mode + (tour.exploring ? ' is-exploring' : '')} ref={stageRef} aria-hidden="true">
      <div className="stage-poster" /><div className="stage-host" ref={hostRef} /><div className="stage-veil" /><div className="tour-region-veil" />
    </div>
    {tour.mode === 'tour' && <>
      <div className="tour-source-note">沿岸布局与内部空间为艺术化展示，非实地导航或考据复原</div>
      {showExploreHelp && tour.exploring && tour.cardsCollapsed && <div className="tour-explore-help"><Compass size={14} /><span>电脑 WASD / 方向键走动<br />背景环视 · Esc 释放鼠标</span></div>}
      {tour.exploring && tour.cardsCollapsed && miniMapEnabled && miniMap && <ExploreMiniMap snapshot={miniMap} />}
      {tour.exploring && tour.ready && <div className={'tour-movement-pad' + (!tour.cardsCollapsed ? ' is-card-visible' : '')} role="group" aria-label="自由探索方向控制">
        <small>按住方向走动</small><span className="tour-movement-center">走动</span>
        {moveButtons.map(({ direction, label, Icon }) => <button key={direction} type="button" className={'move-' + direction} data-explore-move={direction} aria-label={label} aria-pressed={pressedDirections.includes(direction)} disabled={paused}
          onPointerDown={event => directionPointerDown(event, direction)} onPointerUp={directionPointerEnd} onPointerCancel={directionPointerEnd} onLostPointerCapture={directionPointerEnd}
          onKeyDown={event => directionKey(event, direction, true)} onKeyUp={event => directionKey(event, direction, false)} onBlur={() => { uiDirections.current.delete('key-' + direction); updateDirectionPad(); }}><Icon size={19} /></button>)}
      </div>}
      <div className="tour-controls" aria-label={tour.exploring ? '自由探索控制' : '竹筏游览控制'}>
        <div className="tour-controls-heading"><span role="status" aria-live="polite">{statusText}</span><button data-tour-action="home" onClick={returnTourHome} disabled={paused}>返回首页</button></div>
        <nav aria-label="四站游览路线">{TOUR_STATIONS.map((id, index) => <button key={id} data-tour-destination={id} aria-current={tour.targetStation === id ? 'step' : undefined} onClick={() => selectTourStation(id)} disabled={paused}><small>0{index + 1}</small><span>{routeShortNames[id] || TOUR_NAMES[id]}</span></button>)}</nav>
        <div className="tour-controls-actions">
          {tour.exploring ? <button data-explore-action="lock" disabled={paused || !tour.ready} onClick={requestScenePointerLock} className="tour-lock-button"><MousePointer2 size={14} />{pointerLocked ? '鼠标已锁定' : '锁定鼠标'}</button>
            : <button data-raft-action="pause" aria-pressed={rideState?.userPaused ?? false} disabled={paused || !tour.ready} onClick={() => directorRef.current?.toggleRaftPaused()}>{rideState?.userPaused ? <Play size={14} /> : <Pause size={14} />}{rideState?.userPaused ? '继续' : '暂停'}</button>}
          <button data-explore-action={tour.exploring ? 'return' : 'enter'} className="tour-explore-toggle" disabled={paused || (!tour.exploring && !canExplore)} title={tour.exploring ? '返回已保存的竹筏视角' : exploreReason} onClick={toggleExploration}>{tour.exploring ? <Waves size={14} /> : <Compass size={14} />}{tour.exploring ? '回到竹筏' : '自由探索'}</button>
          <button data-tour-action="cards" aria-expanded={!tour.cardsCollapsed} disabled={paused} onClick={() => setTourCardsCollapsed(!tour.cardsCollapsed)}><BookOpen size={14} />{tour.cardsCollapsed ? '展开卡片' : '收起卡片'}</button>
          <button data-tour-action="settings" aria-expanded={settingsOpen} aria-controls="tour-settings-panel" disabled={paused} onClick={() => setSettingsOpen(value => !value)}><Settings2 size={14} />设置</button>
        </div>
        {!tour.exploring && !canExplore && tour.ready && <p className="tour-explore-availability">{exploreReason}</p>}
        {settingsOpen && <div className="tour-settings-panel" id="tour-settings-panel" role="dialog" aria-label="画面与探索设置">
          <div className="tour-settings-heading"><strong>画面与探索</strong><button aria-label="关闭设置" onClick={() => setSettingsOpen(false)}><X size={17} /></button></div>
          <p className="tour-input-note">点击背景锁定鼠标环视，Esc 释放。未锁定时可直接拖动背景；竹筏模式竖滑阅读。探索时按住方向键或 WASD 走动。</p>
          <label>环视灵敏度 <b>{sensitivity.toFixed(1)}×</b><input aria-label="环视灵敏度" type="range" min=".4" max="2" step=".1" value={sensitivity} onChange={event => setSensitivity(Number(event.target.value))} /></label>
          {!tour.exploring && <button className="tour-recenter" data-raft-action="recenter" disabled={paused || !tour.ready} onClick={() => directorRef.current?.recenterRaft()}><RotateCcw size={14} />回到前方视角</button>}
          <label className="tour-check"><input type="checkbox" checked={miniMapEnabled} onChange={event => setMiniMapEnabled(event.target.checked)} />探索时显示局部场景示意</label>
          <label>水流速度 <b>{water.speed.toFixed(2)} m/s</b><input aria-label="水流速度" type="range" min="0" max="2" step=".05" value={water.speed} onChange={event => setWater(value => ({ ...value, speed: Number(event.target.value) }))} /></label>
          <label className="tour-check"><input type="checkbox" checked={waterStopped} onChange={event => setWaterStopped(event.target.checked)} />暂停流水</label>
          <label>波纹强度<input aria-label="波纹强度" type="range" min="0" max="1.5" step=".05" value={water.strength} onChange={event => setWater(value => ({ ...value, strength: Number(event.target.value) }))} /></label>
          <label>透明度<input aria-label="水面透明度" type="range" min=".3" max="1" step=".05" value={water.opacity} onChange={event => setWater(value => ({ ...value, opacity: Number(event.target.value) }))} /></label>
          <label>倒影<select value={water.reflection} onChange={event => setWater(value => ({ ...value, reflection: Number(event.target.value) }))}><option value="1">清晰倒影</option><option value=".35">节能环境色</option></select></label>
          <label className="tour-check"><input type="checkbox" checked={reduce} onChange={event => setReduce(event.target.checked)} />减少动态效果</label>
          <label>画质<select defaultValue={new URLSearchParams(location.search).get('quality') || 'auto'} onChange={event => { const url = new URL(location.href); url.searchParams.set('quality', event.target.value); location.assign(url.href); }}><option value="auto">自动</option><option value="low">省电</option><option value="high">高清</option></select></label>
          <small>沿岸布局与内部空间为艺术化展示，非实地导航或考据复原</small>
        </div>}
      </div>
    </>}
    <div className="hotspot-layer">{HOTSPOTS.map(hotspot => <button key={hotspot.id} type="button" className="hotspot" data-spot-id={hotspot.id} tabIndex={-1} aria-hidden="true" aria-label={'查看景点：' + hotspot.label}
      ref={element => { if (element) hotspotEls.current[hotspot.id] = element; else delete hotspotEls.current[hotspot.id]; }}
      onClick={event => isTourStation(hotspot.spotId) ? selectTourStation(hotspot.spotId) : onSpot(hotspot.spotId, event.currentTarget)}><span className="hotspot-ring" /><span className="hotspot-label"><b>{hotspot.label}</b><small>{hotspot.hint}</small></span></button>)}</div>
    <div className={'stage-loader is-' + stage} role="status" aria-live="polite">
      {stage === 'loading' && <><span className="loader-track"><i style={{ transform: 'scaleX(' + load.value + ')' }} /></span><span>{load.label} · {Math.round(load.value * 100)}%</span></>}
      {stage === 'ready' && <span>山景已就绪</span>}
      {stage === 'static' && <span>实拍资料模式 · 三维地形未加载 <button onClick={() => setAttempt(value => value + 1)}>重试地形</button></span>}
    </div>
  </>;
}
