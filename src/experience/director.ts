import {getTourSession,subscribeTour,synchronizeTourScroll,setTourBlocked,publishTourScene,setTourExploring} from './tourSessionState';
import type { AnchorId, LandscapeScene } from '../scene/LandscapeScene';
import type { RaftRideSnapshot } from '../scene/raftRide';
import type { SceneRegionTransitionMeta } from './regionTransitionData.mjs';

type Options = {
  getSections: () => HTMLElement[];
  onChapter: (index: number) => void;
  onRegionTransition?: (transition: SceneRegionTransitionMeta | null) => void;
  onRaftState?: (state: RaftRideSnapshot) => void;
  reducedMotion: boolean;
};

const ANCHORS: AnchorId[] = ['river', 'danxia', 'elephant', 'zhengyi', 'tianshi', 'shangqing'];

/**
 * The only animation clock on the page. Every scroll- or pointer-driven value has exactly one owner here:
 *  - camera, lighting and scene time → LandscapeScene.update (called from this loop)
 *  - CSS custom properties --hero-out, --px, --py, --chapter-fill on <html> → written here, consumed by CSS
 *  - hotspot button positions → written here as transforms
 * React never re-renders per frame; it only hears about chapter changes.
 */
export class Director {
  private raf = 0;
  private last = 0;
  private time = 8;
  private sections: HTMLElement[] = [];
  private anchors: number[] = [0];
  private tops: number[] = [0];
  private chapter = -1;
  private regionTransitionKey = '';
  private raftStateKey = '';
  private scrolled = false;
  private heroGone = false;
  private raw = 0;
  private smooth = 0;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0, lastMove: 0 };
  private written = new Map<string, number>();
  private scene: LandscapeScene | null = null;
  private hotspots = new Map<AnchorId, HTMLElement>();
  private hotspotState = Object.fromEntries(ANCHORS.map(id => [id, { x: 0, y: 0, visible: false }])) as Record<AnchorId, { x: number; y: number; visible: boolean }>;
  private shown = new Map<AnchorId, boolean>();
  private flipped = new Map<AnchorId, boolean>();
  private resizeObserver?: ResizeObserver;
  private stage?: HTMLElement;
  private root = document.documentElement;
  reducedMotion: boolean;
  private paused = false;
  private unsubscribeTour?:()=>void;
  private effectiveSuspended=true;
  private lastTourRequest=0;
  private syncTour=()=>{const tour=getTourSession(),inactive=this.paused||tour.mode!=='tour',suspended=inactive||tour.exploring;
    this.scene?.setExploreActive?.(tour.exploring);
    this.scene?.setExploreSuspended?.(inactive||document.hidden);
    if(suspended!==this.effectiveSuspended){this.effectiveSuspended=suspended;this.scene?.setRaftSuspended(suspended);this.scene?.resetFrameClock();}};
  setPaused(value: boolean) { this.paused = value; setTourBlocked(value); this.syncTour(); this.emitRaftState(); }

  constructor(private options: Options) {
    this.reducedMotion = options.reducedMotion;
  }

  start(stage: HTMLElement) {
    this.stage = stage;
    this.unsubscribeTour=subscribeTour(this.syncTour);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('blur', this.onLeave);
    window.addEventListener('resize', this.measure);
    this.resizeObserver = new ResizeObserver(() => { this.measure(); this.resizeScene(); });
    this.resizeObserver.observe(document.body);
    this.resizeObserver.observe(stage);
    this.measure();
    this.smooth = this.raw = this.computeProgress();
    this.raf = requestAnimationFrame(this.frame);
  }

  setWaterView(value:boolean){this.scene?.setWaterView(value);}
  toggleRaftPaused(){if(!this.paused){this.scene?.toggleRaftPaused();this.emitRaftState();}}
  lookRaft(yaw:number,pitch=0){if(!this.paused){this.scene?.lookRaft(yaw,pitch);this.emitRaftState();}}
  recenterRaft(){if(!this.paused){this.scene?.recenterRaft();this.emitRaftState();}}
  setExploreActive(value:boolean){setTourExploring(value);this.syncTour();}
  toggleExplore(){this.setExploreActive(!getTourSession().exploring);}
  setExploreInput(forward:number,right:number,fast=false){if(!this.paused&&getTourSession().mode==='tour')this.scene?.setExploreInput?.(forward,right,fast);}
  lookExplore(yaw:number,pitch=0){if(!this.paused&&getTourSession().mode==='tour')this.scene?.lookExplore?.(yaw,pitch);}
  getExploreState(){return this.scene?.getExploreState?.()??null;}
  getExploreMap(){return this.scene?.getExploreMap?.()??null;}
  configureWater(settings: import('../scene/riverFlow').WaterSettings) { this.scene?.setWaterSettings(settings); }
  attachScene(scene: LandscapeScene) { this.scene = scene; scene.setRaftSuspended?.(this.paused||getTourSession().mode!=='tour'); scene.setRaftReducedMotion?.(this.reducedMotion); this.syncTour(); this.resizeScene(); this.emitRaftState(); }
  detachScene() { this.scene = null; this.emitRegionTransition(null); this.hotspots.forEach((_el, id) => this.setHotspotVisible(id, false)); }
  registerHotspot(id: AnchorId, el: HTMLElement | null) { if (el) this.hotspots.set(id, el); else this.hotspots.delete(id); }

  private resizeScene() {
    if (this.scene && this.stage) this.scene.resize(this.stage.clientWidth, this.stage.clientHeight);
  }

  private onPointer = (e: PointerEvent) => {
    if (this.paused || e.pointerType !== 'mouse') return;
    this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    this.pointer.lastMove = performance.now();
  };
  private onLeave = () => { this.scene?.setExploreInput?.(0,0,false); if (this.paused) return; this.pointer.tx = 0; this.pointer.ty = 0; };

  /** Section tops → piecewise-linear scroll anchors. Chapter i is "arrived" when its top is 35% down the viewport. */
  measure = () => {
    this.sections = this.options.getSections();
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    this.tops = this.sections.map(s => s.getBoundingClientRect().top + window.scrollY);
    const anchors = [0];
    for (let i = 1; i < this.sections.length; i++) anchors.push(Math.min(Math.max(this.tops[i] - vh * 0.35, anchors[i - 1] + 1), max));
    anchors.push(Math.max(max, anchors[anchors.length - 1] + 1));
    this.anchors = anchors;
  };

  private computeProgress() {
    const y = window.scrollY, a = this.anchors;
    if (y <= a[0]) return 0;
    for (let i = 0; i < a.length - 1; i++) if (y < a[i + 1]) return i + (y - a[i]) / (a[i + 1] - a[i]);
    return a.length - 1;
  }

  private write(name: string, value: number, precision = 1000) {
    const v = Math.round(value * precision) / precision;
    if (this.written.get(name) === v) return;
    this.written.set(name, v);
    this.root.style.setProperty(name, String(v));
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    if (this.paused || document.hidden) return;
    synchronizeTourScroll();this.syncTour();
    const tour=getTourSession();
    const motion = !this.reducedMotion;
    if (motion) this.time += dt;

    this.raw = this.computeProgress();
    // Page reading and chapter selection share the tour session; scene owns physical movement.
    this.smooth = motion ? this.smooth + (this.raw - this.smooth) * (1 - Math.exp(-dt * 3.4)) : Math.round(this.raw);

    const p = this.pointer;
    if (!motion) { p.x = p.y = 0; }
    else {
      const idle = now - p.lastMove > 2600;
      const k = 1 - Math.exp(-dt * (idle ? 0.7 : 2.4));
      const tx = idle ? 0 : p.tx, ty = idle ? 0 : p.ty;
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k;
    }

    const vh = window.innerHeight, y = window.scrollY;
    // Reads come from cached geometry only, so these writes never force a synchronous layout.
    const chapter = this.tops.reduce((acc, top, i) => (top < y + vh * 0.45 ? i : acc), 0);
    if (chapter !== this.chapter) { this.chapter = chapter; this.options.onChapter(chapter); }
    this.write('--hero-out', Math.min(1, Math.max(0, y / (vh * 0.75))));
    this.write('--px', p.x);
    this.write('--py', p.y);
    this.write('--chapter-fill', this.raw / Math.max(1, this.anchors.length - 1));
    const scrolled = y > 24;
    if (scrolled !== this.scrolled) { this.scrolled = scrolled; this.root.toggleAttribute('data-scrolled', scrolled); }
    // Hero cards fade out with --hero-out; once invisible they must stop taking clicks and focus.
    const heroGone = y > vh * 0.62;
    if (heroGone !== this.heroGone) { this.heroGone = heroGone; this.root.toggleAttribute('data-hero-gone', heroGone); }

    if (this.scene) {
      if(tour.mode==='tour'&&tour.request&&tour.request.serial!==this.lastTourRequest){this.lastTourRequest=tour.request.serial;this.scene.selectTourStation(tour.request);}
      this.scene.update({ progress: this.smooth, pointerX: p.x, pointerY: p.y, time: this.time, motion, deltaSeconds:dt });
      this.emitRaftState();
      const presentation=this.scene.getTourPresentation();
      const veil=this.stage?.querySelector<HTMLElement>('.tour-region-veil');if(veil)veil.style.opacity=String(presentation.transition);
      publishTourScene({...presentation,transition:0});
      this.scene.projectAnchors(this.smooth, this.hotspotState);
      for (const id of ANCHORS) {
        const el = this.hotspots.get(id), s = this.hotspotState[id];
        if (!el) continue;
        if (s.visible) {
          el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
          // Labels open to the left near the right edge so they are never clipped.
          const flip = s.x > window.innerWidth - 190;
          if (this.flipped.get(id) !== flip) { this.flipped.set(id, flip); el.classList.toggle('is-flipped', flip); }
        }
        this.setHotspotVisible(id, s.visible&&tour.mode==='tour'&&!tour.exploring);
      }
    }
  };

  private emitRaftState(){
    const s=this.scene?.getRaftState?.();if(!s)return;
    const key=JSON.stringify([Math.floor(s.travelMeters),s.yaw,s.pitch,s.userPaused,s.suspended,s.reducedMotion,s.atEnd,s.journeyPhase,s.journeyId,Math.round(s.speedMetersPerSecond*2)]);
    if(key===this.raftStateKey)return;this.raftStateKey=key;this.options.onRaftState?.(s);
  }

  private emitRegionTransition(transition: SceneRegionTransitionMeta | null) {
    const key = transition ? JSON.stringify([transition.id, transition.fromId, transition.toId]) : '';
    if (key === this.regionTransitionKey) return;
    this.regionTransitionKey = key;
    this.options.onRegionTransition?.(transition);
  }

  private setHotspotVisible(id: AnchorId, visible: boolean) {
    if (this.shown.get(id) === visible) return;
    this.shown.set(id, visible);
    const el = this.hotspots.get(id);
    if (!el) return;
    el.classList.toggle('is-visible', visible);
    el.tabIndex = visible ? 0 : -1;
    el.setAttribute('aria-hidden', String(!visible));
    if (!visible && document.activeElement === el) el.blur();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsubscribeTour?.();
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('pointerleave', this.onLeave);
    window.removeEventListener('blur', this.onLeave);
    window.removeEventListener('resize', this.measure);
    this.resizeObserver?.disconnect();
    this.scene = null;
    for (const name of ['--hero-out', '--px', '--py', '--chapter-fill']) this.root.style.removeProperty(name);
    this.root.removeAttribute('data-scrolled');
    this.root.removeAttribute('data-hero-gone');
  }
}
