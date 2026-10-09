import {geoToWorld} from './geography.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inRing=(x,z,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const closest=(x,z,s)=>{const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],t=clamp(((x-s.a[0])*dx+(z-s.a[2])*dz)/Math.max(1e-12,dx*dx+dz*dz),0,1);return {t,d:Math.hypot(x-s.a[0]-dx*t,z-s.a[2]-dz*t),x:s.a[0]+dx*t,z:s.a[2]+dz*t,dx,dz};};
/** The domain keeps exact OSM mapped shore/island shapes. Height and depth are
 * display estimates constrained by the existing downstream DEM profile. */
export function createWaterDomain(sources,points) {
 const polygons=sources.map(s=>{const convert=r=>r.map(c=>geoToWorld(c).map(v=>v/10));const outer=convert(s.outer),holes=s.holes.map(convert);return {outer,holes,exposedHoleIndices:s.exposedHoleIndices||[],bounds:[Math.min(...outer.map(p=>p[0])),Math.min(...outer.map(p=>p[1])),Math.max(...outer.map(p=>p[0])),Math.max(...outer.map(p=>p[1]))]};});
 const edges=[],route=[],buckets=new Map(),flowBuckets=new Map(),cell=20;let length=0;const distances=[0];
 const add=(map,s,padding)=>{for(let x=Math.floor((Math.min(s.a[0],s.b[0])-padding)/cell);x<=Math.floor((Math.max(s.a[0],s.b[0])+padding)/cell);x++)for(let z=Math.floor((Math.min(s.a[2],s.b[2])-padding)/cell);z<=Math.floor((Math.max(s.a[2],s.b[2])+padding)/cell);z++){const key=`${x}:${z}`;if(!map.has(key))map.set(key,[]);map.get(key).push(s);}};
 for(const polygon of polygons)for(const [i,ring]of [polygon.outer,...polygon.holes].entries())for(let j=1;j<ring.length;j++){const a=ring[j-1],b=ring[j],s={a:[a[0],0,a[1]],b:[b[0],0,b[1]],island:i>0,exposed:polygon.exposedHoleIndices.includes(i-1)};edges.push(s);add(buckets,s,5);}
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],segmentLength=Math.hypot(b[0]-a[0],b[2]-a[2])*10,s={a,b,start:length,length:segmentLength};route.push(s);add(flowBuckets,s,30);length+=segmentLength;distances.push(length);}
 const contains=(x,z)=>polygons.some(p=>x>=p.bounds[0]&&x<=p.bounds[2]&&z>=p.bounds[1]&&z<=p.bounds[3]&&inRing(x,z,p.outer)&&!p.holes.some(h=>inRing(x,z,h)));
 const flow=(x,z)=>{let best=null,segment=null;for(const s of flowBuckets.get(`${Math.floor(x/cell)}:${Math.floor(z/cell)}`)||route){const q=closest(x,z,s);if(!best||q.d<best.d){best=q;segment=s;}}
  if(!best||!segment)throw new Error('Missing sourced river route');const norm=Math.hypot(best.dx,best.dz)||1,tx=best.dx/norm,tz=best.dz/norm;return {level:segment.a[1]+(segment.b[1]-segment.a[1])*best.t,s:segment.start+segment.length*best.t,across:((x-best.x)*-tz+(z-best.z)*tx)*10,tx,tz,centerDistance:best.d};};
 const sample=(x,z)=>{let distance=Infinity,islandDistance=Infinity,exposedDistance=Infinity;for(const s of buckets.get(`${Math.floor(x/cell)}:${Math.floor(z/cell)}`)||[]){const q=closest(x,z,s);distance=Math.min(distance,q.d);if(s.island)islandDistance=Math.min(islandDistance,q.d);if(s.exposed)exposedDistance=Math.min(exposedDistance,q.d);}
  const inside=contains(x,z),f=inside||distance<4?flow(x,z):{level:0,s:0,across:0,tx:0,tz:1,centerDistance:Infinity};return {...f,inside,shoreDistance:distance,islandDistance,exposedDistance};};
 return {polygons,sample,flow,contains,length,distances};
}
