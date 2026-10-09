import * as THREE from 'three';
import {subtractBox} from './worldPalaceGeometry';

/** Exact source names plus their production GLTFLoader aliases; no prefix/fuzzy matching. */
const ENTRY_BAY_PARTS=['south entry gallery roof','south entry gallery roof ridge','south entry gallery roof eave','south entry gallery end'] as const;
const ENTRY_BAY_NAMES=new Map<string,string>();
for(const name of ENTRY_BAY_PARTS){
 ENTRY_BAY_NAMES.set(name,name);
 ENTRY_BAY_NAMES.set(THREE.PropertyBinding.sanitizeNodeName(name),name);
}
const REPAIR_NAME='Shangqing south entry replacement edge frames · artistic';
export type ShangqingStructureRepair={changedMeshes:string[];removedTriangles:number;frameMembers:number;bayBounds:[number,number,number,number]};

/**
 * Finish the original south gallery bay at the inserted courtyard's two edges.
 * The general replacement box ends halfway across the old roof, before its ridge;
 * only this source assembly needs a full-depth trim. Site paving is retained.
 * Exact frame sizes are an artistic connection detail, not a surveyed restoration.
 */
export function repairShangqingEntryStructure(root:THREE.Object3D,reference:THREE.Matrix4,replacementBounds:readonly number[]):ShangqingStructureRepair|null{
 const [left,front,right,back]=replacementBounds;
 // Refuse unrelated footprints or models rather than modifying arbitrary heritage roofs.
 if(front>=50.7||back<=39.3||left<=-32.4||right>=32.4||right-left<2)return null;
 if(root.getObjectByName(REPAIR_NAME))return null;
 const parts:THREE.Mesh[]=[];root.traverse(o=>{if((o as THREE.Mesh).isMesh&&ENTRY_BAY_NAMES.has(o.name))parts.push(o as THREE.Mesh);});
 if(!parts.some(o=>ENTRY_BAY_NAMES.get(o.name)==='south entry gallery roof'))return null;
 const minX=left-.02,maxX=right+.02,minZ=39.25,maxZ=50.75,changedMeshes:string[]=[];let removedTriangles=0;
 for(const mesh of parts){const old=mesh.geometry;removedTriangles+=subtractBox(mesh,reference,[minX,-30,minZ],[maxX,40,maxZ]);if(mesh.geometry!==old)changedMeshes.push(mesh.name);}
 const frame=new THREE.Group();frame.name=REPAIR_NAME;frame.userData={artistic:true,source:'/assets/models/shangqing-study.glb',referencePhotos:['shangqing-court','shangqing-east'],scope:'Runtime trim and steel edge-frame estimate at the inserted courtyard seam; original source asset is unchanged.'};
 const material=new THREE.MeshStandardMaterial({color:'#2e3633',roughness:.78,metalness:.45});let frameMembers=0;
 function beam(name:string,a:THREE.Vector3,b:THREE.Vector3,width=.20,depth=.20){const d=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.BoxGeometry(width,d.length(),depth),material);mesh.name=name;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.castShadow=mesh.receiveShadow=true;frame.add(mesh);frameMembers++;}
 for(const [side,edge,direction]of [['west',minX,-1],['east',maxX,1]] as const){
  const x=edge+direction*.25;
  // Both feet terminate on retained source paving, outside the replacement footprint.
  for(const z of [40.35,49.3])beam(`${side} seam column`,new THREE.Vector3(x,.5,z),new THREE.Vector3(x,4.30,z),.24,.24);
  beam(`${side} seam tie`,new THREE.Vector3(x,4.20,39.40),new THREE.Vector3(x,4.20,50.60),.24,.24);
  // Sample the existing source roof profile; keep its ridge and eave heights.
  for(const sign of [-1,1])for(let i=0;i<10;i++){
   const point=(j:number)=>{const t=j/10;return new THREE.Vector3(x,4.30+1.7*(.62*t*t+.38*t),45+sign*5.65*(1-t));};
   beam(`${side} seam sloped rafter`,point(i),point(i+1),.18,.18);
  }
  beam(`${side} seam king post`,new THREE.Vector3(x,4.2,45),new THREE.Vector3(x,6,45),.18,.18);
 }
 // Geometry above uses the reference's site coordinates, even for transformed parents.
 root.updateWorldMatrix(true,false);frame.applyMatrix4(root.matrixWorld.clone().invert().multiply(reference));root.add(frame);frame.updateWorldMatrix(true,true);
 const result:ShangqingStructureRepair={changedMeshes,removedTriangles,frameMembers,bayBounds:[minX,minZ,maxX,maxZ]};frame.userData.repair=result;return result;
}
