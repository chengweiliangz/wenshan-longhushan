import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { assetFor } from './PlacePhoto';
import { spots } from '../shared/catalog.mjs';
import { landformStudies } from './landformStudies';
import type { LandformStudyPose } from './LandformStudyView';
import type { ModelViewPose } from './ModelView';
import type { RoutePose } from './InteriorRouteView';
import './palace-entry.css';

const InteriorRouteView = lazy(() => import('./InteriorRouteView').then(m => ({ default: m.InteriorRouteView })));
const ModelView = lazy(() => import('./ModelView').then(m => ({ default: m.ModelView })));
const LandformStudyView = lazy(() => import('./LandformStudyView').then(m => ({ default: m.LandformStudyView })));
export type VisitMode = 'photos' | 'model' | 'route' | 'study';
export type PalaceSiteId = 'zhengyi' | 'tianshi' | 'shangqing';
type SavedVisitPose = { outside?: ModelViewPose; route?: RoutePose; study?: LandformStudyPose };
export const isPalaceSite = (id: string): id is PalaceSiteId => id === 'zhengyi' || id === 'tianshi' || id === 'shangqing';

export function VisitPanel({ spotId, onBack, initialMode = 'photos', onModeChange, onExploreInScene }: {
  spotId: string;
  onBack: () => void;
  initialMode?: VisitMode;
  onModeChange?: (mode: VisitMode) => void;
  onExploreInScene: (siteId: PalaceSiteId) => void;
}) {
  const a = assetFor(spotId), nodes = a.interior.nodes.length ? a.interior.nodes : a.gallery.nodes;
  const notice = 'notice' in a.interior ? a.interior.notice : a.gallery.notice;
  const route = 'route' in a.interior ? a.interior.route : null;
  const study = landformStudies[spotId], palaceId = isPalaceSite(spotId) ? spotId : null;
  const poses = useRef<Record<string, SavedVisitPose>>({});
  const savedPose = poses.current[spotId] ?? (poses.current[spotId] = {});
  const viewRef = useRef<HTMLDivElement>(null);
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const resolveMode = (requested: VisitMode): VisitMode =>
    requested === 'study' && !study || requested === 'route' && !route || requested === 'model' && !a.model ? 'photos' : requested;
  const [mode, setMode] = useState<VisitMode>(() => resolveMode(initialMode));
  const [index, setIndex] = useState(0), [zoom, setZoom] = useState(1), [attempt, setAttempt] = useState(0), [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const node = nodes[index], photo = a.photos.find(p => p.id === node?.photoId);
  const placeLabel = spots.find(s => s.id === spotId)?.name ?? '当前地点';
  const routeLabel = route ? placeLabel + ' · ' + route.label : '局部参观路线';
  const modelLabel = a.model && 'label' in a.model && a.model.label || placeLabel + ' · 独立外观研究模型';
  const photoIds = nodes.flatMap(n => a.photos.some(p => p.id === n.photoId) ? [n.photoId] : []);
  const changeMode = (next: VisitMode) => {
    const resolved = resolveMode(next);
    onModeChangeRef.current?.(resolved);
    setMode(resolved);
  };
  useEffect(() => {
    setIndex(0);
    setZoom(1);
    setState('loading');
    setMode(resolveMode(initialMode));
  }, [spotId, initialMode]);
  useEffect(() => { setZoom(1); setState('loading'); }, [index]);
  useEffect(() => {
    onModeChangeRef.current?.(mode);
    viewRef.current?.focus({ preventScroll: true });
  }, [mode, spotId]);

  const modeButtons = <>
    {palaceId && <button data-palace-action="scene-explore" onClick={() => onExploreInScene(palaceId)}>在大地图自由探索</button>}
    {a.model && <button data-palace-mode="model" aria-pressed={mode === 'model'} onClick={() => changeMode('model')}>观察独立外观模型</button>}
    <button data-palace-mode="photos" aria-pressed={mode === 'photos'} onClick={() => changeMode('photos')}>实拍照片导览</button>
    {route && <button data-palace-mode="route" aria-pressed={mode === 'route'} onClick={() => changeMode('route')}>有据参观路线</button>}
    {study && <button aria-pressed={mode === 'study'} onClick={() => changeMode('study')}>观察山体模型</button>}
  </>;
  const locationLabel = mode === 'study' && study ? study.label : mode === 'route' ? routeLabel : mode === 'model' ? modelLabel : node?.label || '资料待补充';

  return <section className={'visit-panel' + (palaceId ? ' has-palace' : '')} data-visit-site={spotId} data-visit-mode={mode} aria-label="地点实拍与建筑体验">
    <div className="visit-heading">
      <button className="text-button" onClick={onBack}>← 返回地点介绍</button>
      <strong>{'当前位置：' + locationLabel}</strong>
      <span>{mode === 'study' ? '照片参考 · 未定标定位' : mode === 'route' ? '局部空间资料模型 · 非扫描' : mode === 'model' ? '资料建模 · 非扫描模型' : '照片导览 · 非360°全景'}</span>
    </div>
    {(a.model || study || palaceId) && <div className="visit-mode" role="group" aria-label="资料与体验方式">{modeButtons}</div>}
    <div className="visit-view" ref={viewRef} tabIndex={-1} aria-label={locationLabel}>
      {mode === 'study' && study ? <Suspense fallback={<p role="status">载入山体查看器…</p>}><LandformStudyView key={spotId} study={study} pose={savedPose.study} onPose={pose => { savedPose.study = pose; }} /></Suspense>
          : mode === 'route' && route ? <Suspense fallback={<p role="status">载入路线查看器…</p>}><InteriorRouteView key={spotId} src={route.src} label={routeLabel} photoIds={photoIds} pose={savedPose.route} onPose={pose => { savedPose.route = pose; }} onBack={() => changeMode('model')} onPhotos={photoId => { const next = nodes.findIndex(n => n.photoId === photoId); if (next >= 0 && a.photos.some(p => p.id === photoId)) { setIndex(next); changeMode('photos'); } }} /></Suspense>
            : mode === 'model' && a.model ? <><Suspense fallback={<p role="status">载入模型查看器…</p>}><ModelView key={spotId} spotId={spotId} src={a.model.src} pose={savedPose.outside} onPose={pose => { savedPose.outside = pose; }} entryExperience={palaceId ? '大地图自由探索' : route ? '有据参观路线' : '实拍导览'} onEnter={() => { if (palaceId) onExploreInScene(palaceId); else { setIndex(0); changeMode(route ? 'route' : 'photos'); } }} /></Suspense><p className="visit-note">{a.model.status}。影像定位误差未实地量测。{palaceId ? '这是独立外观参考。自由探索会回到大地图，可从宫观入口连续行走；内部为艺术化补全，非考据复原。' : route ? route.scope + ' 从外部视角切换至局部路线观察，转场不表示已核验的连续通行。' : '内部连续路线尚未提供。'}</p></>
              : photo ? <>
                <div className="visit-photo-shell"><div className="visit-photo-scroll" tabIndex={0} aria-label="照片，可放大后滚动观察" onKeyDown={e => { if (e.key === 'ArrowRight' && zoom === 1) setIndex(i => Math.min(nodes.length - 1, i + 1)); if (e.key === 'ArrowLeft' && zoom === 1) setIndex(i => Math.max(0, i - 1)); }}>
                  <img key={photo.id + '-' + attempt} src={photo.src} alt={photo.title} style={{ width: zoom * 100 + '%', height: zoom === 1 ? '100%' : 'auto', minHeight: zoom === 1 ? 0 : '100%', maxWidth: 'none', opacity: state === 'ready' ? 1 : 0 }} onLoad={() => setState('ready')} onError={() => setState('error')} />
                </div>{state !== 'ready' && <div className="visit-photo-status" role="status">{state === 'loading' ? '正在载入此处实拍…' : '照片载入失败'}{state === 'error' && <button onClick={() => { setState('loading'); setAttempt(v => v + 1); }}>重试照片</button>}</div>}
                  <div className="photo-zoom"><button aria-label="缩小照片" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - .5))}>－</button><span>{Math.round(zoom * 100)}%</span><button aria-label="放大照片" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, z + .5))}>＋</button></div></div>
                <div className="visit-caption"><h3>{node.label}</h3><p>{node.relation}</p><a href={photo.source} target="_blank" rel="noreferrer">{photo.author} · 查看原始资料 ↗</a><small>{photo.captured ? '拍摄：' + photo.captured : '拍摄日期未提供' + (photo.published ? ' · 发布：' + photo.published : '')} · {photo.license}</small></div>
                <nav className="visit-nodes" aria-label="实拍参观位置">{nodes.map((n, i) => <button key={n.id} aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}><span>{String(i + 1).padStart(2, '0')}</span>{n.label}</button>)}</nav>
                <p className="visit-note">{notice}</p>
              </> : <div className="visit-empty"><h3>该地点实拍资料待补充</h3><p>暂无可核验的对应照片、全景或扫描数据。</p></div>}
    </div>
    <details><summary>{spotId === 'elephant' ? '查看形态与定位资料缺口' : palaceId ? '实地资料缺口与艺术补全范围' : '查看内部漫游资料缺口'}</summary>{palaceId && <p className="visit-note">大地图内的宫观内部为艺术化补全；以下实地核验资料仍待补充。</p>}<ul>{a.interior.missing.map(m => <li key={m}>{m}</li>)}</ul></details>
  </section>;
}