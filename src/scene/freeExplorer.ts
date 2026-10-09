/** Scene-space walking: 1 unit = 10 metres. Water and page scroll have separate owners. */
export type ExplorerPoint = {readonly x:number;readonly y:number;readonly z:number};
export type ExplorerCollider =
 | {min:{x:number;y?:number;z:number};max:{x:number;y?:number;z:number}}
 | {minX:number;maxX:number;minZ:number;maxZ:number;minY?:number;maxY?:number}
 | {kind?:'box';center:readonly number[]|ExplorerPoint;halfSize:readonly number[]|ExplorerPoint;rotationY?:number;id?:string};
export type FreeExplorerOptions = {
 initialPosition:ExplorerPoint; initialDirection?:ExplorerPoint;
 sampleGround:(x:number,z:number)=>number|null;
 colliders?:readonly ExplorerCollider[]; isBlocked?:(x:number,z:number,radius:number)=>boolean;
 radius?:number;eyeHeight?:number;speed?:number;boost?:number;
 maxSlopeRadians?:number;maxStepHeight?:number;maxDropHeight?:number;groundFollowRate?:number;
};
export type FreeExplorerSnapshot = {
 position:ExplorerPoint;groundY:number;smoothedGroundY:number;yaw:number;pitch:number;suspended:boolean;
 input:{forward:number;right:number;fast:boolean};
};
export const FREE_EXPLORER = Object.freeze({
 radius:.035,eyeHeight:.16,speed:.24,boost:.42,maxPitchRadians:Math.PI*75/180,
 maxSlopeRadians:Math.PI*48/180,maxStepHeight:.045,maxDropHeight:.05,groundFollowRate:16,
});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const finiteAxis=(v:number)=>Number.isFinite(v)?clamp(v,-1,1):0;
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const xyz=(p:readonly number[]|ExplorerPoint):ExplorerPoint=>Array.isArray(p)?{x:p[0],y:p[1],z:p[2]}:p as ExplorerPoint;

