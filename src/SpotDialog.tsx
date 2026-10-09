import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Clock3, Footprints, Headphones, MapPin, Route, X } from 'lucide-react';
import { sources, spots } from '../shared/catalog.mjs';
import { PlacePhoto, assetFor } from './PlacePhoto';
import { VisitPanel, isPalaceSite } from './VisitPanel';
import type { PalaceSiteId, VisitMode } from './VisitPanel';
import { landformStudies } from './landformStudies';
import './palace-entry.css';

type Spot = (typeof spots)[number];
type Props = { spot: Spot; image?: string; returnFocusTo?: HTMLElement | null; onClose: () => void; onGuide: (spot: Spot) => void; onPlan: (spot: Spot) => void; onExploreInScene: (siteId: PalaceSiteId) => void };

/** Native modal contains place reference material; free exploration is handled by the main scenic scene. */
export function SpotDialog({ spot, returnFocusTo, onClose, onGuide, onPlan, onExploreInScene }: Props) {
  const [visiting, setVisiting] = useState(false);
  const [initialMode, setInitialMode] = useState<VisitMode>('photos');
  const [activeMode, setActiveMode] = useState<VisitMode>('photos');
  const introScroll = useRef(0), visitTrigger = useRef<HTMLElement | null>(null);
  const asset = assetFor(spot.id), study = landformStudies[spot.id], palace = isPalaceSite(spot.id) ? spot.id : null;
  const ref = useRef<HTMLDialogElement>(null);
  const beginVisit = (mode: VisitMode, trigger: HTMLElement) => {
    introScroll.current = ref.current?.scrollTop ?? 0;
    visitTrigger.current = trigger;
    setActiveMode(mode);
    setInitialMode(mode);
    setVisiting(true);
  };
  const returnToIntro = () => {
    setActiveMode('photos');
    setVisiting(false);
  };
  const updateVisitMode = (mode: VisitMode) => {
    setActiveMode(mode);
  };
  useEffect(() => {
    const dialog = ref.current!;
    const scroll = window.scrollY, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    (dialog.querySelector<HTMLButtonElement>('.palace-start') ?? dialog.querySelector<HTMLButtonElement>('.spot-close'))?.focus({ preventScroll: true });
    return () => {
      if (document.pointerLockElement && dialog.contains(document.pointerLockElement)) document.exitPointerLock();
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      window.scrollTo({ top: scroll, behavior: 'instant' });
      // Restore focus after the native modal releases the page from its inert state.
      if (returnFocusTo?.isConnected && returnFocusTo.tabIndex >= 0) returnFocusTo.focus({ preventScroll: true });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: visiting ? 0 : introScroll.current, behavior: 'instant' });
    if (!visiting && visitTrigger.current?.isConnected) visitTrigger.current.focus({ preventScroll: true });
  }, [visiting, activeMode]);
  const refs = sources.filter(s => spot.sourceIds.includes(s.id));
  return <dialog ref={ref} className={'spot-dialog' + (palace ? ' is-palace' : '') + (visiting ? ' is-visiting' : '')} data-palace-dialog={palace ? spot.id : undefined} aria-labelledby="spot-title" aria-describedby="spot-desc"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === ref.current) onClose(); }}>
    <article className="spot-sheet">
      <figure className={'spot-figure art-' + spot.art}>
        <PlacePhoto spotId={spot.id} />
        <figcaption>{asset.photos[0]?.author || '对应地点实拍资料待补充'}</figcaption>
      </figure>
      <div className="spot-sheet-body">
        <button type="button" className={'icon-button spot-close' + (palace ? ' palace-exit' : '')} data-palace-action={palace ? 'exit' : undefined} aria-label={palace ? '返回景区' : '关闭景点介绍'} onClick={onClose}>{palace && <span>返回景区</span>}<X size={20} /></button>
        <div className="eyebrow">{spot.category} · {spot.zone}</div>
        <h2 id="spot-title">{spot.name}</h2>
        <p className="spot-subtitle">{spot.subtitle}</p>
        {palace && <div className="palace-entry-intro">
          <button type="button" className="primary palace-start" data-palace-entry={spot.id} onClick={() => onExploreInScene(palace)}><Footprints size={18} />在大地图自由探索<ArrowUpRight size={17} /></button>
          <p>回到大地图，可从宫观入口连续走入庭院、殿堂与廊道。内部为艺术化补全，非考据复原。</p>
        </div>}
        <p id="spot-desc">{spot.description}</p>
        <blockquote className="spot-fact">{spot.fact}{refs.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={12} /></a>)}</blockquote>
        <ul className="spot-meta-list">
          <li><Clock3 size={15} />建议游览约 {spot.minutes} 分钟</li>
          <li><MapPin size={15} />{spot.zone}</li>
        </ul>
        <p className="spot-note">{spot.note}</p>
        <div className="spot-actions">
          {asset.model && <button type="button" className="ghost" data-palace-entry="model" onClick={event => beginVisit('model', event.currentTarget)}>观察独立外观模型</button>}
          {study && <button type="button" className="primary" onClick={event => beginVisit('study', event.currentTarget)}>观察山体模型</button>}
          <button type="button" className={palace ? 'ghost' : 'primary'} onClick={event => beginVisit('photos', event.currentTarget)}>{asset.interior.nodes.length || asset.gallery.nodes.length ? '进入实拍照片导览' : '查看内部资料状态'}</button>
          <button type="button" className="primary" onClick={() => onGuide(spot)}><Headphones size={17} />听小道士讲解</button>
          <button type="button" className="ghost" onClick={() => onPlan(spot)}><Route size={17} />按这里的风格规划</button>
        </div>
        {asset.geo && <details className="geo-evidence"><summary>位置依据与精度</summary><p>{asset.geo.role} · WGS84</p><p>{asset.geo.precision}。{asset.geo.entrance ? '入口和朝向依据公开影像与场地资料；高程为DEM估算。' : '入口、朝向与地面高程尚未核验。'}</p><a href={asset.geo.source} target="_blank" rel="noreferrer">查看位置来源 ↗</a></details>}
      </div>
      {visiting && <VisitPanel initialMode={initialMode} spotId={spot.id} onBack={returnToIntro} onModeChange={updateVisitMode} onExploreInScene={onExploreInScene} />}
    </article>
  </dialog>;
}