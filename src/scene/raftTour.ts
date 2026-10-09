import {createRaftRideController,type RaftRideController,type RaftRideRoute} from './raftRide';
import type {TourRequest,TourStationId} from '../experience/tourSession';
export const RIVER_STATION_REACHES={river:[15765.722214320776,15795.722214320776],zhengyi:[14212.314356129798,14242.314356129798],tianshi:[3436.8533658490696,3466.8533658490696],shangqing:[2627.2177187891893,2657.2177187891893]} as const;
const names={river:'泸溪河',zhengyi:'正一观',tianshi:'嗣汉天师府',shangqing:'大上清宫'};
const notes={river:'泸溪河 · 两岸观览',zhengyi:'正一观 · 艺术化沿岸观景位',tianshi:'嗣汉天师府 · 艺术化沿岸观景位',shangqing:'大上清宫 · 艺术化沿岸观景位'};
const arrivalMeters:Record<TourStationId,number>={river:10,zhengyi:22,tianshi:22,shangqing:22};
const smooth=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};
/** Short mapped-water journeys separated by an explicit geographic cut.
 * No tween ever interpolates across land; destination replaces the route only under an opaque veil.
 */
export function createRaftTour(routes:Record<TourStationId,RaftRideRoute>,initial:RaftRideController,low=false,prefetch:(id:TourStationId)=>void=()=>{}){
 let controller=initial,current:TourStationId='river',target:TourStationId='river';
 let phase='drifting',alpha=0,fadeTime=0,fadeFrom=0,departTime=0,suspended=false,lastSerial=0;
 let lastMotion=true,selection:TourRequest|null=null;
 const beginFade=(next:'transferring'|'revealing')=>{phase=next;fadeFrom=alpha;fadeTime=0;};
 const options=()=>({journeyId:String(lastSerial),durationSeconds:3.4,maxSpeedMetersPerSecond:low?4:6});
 function select(request:TourRequest){
  if(request.serial===lastSerial)return;
  const samePending=selection!==null&&request.id===target&&request.source!=='restart';
  lastSerial=request.serial;
  if(request.resume)controller.setPaused(false);
  if(samePending)return;
  selection=request;target=request.id;prefetch(target);
  if(request.source==='restart'){
   // Restart is an explicit reset, performed behind the same region veil.
   beginFade('transferring');return;
  }
  if(current===target){
   if(phase==='drifting'&&target==='river')return;
   if(alpha>0){beginFade('revealing');return;}
   controller.requestTravel(Math.min(routes[current].endMeters-routes[current].startMeters-3,Math.max(controller.snapshot().travelMeters,arrivalMeters[current])),{...options(),resume:request.resume});phase='approaching';return;
  }
  if(alpha>0){beginFade('transferring');return;}
  const s=controller.snapshot();
  const exit=Math.min(s.routeEndMeters-s.routeStartMeters-3,s.travelMeters+9);
  controller.requestTravel(exit,{...options(),durationSeconds:2.5,resume:request.resume});phase='departing';departTime=0;
 }
 function swap(motion:boolean){
  const previous=controller.snapshot();current=target;controller=createRaftRideController(routes[current]);controller.setSuspended(suspended);controller.setPaused(previous.userPaused);controller.setReducedMotion(!motion);
  const restart=selection?.source==='restart';const destination=restart?0:arrivalMeters[current];
  if(!motion){controller.reset(destination,{keepUserPaused:true});controller.requestTravel(destination,options());}
  else if(!restart){if(current!=='river')controller.reset(6,{keepUserPaused:true});controller.requestTravel(destination,options());}
  alpha=1;beginFade('revealing');
 }
 function advance(dt:number,motion:boolean){
  lastMotion=motion;dt=Math.min(.1,Math.max(0,dt));
  const s=controller.snapshot();
  if(suspended||s.userPaused){controller.advance(0,motion);return controller.pose();}
  if(!motion&&(phase==='departing'||phase==='approaching')){beginFade('transferring');}
  if(phase==='departing'){
   controller.advance(dt,motion);departTime+=dt;
   if(departTime>=1.15||controller.snapshot().arrived){beginFade('transferring');}
  }else if(phase==='transferring'){
   controller.advance(dt,motion);fadeTime+=dt;alpha=fadeFrom+(1-fadeFrom)*smooth(fadeTime/.55);
   // Alpha equals 1 before route replacement; all intermediate coordinates remain on their own reach.
   if(fadeTime>=.55)swap(motion);
  }else if(phase==='revealing'){
   fadeTime+=dt;alpha=fadeFrom*(1-smooth(fadeTime/.55));controller.advance(dt,motion);
   if(fadeTime>=.55){alpha=0;phase=selection?.source==='restart'&&current==='river'&&motion?'drifting':controller.snapshot().arrived?'arrived':'approaching';}
  }else{
   controller.advance(dt,motion);
   if(phase==='approaching'&&controller.snapshot().arrived)phase='arrived';
   // Reading the river chapter never lets its default cruise wander to a different region.
   if(phase==='drifting'&&controller.snapshot().travelMeters>=8){controller.requestTravel(10,{...options(),maxSpeedMetersPerSecond:.65});phase='approaching';}
  }
  return controller.pose();
 }
 function presentation(){return{phase,status:phase==='drifting'?'泸溪河 · 缓缓前行':phase==='departing'?`正在前往${names[target]} · 加速驶离`:phase==='transferring'||phase==='revealing'?`前往${names[target]} · 区域切换（时间压缩）`:phase==='approaching'?`${names[target]} · ${controller.snapshot().travelMeters>arrivalMeters[current]*.65?'减速抵达':'驶入观览河段'}`:notes[current]+' · 已抵达',transition:alpha};}
 return{get controller(){return controller;},get current(){return current;},get target(){return target;},get phase(){return phase;},select,advance,presentation,
  suspend(value:boolean){suspended=value;controller.setSuspended(value);},
  diagnostics(){return{current,target,phase,alpha,lastSerial,suspended,motion:lastMotion};}
 };
}
