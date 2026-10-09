import * as THREE from 'three';
import {createPalaceNavigation,type PalaceNavigation} from '../palaceExploreNavigation';
import {displayToWorld,worldToDisplayLocal,getDisplayGround,displayIsBlocked,type DisplayLayout,type DisplayId} from './displayLayout';
/** Original building coordinates remain the outer reference. These compact courtyards are artistic inserts. */
export const WORLD_PALACE={
 zhengyi:{offset:[0,-.38,55],approachZ:87,halfWidth:1.7},
 tianshi:{offset:[.8562,-3.27,111],approachZ:142,halfWidth:1.5},
 shangqing:{offset:[0,-2.075,64],approachZ:105.5,halfWidth:1.9},
} as const;
export function createWorldPalace(layout:DisplayLayout,value:unknown){
 const nav=createPalaceNavigation(value,layout.id),def=WORLD_PALACE[layout.id],offset=def.offset,b=nav.document.bounds;
 const bounds:[number,number,number,number]=[b[0]+offset[0],b[1]+offset[2],b[2]+offset[0],b[3]+offset[2]];
 const outer=displayToWorld(layout,[offset[0],0,def.approachZ]),outerHeight=(getDisplayGround(layout,outer[0],outer[2])!-layout.model.position[1])/layout.model.scale;
 const local=(x:number,z:number)=>worldToDisplayLocal(layout,[x,layout.model.position[1],z]);
 const inside=(x:number,z:number)=>x>=bounds[0]&&x<=bounds[2]&&z>=bounds[1]&&z<=bounds[3];
 const onLink=(x:number,z:number)=>Math.abs(x-offset[0])<=def.halfWidth&&z>=bounds[3]-.5&&z<=def.approachZ;
 function linkHeight(z:number){const t=THREE.MathUtils.clamp((z-bounds[3])/(def.approachZ-bounds[3]),0,1);return offset[1]+(outerHeight-offset[1])*t;}
 function ground(x:number,z:number):number|null{
  const q=local(x,z);
  if(inside(q[0],q[2])){const y=nav.sampleGround((q[0]-offset[0])*.1,(q[2]-offset[2])*.1);return y===null?null:layout.model.position[1]+(y*10+offset[1])*layout.model.scale;}
  if(onLink(q[0],q[2]))return layout.model.position[1]+linkHeight(q[2])*layout.model.scale;
  return getDisplayGround(layout,x,z);
 }
 function blocked(x:number,z:number,r:number){
  const q=local(x,z),radius=r/layout.model.scale;
  if(!inside(q[0],q[2])&&!onLink(q[0],q[2]))return displayIsBlocked(layout,x,z,r);
  // Check continuous floor union before colliders; no invisible jump between controllers.
  for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]])if(ground(x+dx,z+dz)===null)return true;
  const lx=q[0]-offset[0],lz=q[2]-offset[2],h=inside(q[0],q[2])?(nav.sampleGround(lx*.1,lz*.1)??0)*10:linkHeight(q[2])-offset[1];
  for(const c of nav.document.colliders){if(h>=c.max[1]||h+1.8<=c.min[1])continue;const xx=THREE.MathUtils.clamp(lx,c.min[0],c.max[0]),zz=THREE.MathUtils.clamp(lz,c.min[2],c.max[2]);if((lx-xx)**2+(lz-zz)**2<radius*radius)return true;}
  return false;
 }
 function zone(x:number,z:number){const q=local(x,z);return inside(q[0],q[2])?nav.zoneAt((q[0]-offset[0])*.1,(q[2]-offset[2])*.1)?.label??'内部连接步道':onLink(q[0],q[2])?'山门连接步道':'沿岸与外院';}
 const entry=displayToWorld(layout,[offset[0],offset[1],bounds[3]-2.5]);
 return{nav,def,bounds,offset,outerHeight,linkHeight,ground,blocked,zone,entry,insideWorld:(x:number,z:number)=>{const q=local(x,z);return inside(q[0],q[2]);}};
}
export type WorldPalace=ReturnType<typeof createWorldPalace>;
export type WorldPalaces=Partial<Record<DisplayId,WorldPalace>>;
export type {PalaceNavigation};