/** Only pose is persisted. Physical key/touch holds are deliberately cleared on restore. */
export function createFreeExplorer(options:FreeExplorerOptions) {
 const radius=options.radius??FREE_EXPLORER.radius,eyeHeight=options.eyeHeight??FREE_EXPLORER.eyeHeight;
 const speed=options.speed??FREE_EXPLORER.speed,boost=options.boost??FREE_EXPLORER.boost;
 const slope=options.maxSlopeRadians??FREE_EXPLORER.maxSlopeRadians,stepHeight=options.maxStepHeight??FREE_EXPLORER.maxStepHeight;
 const dropHeight=options.maxDropHeight??FREE_EXPLORER.maxDropHeight,followRate=options.groundFollowRate??FREE_EXPLORER.groundFollowRate;
 if(![radius,eyeHeight,speed,boost,slope,stepHeight,dropHeight,followRate].every(v=>Number.isFinite(v)&&v>0)||slope>=Math.PI/2)throw new Error('Invalid free explorer dimensions');
 if(![options.initialPosition.x,options.initialPosition.y,options.initialPosition.z].every(Number.isFinite))throw new Error('Invalid free explorer start');
 const direction=options.initialDirection??{x:0,y:0,z:-1};
 if(![direction.x,direction.y,direction.z].every(Number.isFinite)||Math.hypot(direction.x,direction.y,direction.z)===0)throw new Error('Invalid free explorer direction');
 let x=options.initialPosition.x,z=options.initialPosition.z,yaw=Math.atan2(direction.x,direction.z),pitch=clamp(Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),-FREE_EXPLORER.maxPitchRadians,FREE_EXPLORER.maxPitchRadians);
 let groundY=0,smoothedGroundY=0,suspended=false,input={forward:0,right:0,fast:false};
 const boxes=(options.colliders??[]).map(c=>{
  if('center' in c){const p=xyz(c.center),h=xyz(c.halfSize),rotation=c.rotationY??0;if(![p.x,p.y,p.z,h.x,h.y,h.z,rotation].every(Number.isFinite)||h.x<0||h.y<0||h.z<0)throw new Error('Invalid explorer collider');return{cx:p.x,cz:p.z,minX:-h.x,maxX:h.x,minZ:-h.z,maxZ:h.z,minY:p.y-h.y,maxY:p.y+h.y,rotation};}
  const b='min' in c?{minX:c.min.x,maxX:c.max.x,minZ:c.min.z,maxZ:c.max.z,minY:c.min.y??-Infinity,maxY:c.max.y??Infinity}:c;
  if(![b.minX,b.maxX,b.minZ,b.maxZ].every(Number.isFinite)||b.maxX<b.minX||b.maxZ<b.minZ)throw new Error('Invalid explorer collider');
  return{...b,minY:b.minY??-Infinity,maxY:b.maxY??Infinity,cx:0,cz:0,rotation:0};
 });
 function blocked(px:number,pz:number,g:number){
  if(options.isBlocked?.(px,pz,radius))return true;
  for(const b of boxes){
   if(g>=b.maxY||g+eyeHeight+.02<=b.minY)continue;
   const dx=px-b.cx,dz=pz-b.cz,c=Math.cos(b.rotation),s=Math.sin(b.rotation),lx=c*dx-s*dz,lz=s*dx+c*dz;
   const qx=clamp(lx,b.minX,b.maxX),qz=clamp(lz,b.minZ,b.maxZ);
   if((lx-qx)**2+(lz-qz)**2<radius*radius-1e-12)return true;
  }
  return false;
 }
 function groundAt(px:number,pz:number,previous?:number){
  const g=options.sampleGround(px,pz);if(g===null||!Number.isFinite(g))return null;
  if(previous!==undefined&&(g-previous>stepHeight+1e-10||previous-g>dropHeight+1e-10))return null;
  const ring:number[]=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4,h=options.sampleGround(px+Math.cos(a)*radius,pz+Math.sin(a)*radius);if(h===null||!Number.isFinite(h))return null;ring.push(h);}
  const gx=(ring[0]-ring[4])/(2*radius),gz=(ring[2]-ring[6])/(2*radius);
  if(Math.hypot(gx,gz)>Math.tan(slope)+1e-10||blocked(px,pz,g))return null;
  return g;
 }
 const initial=groundAt(x,z);if(initial===null)throw new Error('Free explorer start is outside walkable ground');
 groundY=smoothedGroundY=initial;
 function pose(){const eye={x,y:smoothedGroundY+eyeHeight,z};return{position:eye,eye,groundY,yaw,pitch,direction:{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)}};}
 function snapshot():FreeExplorerSnapshot{return{position:{x,y:smoothedGroundY+eyeHeight,z},groundY,smoothedGroundY,yaw,pitch,suspended,input:{...input}};}
 function clearInput(){input={forward:0,right:0,fast:false};}
 function advance(deltaSeconds:number){
  const dt=clamp(Number.isFinite(deltaSeconds)?deltaSeconds:0,0,.1);if(suspended||dt===0)return pose();
  const norm=Math.max(1,Math.hypot(input.forward,input.right)),f=input.forward/norm,r=input.right/norm,v=input.fast?boost:speed;
  const dx=(Math.sin(yaw)*f-Math.cos(yaw)*r)*v*dt,dz=(Math.cos(yaw)*f+Math.sin(yaw)*r)*v*dt;
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/Math.min(.012,radius*.35))),sx=dx/count,sz=dz/count;
  // Every intermediate footprint is tested. If the diagonal is blocked, try tangential axes.
  for(let i=0;i<count;i++){
   if(sx===0&&sz===0)break;
   const direct=groundAt(x+sx,z+sz,groundY);
   if(direct!==null){x+=sx;z+=sz;groundY=direct;continue;}
   if(sx!==0){const gx=groundAt(x+sx,z,groundY);if(gx!==null){x+=sx;groundY=gx;}}
   if(sz!==0){const gz=groundAt(x,z+sz,groundY);if(gz!==null){z+=sz;groundY=gz;}}
  }
  smoothedGroundY+=(groundY-smoothedGroundY)*(1-Math.exp(-dt*followRate));return pose();
 }
 function restore(saved:FreeExplorerSnapshot){
  if(![saved.position.x,saved.position.y,saved.position.z,saved.groundY,saved.smoothedGroundY,saved.yaw,saved.pitch].every(Number.isFinite)||Math.abs(saved.pitch)>FREE_EXPLORER.maxPitchRadians+1e-10)throw new Error('Invalid explorer snapshot');
  const g=groundAt(saved.position.x,saved.position.z);if(g===null||Math.abs(g-saved.groundY)>1e-6)throw new Error('Explorer snapshot no longer matches walkable ground');
  x=saved.position.x;z=saved.position.z;groundY=saved.groundY;smoothedGroundY=saved.smoothedGroundY;yaw=saved.yaw;pitch=saved.pitch;suspended=saved.suspended;clearInput();return pose();
 }
 return{pose,snapshot,advance,restore,clearInput,
  look(deltaYaw:number,deltaPitch=0){if(suspended||!Number.isFinite(deltaYaw)||!Number.isFinite(deltaPitch))return;yaw=angle(yaw+deltaYaw);pitch=clamp(pitch+deltaPitch,-FREE_EXPLORER.maxPitchRadians,FREE_EXPLORER.maxPitchRadians);},
  setInput(forward:number,right:number,fast=false){if(suspended){clearInput();return;}input={forward:finiteAxis(forward),right:finiteAxis(right),fast:Boolean(fast)};},
  setSuspended(value:boolean){suspended=value;if(value)clearInput();},
 };
}
export type FreeExplorerController=ReturnType<typeof createFreeExplorer>;
