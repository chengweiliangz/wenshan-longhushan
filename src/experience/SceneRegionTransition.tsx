import { memo, useMemo } from 'react';
import { createRegionTransitionModel } from './regionTransitionData.mjs';
import type { SceneRegionTransitionMeta } from './regionTransitionData.mjs';
import './SceneRegionTransition.css';

export type SceneRegionTransitionProps = {
  transition?: SceneRegionTransitionMeta | null;
  paused?: boolean;
  sceneReady?: boolean;
};

/** Informational overlay; Director owns all animation and progress. */
export const SceneRegionTransition = memo(function SceneRegionTransition({
  transition = null, paused = false, sceneReady = false,
}: SceneRegionTransitionProps) {
  const model = useMemo(
    () => createRegionTransitionModel(transition),
    [transition?.id, transition?.fromId, transition?.toId],
  );
  if (!sceneReady || paused || !model) return null;
  const { from, to } = model;
  return <aside className="scene-region-transition" role="note"
    aria-label={`跨片区区位示意：${from.name}与${to.name}，${model.distanceLabel}。连线仅示意两地关系。`}>
    <div className="scene-region-transition__copy">
      <span className="scene-region-transition__eyebrow">跨片区 · 区位示意</span>
      <p className="scene-region-transition__zones"><span>{from.zone}</span><span aria-hidden="true">↔</span><span>{to.zone}</span></p>
      <p className="scene-region-transition__places">{from.name}<span aria-hidden="true"> · </span>{to.name}</p>
      <p className="scene-region-transition__distance">{model.distanceLabel}</p>
      <small>连线示意两地关系，非道路或步行路线</small>
    </div>
    <svg className="scene-region-transition__map" viewBox="0 0 115 100" aria-hidden="true" focusable="false">
      <rect className="scene-region-transition__map-ground" x=".5" y=".5" width="114" height="99" rx="5" />
      <path className="scene-region-transition__map-grid" d="M28.75 0V100M57.5 0V100M86.25 0V100M0 25H115M0 50H115M0 75H115" />
      <path className="scene-region-transition__north" d="M104 17V6m-3 4 3-4 3 4" />
      <text className="scene-region-transition__north-label" x="104" y="25" textAnchor="middle">北</text>
      <line className="scene-region-transition__segment" x1={from.point[0]} y1={from.point[1]} x2={to.point[0]} y2={to.point[1]} />
      {[from, to].map(point => <g key={point.id}>
        <circle className="scene-region-transition__pin" cx={point.point[0]} cy={point.point[1]} r="3" />
        <text className="scene-region-transition__pin-label" x={point.point[0]} y={point.point[1] + 10} textAnchor="middle">{point.name}</text>
      </g>)}
      <path className="scene-region-transition__scale" d="M8 88H18" />
      <text className="scene-region-transition__scale-label" x="8" y="96">1 km</text>
    </svg>
  </aside>;
});
