/** Bounded scene route. Coordinates are existing scene units (10 metres/unit).
 * Camera presentation only: no terrain, water, site placement, bearing or asset changes.
 * The reference supports approach/arrival/hold/reverse, not an asserted orbit. */
export type Vec3=readonly [number,number,number];
export type CameraKey={p:readonly number[];t:readonly number[]};
export type RegionTransition={id:'longhushan-shangqing';fromId:'zhengyi';toId:'tianshi'};
export type CameraRouteMeta={phase:string;regionTransition:RegionTransition|null};
export type CameraPose=CameraRouteMeta&{p:Vec3;t:Vec3;pointerScale:number};
export type RiverFrame={position:readonly number[];tangent:readonly number[]};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const ease=(v:number)=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
const tuple=(v:readonly number[]):Vec3=>{if(v.length!==3||!v.every(Number.isFinite))throw new Error('Invalid camera route vector');return [v[0],v[1],v[2]];};
const mix=(a:Vec3,b:Vec3,t:number):Vec3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const bezier=(a:Vec3,b:Vec3,c:Vec3,d:Vec3,t:number):Vec3=>mix(mix(mix(a,b,t),mix(b,c,t),t),mix(mix(b,c,t),mix(c,d,t),t),t);
const transition:RegionTransition={id:'longhushan-shangqing',fromId:'zhengyi',toId:'tianshi'};
/** Fixed route-order endpoints. Do not infer the user's scroll direction from fromId/toId. */
export function getCameraRouteMeta(progress:number):CameraRouteMeta{
 const p=clamp(Number.isFinite(progress)?progress:0,0,6);
 const phase=p<.08?'overview':p<.82?'river-approach':p<1.12?'river-hold':p<1.32?'river-depart':p<1.72?'zhengyi-transfer':p<2?'zhengyi-arrive':p<2.35?'zhengyi':p<3.65?'regional-transition':p<4.35?'tianshi':p<5.8?'shangqing':'regional-overview';
 return {phase,regionTransition:p>=2.35&&p<=3.65?transition:null};
}
export function createCameraRoute(sourceKeys:readonly CameraKey[],river:RiverFrame){
 if(sourceKeys.length!==7)throw new Error('Camera route expects the seven production anchors');
 const keys=sourceKeys.map(k=>({p:tuple(k.p),t:tuple(k.t)}));
 const q=tuple(river.position),tangent=tuple(river.tangent),length=Math.hypot(tangent[0],tangent[2]);
 if(length<.001)throw new Error('Camera route needs a sourced river tangent');
 const dx=tangent[0]/length,dz=tangent[2]/length;
 const water={p:[q[0]-5*dx-1.6*dz,q[1]+1.6,q[2]-5*dz+1.6*dx] as Vec3,t:[q[0]+7*dx,q[1]+.25,q[2]+7*dz] as Vec3};
 const firstControl:Vec3=[keys[0].p[0]+(water.p[0]-keys[0].p[0])*.55,keys[0].p[1],keys[0].p[2]+(water.p[2]-keys[0].p[2])*.55];
 const secondControl:Vec3=[water.p[0],water.p[1]+10,water.p[2]];
 // Current loaded D GLB including forecourt: hierarchical bounds relative to the original site target.
 const boundsOffset={"min":[-9.701843455473892,-4.31713493824005,-3.9474709900762264],"max":[3.978329531517886,-2.411500034332274,10.348249811869373]};
 let lastAspect=NaN,lastArrival:{p:Vec3;t:Vec3}|undefined;
 const zhengyiKey=(aspect:number)=>{
  const a=Number.isFinite(aspect)?Math.max(.25,aspect):16/9;if(a===lastAspect&&lastArrival)return lastArrival;
  const bounds={min:keys[2].t.map((v,i)=>v+boundsOffset.min[i]),max:keys[2].t.map((v,i)=>v+boundsOffset.max[i])};
  const target=tuple(bounds.min.map((v,i)=>(v+bounds.max[i])*.5)),delta=keys[2].p.map((v,i)=>v-target[i]);
  const originalDistance=Math.hypot(...delta),back=delta.map(v=>v/originalDistance),horizontal=Math.hypot(back[0],back[2]),right=[back[2]/horizontal,0,-back[0]/horizontal],up=[back[1]*right[2],back[2]*right[0]-back[0]*right[2],-back[1]*right[0]];
  const tan=Math.tan((a<1?62:48)*Math.PI/360);let distance=originalDistance;
  for(let corner=0;corner<8;corner++){const v=bounds.min.map((lo,j)=>(((corner>>j)&1)?bounds.max[j]:lo)-target[j]),dot=(b:readonly number[])=>v.reduce((sum,n,j)=>sum+n*b[j],0);distance=Math.max(distance,dot(back)+Math.abs(dot(right))/(tan*a*.8),dot(back)+Math.abs(dot(up))/(tan*.72));}
  lastAspect=a;lastArrival={p:tuple(target.map((v,i)=>v+back[i]*distance)),t:target};return lastArrival;
 };

 const sample=(progress:number,motion=true,aspect=16/9):CameraPose=>{
  const p=clamp(Number.isFinite(progress)?progress:0,0,6),meta=getCameraRouteMeta(p),arrival=zhengyiKey(aspect),transferY=Math.max(36,arrival.p[1]+8);
  const riverHigh={p:[water.p[0],transferY,water.p[2]] as Vec3,t:water.t},siteHigh={p:[arrival.p[0],transferY,arrival.p[2]] as Vec3,t:arrival.t};
  if(!motion){const i=Math.round(p),key=i===1?water:i===2?arrival:keys[i];return {...getCameraRouteMeta(i),p:key.p,t:key.t,pointerScale:0};}
  if(p<.08)return {...meta,...keys[0],pointerScale:1.3};
  if(p<.82){const u=ease((p-.08)/.74);return {...meta,p:bezier(keys[0].p,firstControl,secondControl,water.p,u),t:mix(keys[0].t,water.t,u),pointerScale:1.3+(0.18-1.3)*u};}
  if(p<=1.12)return {...meta,...water,pointerScale:.18};
  if(p<1.32){const u=ease((p-1.12)/.2);return {...meta,p:mix(water.p,riverHigh.p,u),t:water.t,pointerScale:.18+(1.3-.18)*u};}
  if(p<1.72){const u=ease((p-1.32)/.4);return {...meta,p:mix(riverHigh.p,siteHigh.p,u),t:water.t,pointerScale:1.3};}
  if(p<2){const u=ease((p-1.72)/.28);return {...meta,p:mix(siteHigh.p,arrival.p,u),t:mix(water.t,arrival.t,u),pointerScale:1.3};}
  const index=Math.min(5,Math.floor(p)),u=smooth(p-index);
  return {...meta,p:mix((index===2?arrival:keys[index]).p,keys[index+1].p,u),t:mix((index===2?arrival:keys[index]).t,keys[index+1].t,u),pointerScale:1.3};
 };
 return {sample,waterPose:water,transferY:Math.max(36,zhengyiKey(16/9).p[1]+8)};
}
