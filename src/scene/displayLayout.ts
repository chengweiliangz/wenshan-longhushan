import {placeAssets} from '../../shared/catalog.mjs';
import {geoToWorld} from '../../shared/geography.mjs';

/** Artistic presentation coordinates only. The evidence registry and source GLBs stay intact. */
export type DisplayId='zhengyi'|'tianshi'|'shangqing';
export type DisplayXZ=[number,number];
export type DisplayPoint=[number,number,number];
export type DisplayBounds=[number,number,number,number];
export type DisplayWalkable={kind:'polygon';id:string;polygonXZ:DisplayXZ[]}|{kind:'capsule';id:string;a:DisplayXZ;b:DisplayXZ;radius:number};
export type DisplayCollider={kind:'box';id:string;center:DisplayPoint;halfSize:DisplayPoint;rotationY:number};
export type DisplayLayout={
 id:DisplayId;label:string;artistic:boolean;notice:string;
 trueGeo:{coordinates:number[];position:DisplayPoint;bearing:number;source:string};
 model:{position:DisplayPoint;rotationY:number;scale:number};displacementMeters:number;
 modelBoundsMeters:{min:DisplayPoint;max:DisplayPoint};
 arrivalLookAt:DisplayPoint;arrivalView:{yaw:number;pitch:number};entrance:DisplayPoint;
 support:{localBoundsModelMeters:DisplayBounds;polygonXZ:DisplayXZ[];boundsXZ:DisplayBounds;blendMeters:number};
 mapBoundsXZ:DisplayBounds;walkable:DisplayWalkable[];colliders:DisplayCollider[];
 landing:{artistic:boolean;waterAnchor:DisplayPoint;waterStop:DisplayPoint;shorePoint:DisplayPoint;boatPath:DisplayPoint[];walkPath:DisplayPoint[];widthScene:number};
 viewCorridor:{localHalfWidthMeters:number;localStartZ:number};
};
export type DisplaySamplers={waterAt:(x:number,z:number)=>number;groundAt:(x:number,z:number)=>number;containsWater:(x:number,z:number)=>boolean};
const M=10, clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const labels={zhengyi:'正一观',tianshi:'嗣汉天师府',shangqing:'大上清宫'};
const defs={
 tianshi:{positionXZ:[322.8155872443704,256.4438403380419] as DisplayXZ,rotationY:-0.08726646259971647,arrivalXZ:[320.6192625271294,281.54794672995394] as DisplayXZ,bankDistance:61.5,centerDistance:252,bounds:[-67,-108,63,181] as DisplayBounds,min:[-59.779998779296875,-3.450000047683716,-98.43820190429688] as DisplayPoint,max:[55.24250030517578,13.135000228881836,174.7430877685547] as DisplayPoint,entryZ:140,gateZ:131.5},
 zhengyi:{positionXZ:[-245.14574061967693,44.97803680003716] as DisplayXZ,rotationY:-1.2895565678057344,arrivalXZ:[-261.8621309061047,49.80735308620257] as DisplayXZ,bankDistance:45,centerDistance:174,bounds:[-40,-44,42,123] as DisplayBounds,min:[-31.08,-3.82135,-38.39515] as DisplayPoint,max:[33.45204,15.235,119.2] as DisplayPoint,entryZ:83,gateZ:73},
 shangqing:{positionXZ:[413.2815959162625,285.24866334287384] as DisplayXZ,rotationY:-.8624165904978749,arrivalXZ:[398.3210805694325,298.06556548642095] as DisplayXZ,bankDistance:73,centerDistance:197,bounds:[-50,-56,50,108] as DisplayBounds,min:[-42.7,-2.4,-50.7] as DisplayPoint,max:[42.7,14.9,104] as DisplayPoint,entryZ:88,gateZ:50},
};
/** Static X/Z for light UI imports; createDisplayLayouts supplies final Y and exact collision polygons. */
export const DISPLAY_MAP_DEFINITIONS=[
 {id:'river',label:'泸溪河',positionXZ:[-364.28709758532386,-55.9820410788695] as DisplayXZ,artistic:false},
 {id:'zhengyi',label:'正一观',positionXZ:defs.zhengyi.positionXZ,artistic:true},
 {id:'tianshi',label:'嗣汉天师府',positionXZ:defs.tianshi.positionXZ,artistic:true},
 {id:'shangqing',label:'大上清宫',positionXZ:defs.shangqing.positionXZ,artistic:true},
] as const;
export function displayToWorld(layout:DisplayLayout,p:readonly number[]):DisplayPoint{
 const {position:o,rotationY:a,scale:s}=layout.model,c=Math.cos(a),n=Math.sin(a);
 return[o[0]+s*(c*p[0]+n*p[2]),o[1]+s*p[1],o[2]+s*(-n*p[0]+c*p[2])];
}
export function worldToDisplayLocal(layout:DisplayLayout,p:readonly number[]):DisplayPoint{
 const {position:o,rotationY:a,scale:s}=layout.model,c=Math.cos(a),n=Math.sin(a),x=p[0]-o[0],z=p[2]-o[2];
 return[(c*x-n*z)/s,(p[1]-o[1])/s,(n*x+c*z)/s];
}
function polygon(layout:DisplayLayout,b:DisplayBounds):DisplayXZ[]{return[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,z])=>{const p=displayToWorld(layout,[x,0,z]);return[p[0],p[2]];});}
function bounds(points:DisplayXZ[]):DisplayBounds{return[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
export function displayContainsXZ(x:number,z:number,poly:readonly DisplayXZ[]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function segment(x:number,z:number,a:readonly number[],b:readonly number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));return{t,d:Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)};}
export function displayInWalkable(layout:DisplayLayout,x:number,z:number){return layout.walkable.some(w=>w.kind==='polygon'?displayContainsXZ(x,z,w.polygonXZ):segment(x,z,w.a,w.b).d<=w.radius);}
export function displayIsBlocked(layout:DisplayLayout,x:number,z:number,radius=.035){
 if(!displayInWalkable(layout,x,z)||[[radius,0],[-radius,0],[0,radius],[0,-radius]].some(([dx,dz])=>!displayInWalkable(layout,x+dx,z+dz)))return true;
 for(const b of layout.colliders){const a=b.rotationY,dx=x-b.center[0],dz=z-b.center[2],u=Math.cos(a)*dx-Math.sin(a)*dz,v=Math.sin(a)*dx+Math.cos(a)*dz;if(Math.abs(u)<b.halfSize[0]+radius&&Math.abs(v)<b.halfSize[2]+radius)return true;}
 return false;
}
/** Top of original model paving where available; conservative exterior exploration only. */
function localWalkHeight(id:DisplayId,x:number,z:number){
 if(id==='zhengyi')return z>=81&&Math.abs(x)<=2.6?-1.65:-.65-.5*smooth(63,71,z)-.8*smooth(74,79,z);
 if(id==='shangqing'){if(z>=50&&z<=81&&Math.abs(x)<41.5)return-2.1;const original=-.35-2.25*smooth(46,49,z),outerSupport=-.33-2.04*smooth(46,49,z);return original+(outerSupport-original)*smooth(41.5,44,Math.abs(x));}
 return-.38-2.89*smooth(50,130,z);
}
function supportGrade(id:DisplayId,_x:number,z:number){
 if(id==='zhengyi')return-.65-.5*smooth(63,71,z)-.8*smooth(74,79,z);
 if(id==='shangqing')return-.35-2.04*smooth(46,49,z);
 return-.4-2.89*smooth(50,130,z);
}
function pathHeight(layout:DisplayLayout,x:number,z:number,padding=0){
 let best:{d:number;y:number}|null=null;const path=layout.landing.walkPath;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],q=segment(x,z,[a[0],a[2]],[b[0],b[2]]);if(q.d<=layout.landing.widthScene/2+padding&&(!best||q.d<best.d))best={d:q.d,y:a[1]+(b[1]-a[1])*q.t};}
 return best;
}
/** Continuous walk surface, including raft departure, pier, ramp and dry forecourt; null off the bounded route. */
export function getDisplayGround(layout:DisplayLayout,x:number,z:number):number|null{
 if(!displayInWalkable(layout,x,z))return null;
 const q=pathHeight(layout,x,z);if(q)return q.y;
 const p=worldToDisplayLocal(layout,[x,layout.model.position[1],z]);return layout.model.position[1]+localWalkHeight(layout.id,p[0],p[2])*layout.model.scale;
}
export function displayWalkHeight(layout:DisplayLayout,x:number,z:number,fallback:number){return getDisplayGround(layout,x,z)??fallback;}
/** Dense support and the regional source terrain must share this function. Water remains untouched. */
export function displayGroundOverride(layouts:Record<DisplayId,DisplayLayout>|readonly DisplayLayout[],x:number,z:number,sourceY:number,containsWater?:(x:number,z:number)=>boolean){
 if(containsWater?.(x,z))return sourceY;
 let y=sourceY;
 for(const l of Array.isArray(layouts)?layouts:Object.values(layouts)){
  if(!l.artistic)continue;const p=worldToDisplayLocal(l,[x,l.model.position[1],z]),b=l.support.localBoundsModelMeters;
  const outside=Math.max(0,b[0]-p[0],p[0]-b[2],b[1]-p[2],p[2]-b[3])*l.model.scale*M,weight=1-smooth(0,l.support.blendMeters,outside);
  if(weight>0){const target=l.model.position[1]+supportGrade(l.id,p[0],p[2])*l.model.scale;y+=(target-y)*weight;}
  const path=pathHeight(l,x,z,.65);if(path&&!(l.id==='tianshi'&&outside===0)){const t=1-smooth(l.landing.widthScene/2,l.landing.widthScene/2+.65,path.d);y+=(path.y-.018-y)*t;}
 }
 return y;
}
export function createDisplayGroundOverride(layouts:Record<DisplayId,DisplayLayout>,containsWater:(x:number,z:number)=>boolean){return(x:number,z:number,sourceY:number)=>displayGroundOverride(layouts,x,z,sourceY,containsWater);}
export function createDisplayLayouts(sample:DisplaySamplers):Record<DisplayId,DisplayLayout>{
 const layouts={} as Record<DisplayId,DisplayLayout>;
 for(const id of ['zhengyi','tianshi','shangqing'] as const){
  const geo=placeAssets[id].geo,world=geoToWorld(geo.coordinates),truePosition:DisplayPoint=[world[0]/M,geo.elevation.meters/M,world[1]/M],artistic=true,d=defs[id];
  const modelScale=geo.alignment.modelScale/M,anchorXZ:DisplayXZ=d?d.arrivalXZ:[321.8117529229527,281.6819864847625];
  const waterY=sample.waterAt(anchorXZ[0],anchorXZ[1]);if(!Number.isFinite(waterY))throw new Error('Display arrival has no production water');
  const pos:DisplayPoint=d?[d.positionXZ[0],waterY+(id==='tianshi'?.75:.35),d.positionXZ[1]]:[...truePosition];
  const model={position:pos,rotationY:d?d.rotationY:-geo.bearing*Math.PI/180,scale:modelScale};
  const l:DisplayLayout={id,label:labels[id],artistic,notice:artistic?'沿岸场景经艺术化布局；建筑保持原有模型比例，非实地导航坐标。':'保留真实影像配准位置；外部步行范围为展示估计。',trueGeo:{coordinates:[...geo.coordinates],position:truePosition,bearing:geo.bearing,source:geo.source},model,displacementMeters:Math.hypot(pos[0]-truePosition[0],pos[2]-truePosition[2])*M,modelBoundsMeters:{min:d?d.min:[-59.78,-3.45,-98.44],max:d?d.max:[55.25,13.135,174.75]},arrivalLookAt:[0,0,0],arrivalView:{yaw:0,pitch:0},entrance:[0,0,0],support:{localBoundsModelMeters:d?d.bounds:[-66,-110,63,180],polygonXZ:[],boundsXZ:[0,0,0,0],blendMeters:40},mapBoundsXZ:[0,0,0,0],walkable:[],colliders:[],landing:{artistic,waterAnchor:[anchorXZ[0],waterY,anchorXZ[1]],waterStop:[anchorXZ[0],waterY,anchorXZ[1]],shorePoint:[anchorXZ[0],waterY,anchorXZ[1]],boatPath:[],walkPath:[],widthScene:id==='shangqing'?.46:id==='tianshi'?.42:.36},viewCorridor:{localHalfWidthMeters:id==='shangqing'?23:id==='tianshi'?22:17,localStartZ:20}};
  l.support.polygonXZ=polygon(l,l.support.localBoundsModelMeters);l.support.boundsXZ=bounds(l.support.polygonXZ);
  const addRegion=(name:string,b:DisplayBounds)=>l.walkable.push({kind:'polygon',id:name,polygonXZ:polygon(l,b)});
  const addBox=(name:string,b:DisplayBounds,height=8)=>{const c=displayToWorld(l,[(b[0]+b[2])/2,height/2,(b[1]+b[3])/2]);l.colliders.push({kind:'box',id:name,center:c,halfSize:[(b[2]-b[0])*modelScale/2,height*modelScale/2,(b[3]-b[1])*modelScale/2],rotationY:model.rotationY});};
  if(id==='zhengyi'){
   addRegion('front-garden',[-30,81.1,32,122]);addRegion('west-exterior',[-39,-41,-33,118]);addRegion('east-exterior',[34,-41,41,118]);addRegion('rear-exterior',[-39,-43,41,-39]);addRegion('front-side-link',[-39,109,41,121]);
   addBox('complete-courtyard-conservative',[-32,-39,33,80.8],16);
  }else if(id==='shangqing'){
   addRegion('outer-forecourt',[-39,83.2,39,106]);addRegion('west-exterior',[-49,-54,-44,104]);addRegion('east-exterior',[44,-54,49,104]);addRegion('rear-exterior',[-49,-55,49,-51.6]);addRegion('front-side-link',[-49,98,49,106]);
   addBox('facility-and-walled-court',[-43,-51,43,82.7],16);
  }else{
   addRegion('head-gate-forecourt',[-29,135.2,40,179.5]);addRegion('west-exterior',[-66,-105,-62,176]);addRegion('east-exterior',[59,-105,62,176]);addRegion('rear-exterior',[-66,-107,62,-102]);addRegion('front-side-link',[-66,169,62,180]);
   addBox('palace-and-head-gate-conservative',[-61,-101,58,134.4],16);
  }
  const entryZ=d?d.entryZ:157;l.entrance=displayToWorld(l,[0,localWalkHeight(id,0,entryZ),entryZ]);
  l.arrivalLookAt=displayToWorld(l,[id==='tianshi'?.8562:0,id==='zhengyi'?3.4:id==='shangqing'?3.2:1.4,d?d.gateZ:130]);
  const to=l.arrivalLookAt,a=l.landing.waterAnchor;l.arrivalView={yaw:Math.atan2(to[0]-a[0],to[2]-a[2]),pitch:Math.atan2(to[1]-a[1]-.12,Math.hypot(to[0]-a[0],to[2]-a[2]))};
  if(d){
   const nx=(pos[0]-anchorXZ[0])/(d.centerDistance/M),nz=(pos[2]-anchorXZ[1])/(d.centerDistance/M),along=(metres:number,y:number):DisplayPoint=>[anchorXZ[0]+nx*metres/M,y,anchorXZ[1]+nz*metres/M];
   l.landing.waterStop=along(d.bankDistance-12,waterY);l.landing.shorePoint=along(d.bankDistance+2,waterY+(id==='tianshi'?.37:id==='zhengyi'?.135:.085));
   const steps=Math.ceil((d.bankDistance-12)/2);l.landing.boatPath=Array.from({length:steps+1},(_,i)=>along((d.bankDistance-12)*i/steps,waterY));
   const frontZ=d.bounds[3]-(id==='tianshi'?0:3),front=displayToWorld(l,[0,localWalkHeight(id,0,frontZ),frontZ]);
   l.landing.walkPath=[along(0,waterY+.022),along(d.bankDistance-12,waterY+(id==='tianshi'?.28:.065)),l.landing.shorePoint,front,l.entrance];
   for(let i=1;i<l.landing.walkPath.length;i++){const a=l.landing.walkPath[i-1],b=l.landing.walkPath[i];l.walkable.push({kind:'capsule',id:'landing-'+i,a:[a[0],a[2]],b:[b[0],b[2]],radius:l.landing.widthScene/2});}
   for(const p of l.landing.boatPath)if(!sample.containsWater(p[0],p[2]))throw new Error(id+' artistic water approach crosses mapped land');
   for(const p of l.support.polygonXZ)if(sample.containsWater(p[0],p[1]))throw new Error(id+' support footprint crosses mapped water');
  }
  const all=[...l.support.polygonXZ,...l.landing.walkPath.map(p=>[p[0],p[2]] as DisplayXZ)];l.mapBoundsXZ=bounds(all);layouts[id]=l;
 }
 return layouts;
}
