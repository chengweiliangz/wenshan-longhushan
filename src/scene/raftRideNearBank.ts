import * as THREE from 'three';
export type TourDomain={contains:(x:number,z:number)=>boolean;sample:(x:number,z:number)=>{inside:boolean;shoreDistance:number;level:number};flow:(x:number,z:number)=>{level:number}};
/** Optional display tour inside the unchanged mapped polygon. It is not a surveyed navigation channel. */
export function createNearBankTourPath(points:readonly THREE.Vector3[],distances:readonly number[],domain:TourDomain,startS:number,endS:number,insetMeters=12,side=-1){
 const original=(s:number)=>{s=THREE.MathUtils.clamp(s,distances[0],distances.at(-1)!);let lo=0,hi=points.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(distances[m]<=s)lo=m;else hi=m;}return points[lo].clone().lerp(points[hi],(s-distances[lo])/(distances[hi]-distances[lo]));};
 const count=Math.ceil((endS-startS)/2),samples:{s:number;position:THREE.Vector3;offsetMeters:number}[]=[],desired:number[]=[],centers:THREE.Vector3[]=[],normals:THREE.Vector3[]=[];
 for(let i=0;i<=count;i++){const s=THREE.MathUtils.lerp(startS,endS,i/count),p=original(s),t=original(s+8).sub(original(s-8)).setY(0).normalize(),n=new THREE.Vector3(-t.z,0,t.x).multiplyScalar(side);let edge=0;while(edge<12&&domain.contains(p.x+n.x*edge,p.z+n.z*edge))edge+=.1;let lo=Math.max(0,edge-.1),hi=edge;for(let k=0;k<15;k++){const m=(lo+hi)/2;if(domain.contains(p.x+n.x*m,p.z+n.z*m))lo=m;else hi=m;}centers.push(p);normals.push(n);desired.push(Math.min(3,Math.max(0,lo-insetMeters/10)));}
 for(let i=0;i<=count;i++){let weight=0,offset=0;for(let j=Math.max(0,i-10);j<=Math.min(count,i+10);j++){const w=11-Math.abs(i-j);offset+=desired[j]*w;weight+=w;}offset/=weight;const travelled=(endS-startS)*i/count;offset*=1-THREE.MathUtils.smoothstep(travelled,250,400);const p=centers[i].clone(),n=normals[i];let q=p.clone().addScaledVector(n,offset);while(offset>.001&&(!domain.contains(q.x,q.z)||domain.sample(q.x,q.z).shoreDistance<.8)){offset*=.88;q.copy(p).addScaledVector(n,offset);}q.y=domain.flow(q.x,q.z).level;samples.push({s:THREE.MathUtils.lerp(startS,endS,i/count),position:q,offsetMeters:offset*10});}
 // Keep offset variation gradual and below a conservative fraction of local turn radius.
 // This prevents the clearance clamp from making lateral jumps on a narrow bend.
 const safeOffsets=samples.map((q,i)=>{const before=normals[Math.max(0,i-1)],after=normals[Math.min(count,i+1)],span=(Math.min(count,i+1)-Math.max(0,i-1))*(endS-startS)/count,dn=before.distanceTo(after);return Math.min(q.offsetMeters/10,dn>1e-8?.32*span/(dn*10):Infinity);});
 const maxStep=.15*(endS-startS)/count/10;
 for(let i=1;i<=count;i++)safeOffsets[i]=Math.min(safeOffsets[i],safeOffsets[i-1]+maxStep);
 for(let i=count-1;i>=0;i--)safeOffsets[i]=Math.min(safeOffsets[i],safeOffsets[i+1]+maxStep);
 samples.forEach((q,i)=>{q.offsetMeters=safeOffsets[i]*10;q.position.copy(centers[i]).addScaledVector(normals[i],safeOffsets[i]);q.position.y=domain.flow(q.position.x,q.position.z).level;});
 const sample=(s:number,out=new THREE.Vector3())=>{const u=THREE.MathUtils.clamp((s-startS)/(endS-startS)*count,0,count),i=Math.min(count-1,Math.floor(u));return out.copy(samples[i].position).lerp(samples[i+1].position,u-i);};
 return {startS,endS,samples,sample,notice:'Representative near-bank display route within mapped OSM water; water depth, speed and camera height are estimates.'};
}
