import {terrainElevation,type Terrain as DEM} from './nativeTerrain';
import * as THREE from 'three';
import {geoToWorld,worldToModelLocal} from '../../shared/geography.mjs';
import {placeAssets} from '../../shared/catalog.mjs';
import {siteGroundHeight} from '../../shared/site-ground.mjs';
import {createTreeShapes,createTwigMap,createTwigMaterial} from './treeGeometry';


export type SiteVegetation={siteId?:string;trees:{coordinates:number[];height:number;radius:number;variant:number}[]};
export type VegetationGroup=THREE.Group & {updateView:(camera:THREE.Camera,low?:boolean)=>boolean};
/** Imagery constrains stand locations. Branches, leaves and dimensions remain representative. */
export function createSiteVegetation(d:DEM,data:SiteVegetation,spotId='shangqing',groundY?:(position:Readonly<THREE.Vector3>)=>number):VegetationGroup {
 if(data.siteId&&data.siteId!==spotId)throw new Error('Vegetation evidence belongs to a different site');
 const geo=placeAssets[spotId as 'shangqing'|'zhengyi'|'tianshi'].geo,[ox,oz]=geoToWorld(geo.coordinates),oy=geo.elevation.meters;
 const sample=(lon:number,lat:number)=>terrainElevation(d,lon,lat);
 const group=new THREE.Group() as VegetationGroup;
 const samples:{position:THREE.Vector3;matrix:THREE.Matrix4;variant:number;color:THREE.Color;level:number}[]=[],object=new THREE.Object3D();
 for(const tree of data.trees){
  const [x,z]=geoToWorld(tree.coordinates),e=sample(tree.coordinates[0],tree.coordinates[1]),local=worldToModelLocal([x,e,z],geo);
  if(spotId==='shangqing'&&Math.abs(local[0])<49&&local[2]>-58&&local[2]<115)continue;
  const y=siteGroundHeight(local[0],local[2],e-oy,spotId);
  object.position.set(x-ox,y,z-oz);if(groundY)object.position.y=groundY(object.position);object.rotation.set(0,tree.variant*.8+Math.sin(x)*.2,0);
  object.scale.set(tree.radius/4,tree.height/10,tree.radius/4);object.updateMatrix();
  samples.push({position:object.position.clone().add(new THREE.Vector3(0,tree.height*.5,0)),matrix:object.matrix.clone(),variant:tree.variant%4,color:new THREE.Color().setHSL(.23+tree.variant*.003,.08,.72+tree.variant*.022),level:2});
 }
 const twigMap=createTwigMap();
 const wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
 const leaf=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide});
 const spray=createTwigMaterial(twigMap);
 const make=(geometry:THREE.BufferGeometry,material:THREE.Material,label:string)=>{
  const mesh=new THREE.InstancedMesh(geometry,material,samples.length);mesh.name=label;mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);return mesh;
 };
 const batches=Array.from({length:4},(_,variant)=>{
  const shapes=createTreeShapes(variant);
  return [
   [make(shapes.near.wood,wood,'Branch hierarchy'),make(shapes.near.leaves,leaf,'Individual folded leaves')],
   [make(shapes.mid.wood,wood,'Distant branches'),make(shapes.mid.leaves,spray,'Leafy twig cards')],
   [make(shapes.mid.wood,wood,'Far branches'),make(shapes.far.leaves,spray,'Distant leafy silhouette')]
  ];
 });
 const cameraLocal=new THREE.Vector3(),lastCamera=new THREE.Vector3(Infinity,Infinity,Infinity);let lastLow:boolean|undefined,lastUpdate=-Infinity;
 group.userData.siteId=spotId;group.userData.treeSamples=samples.length;group.userData.treeShape='branched-broadleaf-v1';group.userData.treeLOD=[0,0,samples.length];
 group.updateView=(camera,low=false)=>{
  const now=performance.now();if(now-lastUpdate<180&&low===lastLow)return false;
  group.updateWorldMatrix(true,false);camera.getWorldPosition(cameraLocal);group.worldToLocal(cameraLocal);
  if(cameraLocal.distanceToSquared(lastCamera)<9&&low===lastLow)return false;
  lastUpdate=now;lastCamera.copy(cameraLocal);lastLow=low;
  const counts=[0,0,0];batches.flat(2).forEach(mesh=>mesh.count=0);
  for(const sample of samples){
   const distance=sample.position.distanceTo(cameraLocal),near=low?35:65,far=low?130:195,hysteresis=5;
   const level=distance<near+(sample.level===0?hysteresis:-hysteresis)?0:distance<far+(sample.level===1?hysteresis:-hysteresis)?1:2;
   sample.level=level;counts[level]++;
   for(const mesh of batches[sample.variant][level]){mesh.setMatrixAt(mesh.count,sample.matrix);mesh.setColorAt(mesh.count,sample.color);mesh.count++;}
  }
  for(const mesh of batches.flat(2)){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;if(mesh.count)mesh.computeBoundingSphere();}
  group.userData.treeLOD=counts;return true;
 };
 group.name='Imagery-derived stands; original representative branches and leaves';
 return group;
}
