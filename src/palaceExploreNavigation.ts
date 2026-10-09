import {createFreeExplorer,FREE_EXPLORER} from './scene/freeExplorer';
import type {FreeExplorerSnapshot,ExplorerCollider} from './scene/freeExplorer';

export type PalaceSiteId='zhengyi'|'tianshi'|'shangqing';
export type PalaceExplorePose=FreeExplorerSnapshot;
export type PalaceVector=[number,number,number];
export type PalaceBounds=[number,number,number,number];
export type PalaceExploreDocument={
 version:1;id:PalaceSiteId;label:string;notice:string;modelSrc:string;
 spawn:{position:PalaceVector;yaw:number};
 floors:{id:string;bounds:PalaceBounds;height:number}[];
 colliders:{id:string;min:PalaceVector;max:PalaceVector}[];
 zones:{id:string;label:string;bounds:PalaceBounds;basis:string}[];
 landmarks:{id:string;label:string;position:PalaceVector;description:string}[];
 bounds:PalaceBounds;sources:{title:string;url:string;basis:string}[];
};
export const PALACE_METRES_TO_SCENE=.1;
export const palaceExploreAsset=(id:PalaceSiteId)=>`/assets/palace-explore/bz/${id}.json`;
type RecordValue=Record<string,unknown>;
const object=(value:unknown):RecordValue=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('宫观导航数据格式无效');return value as RecordValue;};
const text=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim())throw new Error(`缺少${label}`);return value.trim();};
const number=(value:unknown)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new Error('宫观导航坐标无效');return value;};
function tuple(value:unknown,size:3):PalaceVector;
function tuple(value:unknown,size:4):PalaceBounds;
function tuple(value:unknown,size:3|4){if(!Array.isArray(value)||value.length!==size)throw new Error('宫观导航坐标维度无效');return value.map(number);}
const bounds=(value:unknown)=>{const b=tuple(value,4);if(b[0]>=b[2]||b[1]>=b[3])throw new Error('宫观导航范围无效');return b;};
const list=(value:unknown)=>{if(!Array.isArray(value))throw new Error('宫观导航列表无效');return value;};
const contains=(b:PalaceBounds,x:number,z:number)=>x>=b[0]-1e-10&&x<=b[2]+1e-10&&z>=b[1]-1e-10&&z<=b[3]+1e-10;
const scaleVector=(p:PalaceVector)=>p.map(v=>v*PALACE_METRES_TO_SCENE) as PalaceVector;
const scaleBounds=(p:PalaceBounds)=>p.map(v=>v*PALACE_METRES_TO_SCENE) as PalaceBounds;

/** JSON coordinates are metres; all returned walking coordinates and saved poses are scene units. */
export function createPalaceNavigation(value:unknown,expectedId?:PalaceSiteId){
 const d=object(value),id=text(d.id,'地点标识');
 if(d.version!==1||!['zhengyi','tianshi','shangqing'].includes(id)||expectedId&&id!==expectedId)throw new Error('宫观导航版本或地点不匹配');
 const spawn=object(d.spawn);
 const document:PalaceExploreDocument={
  version:1,id:id as PalaceSiteId,label:text(d.label,'地点名称'),notice:text(d.notice,'艺术化说明'),modelSrc:text(d.modelSrc,'模型地址'),
  spawn:{position:tuple(spawn.position,3),yaw:number(spawn.yaw)},bounds:bounds(d.bounds),
  floors:list(d.floors).map(value=>{const f=object(value);return{id:text(f.id,'地面标识'),bounds:bounds(f.bounds),height:number(f.height)};}),
  colliders:list(d.colliders).map(value=>{const c=object(value),min=tuple(c.min,3),max=tuple(c.max,3);if(min.some((v,i)=>v>max[i]))throw new Error('宫观碰撞体范围无效');return{id:text(c.id,'墙体标识'),min,max};}),
  zones:list(d.zones).map(value=>{const z=object(value);return{id:text(z.id,'区域标识'),label:text(z.label,'区域名称'),bounds:bounds(z.bounds),basis:text(z.basis,'区域依据')};}),
  landmarks:list(d.landmarks).map(value=>{const l=object(value);return{id:text(l.id,'观察点标识'),label:text(l.label,'观察点名称'),position:tuple(l.position,3),description:text(l.description,'观察点说明')};}),
  sources:list(d.sources).map(value=>{const s=object(value);return{title:text(s.title,'资料名称'),url:typeof s.url==='string'?s.url.trim():'',basis:text(s.basis,'资料依据')};}),
 };
 if(!document.floors.length||!document.zones.length)throw new Error('宫观缺少可行走地面或区域');
 const sceneBounds=scaleBounds(document.bounds),floors=document.floors.map(f=>({...f,bounds:scaleBounds(f.bounds),height:f.height*PALACE_METRES_TO_SCENE}));
 const zones=document.zones.map(z=>({...z,bounds:scaleBounds(z.bounds)}));
 const landmarks=document.landmarks.map(l=>({...l,position:scaleVector(l.position)}));
 const colliders:ExplorerCollider[]=document.colliders.map(c=>({min:{x:c.min[0]*.1,y:c.min[1]*.1,z:c.min[2]*.1},max:{x:c.max[0]*.1,y:c.max[1]*.1,z:c.max[2]*.1}}));
 const sceneSpawn=scaleVector(document.spawn.position);
 function sampleGround(x:number,z:number):number|null{
  if(!Number.isFinite(x)||!Number.isFinite(z)||!contains(sceneBounds,x,z))return null;
  let height:number|null=null;
  for(const f of floors)if(contains(f.bounds,x,z)&&(height===null||f.height>height))height=f.height;
  return height;
 }
 function zoneAt(x:number,z:number){
  let match:typeof zones[number]|null=null;
  for(const zone of zones)if(contains(zone.bounds,x,z)&&(!match||(zone.bounds[2]-zone.bounds[0])*(zone.bounds[3]-zone.bounds[1])<(match.bounds[2]-match.bounds[0])*(match.bounds[3]-match.bounds[1])))match=zone;
  return match;
 }
 function nearbyLandmark(x:number,z:number,maxMetres=4){
  let match:typeof landmarks[number]|null=null,distance=Math.max(0,maxMetres)*PALACE_METRES_TO_SCENE;
  for(const landmark of landmarks){const next=Math.hypot(x-landmark.position[0],z-landmark.position[2]);if(next<=distance){match=landmark;distance=next;}}
  return match;
 }
 function createExplorer(saved?:PalaceExplorePose){
  const c=createFreeExplorer({initialPosition:{x:sceneSpawn[0],y:sceneSpawn[1]+FREE_EXPLORER.eyeHeight,z:sceneSpawn[2]},
   initialDirection:{x:Math.sin(document.spawn.yaw),y:0,z:Math.cos(document.spawn.yaw)},sampleGround,colliders,
   radius:.035,eyeHeight:.16,speed:.26,boost:.48,maxStepHeight:.019,maxDropHeight:.021});
  if(Math.abs(c.pose().groundY-sceneSpawn[1])>1e-6)throw new Error('宫观入口高度不匹配');
  if(saved)c.restore(saved);
  return c;
 }
 // Validate the full spawn footprint and collider clearance before creating any renderer.
 createExplorer();
 return{document,bounds:sceneBounds,spawn:sceneSpawn,floors,zones,landmarks,colliders,sampleGround,zoneAt,nearbyLandmark,createExplorer};
}
export type PalaceNavigation=ReturnType<typeof createPalaceNavigation>;
