import * as THREE from 'three';
import {geoToWorld} from '../../shared/geography.mjs';
import type {RiverLandcover, RiverLandcoverData} from './riverLandscape';
import type {VegetationGroup} from './siteVegetation';
import {createCanopyAtlas,createCanopyShapes} from './canopyShapes';

type Boundary={sample:(x:number,z:number)=>{inside:boolean;shoreDistance:number}};
export type RiverCanopyOptions={cover:RiverLandcover;waterDomain:Boundary;renderer?:THREE.WebGLRenderer;maxDistance?:number};
export const CANOPY_LIMITS={nearHigh:24,nearLow:8,midHigh:320,midLow:160,farHigh:3500,farLow:2600,atlasBytes:512*256*4,maxBatches:28};
export function canopyCoverageForPass(renderer?:THREE.WebGLRenderer){
 if(!renderer)return {enabled:false,samples:0,contextAntialias:false,target:'cpu-no-context'};
 const gl=renderer.getContext(),target=renderer.getRenderTarget(),samples=Number(gl.getParameter(gl.SAMPLES))||0,contextAntialias=gl.getContextAttributes()?.antialias===true;
 return {enabled:samples>0&&(target!==null||contextAntialias),samples,contextAntialias,target:target?'render-target':'default-framebuffer'};
}

/** Source stems, yaw and scale are unchanged. Only representative leaf topology
 * and LOD selection change. Classification and water clipping also apply to
 * depth/shadow rendering; no new trees or terrain are created. */
export function createRiverCanopy(data:RiverLandcoverData,ground:(coordinates:number[])=>THREE.Vector3,options:RiverCanopyOptions):VegetationGroup{
 const group=new THREE.Group() as VegetationGroup;group.scale.setScalar(.1);
 const atlas=createCanopyAtlas(),object=new THREE.Object3D();
 const samples=data.trees.map((tree,index)=>{
  const p=ground(tree.coordinates).multiplyScalar(10),[x,z]=geoToWorld(tree.coordinates),water=options.waterDomain.sample(x/10,z/10);
  object.position.copy(p);object.rotation.set(0,index*2.399,0);object.scale.set(tree.radius/4,tree.height/10,tree.radius/4);object.updateMatrix();
  return {matrix:object.matrix.clone(),position:new THREE.Vector3(x,p.y+tree.height*.5,z),variant:tree.variant%4,
   color:new THREE.Color(.34+tree.variant*.018,.44+tree.variant*.023,.32+tree.variant*.016),
   // The source radius remains the transform. Per-fragment clipping prevents
   // an overhanging card from crossing the sourced water boundary.
   waterRadius:water.inside?0:Math.max(0,Math.min(tree.radius,water.shoreDistance*10-.15)),level:2};
 });
 const plain=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,side:THREE.DoubleSide});
 const coverage=canopyCoverageForPass(options.renderer);
 const spray=new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.96,alphaTest:.42,alphaToCoverage:coverage.enabled,side:THREE.DoubleSide});
 group.userData.canopyCoverage=coverage;
 const wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
 const depths=[new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}),new THREE.MeshDepthMaterial({map:atlas,alphaTest:.42,depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide})];
 const clip=(material:THREE.Material,outward=false)=>{
  material.onBeforeCompile=shader=>{
   shader.uniforms.uKCover={value:options.cover.texture};shader.uniforms.uKBounds={value:new THREE.Vector4(...options.cover.data.worldBounds)};
   shader.vertexShader='attribute float canopyWaterRadius; varying vec3 vKPoint; varying vec2 vKStem; varying float vKWaterRadius;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 kPoint=vec4(position,1.);vec4 kStem=vec4(0.,0.,0.,1.);
#ifdef USE_INSTANCING
kPoint=instanceMatrix*kPoint;kStem=instanceMatrix*kStem;
#endif
vKPoint=(modelMatrix*kPoint).xyz*10.;vKStem=(modelMatrix*kStem).xz*10.;vKWaterRadius=canopyWaterRadius;`);
   shader.fragmentShader='uniform sampler2D uKCover; uniform vec4 uKBounds; varying vec3 vKPoint; varying vec2 vKStem; varying float vKWaterRadius;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
vec2 kUV=(vKPoint.xz-uKBounds.xy)/(uKBounds.zw-uKBounds.xy);
if(any(lessThan(kUV,vec2(0.)))||any(greaterThan(kUV,vec2(1.))))discard;
vec3 kClass=texture2D(uKCover,kUV).rgb;
if(kClass.r>.08||kClass.b>.08||kClass.g<.35||distance(vKPoint.xz,vKStem)>vKWaterRadius)discard;`);
   if(outward)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal*=faceDirection;');
  };
  material.customProgramCacheKey=()=>`k-canopy-v2:${material.type}:${outward}`;
 };
 clip(plain);clip(spray,true);clip(wood);depths.forEach(d=>clip(d));
 const all:THREE.InstancedMesh[]=[],ownedGeometries:THREE.BufferGeometry[]=[];
 let lastTarget:THREE.WebGLRenderTarget|null|undefined;
 let lastTargetSignature:string|undefined;
 let coverageTargets=new WeakMap<THREE.WebGLRenderTarget,{signature:string;value:ReturnType<typeof canopyCoverageForPass>}>();
 let defaultCoverage:ReturnType<typeof canopyCoverageForPass>|undefined;
 const resetCoverage=()=>{coverageTargets=new WeakMap();defaultCoverage=undefined;lastTarget=undefined;lastTargetSignature=undefined;};
 options.renderer?.domElement.addEventListener('webglcontextrestored',resetCoverage);
 const cachedCoverage=(renderer:THREE.WebGLRenderer)=>{
  const target=renderer.getRenderTarget();
  if(!target)return defaultCoverage??(defaultCoverage=canopyCoverageForPass(renderer));
  const signature=[target.samples,target.width,target.height,target.depth].join(':');
  const prior=coverageTargets.get(target);if(prior?.signature===signature)return prior.value;
  const value=canopyCoverageForPass(renderer);coverageTargets.set(target,{signature,value});return value;
 };
 const capacities=Array.from({length:4},(_,v)=>samples.filter(s=>s.variant===v).length);
 const make=(geometry:THREE.BufferGeometry,material:THREE.Material,name:string,variant:number,lod:number,foliage:boolean)=>{
  const capacity=Math.min(capacities[variant],lod===0?CANOPY_LIMITS.nearHigh:lod===1?CANOPY_LIMITS.midHigh:Infinity);
  geometry.setAttribute('canopyWaterRadius',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=name;mesh.count=0;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.visible=false;
  mesh.customDepthMaterial=material===spray?depths[1]:depths[0];
  if(material===spray)mesh.onBeforeRender=renderer=>{
   const target=renderer.getRenderTarget(),signature=target?[target.samples,target.width,target.height,target.depth].join(':'):'default';if(target===lastTarget&&signature===lastTargetSignature)return;lastTarget=target;lastTargetSignature=signature;
   const current=cachedCoverage(renderer);group.userData.canopyCoverage=current;
   if(spray.alphaToCoverage!==current.enabled){spray.alphaToCoverage=current.enabled;spray.needsUpdate=true;}
  };
  all.push(mesh);ownedGeometries.push(geometry);group.add(mesh);return mesh;
 };
 const batches=Array.from({length:4},(_,variant)=>{
  const shape=createCanopyShapes(variant);
  return [
   [make(shape.near.wood,wood,'K near branches',variant,0,false),make(shape.near.leaves,plain,'K near leaves',variant,0,true),make(shape.near.fill,spray,'K near crown fill',variant,0,true)],
   [make(shape.mid.wood,wood,'K mid branches',variant,1,false),make(shape.mid.fill,spray,'K mid leaf clusters',variant,1,true)],
   [make(shape.far.wood,wood,'K far stem',variant,2,false),make(shape.far.fill,spray,'K far irregular crown',variant,2,true)]
  ];
 });
 const local=new THREE.Vector3(),last=new THREE.Vector3(Infinity,Infinity,Infinity),rotation=new THREE.Quaternion(),lastRotation=new THREE.Quaternion();
 let lastTime=-Infinity,lastLow:boolean|undefined,disposed=false;
 group.name='K source-constrained continuous crowns';group.userData.treeSamples=samples.length;group.userData.treeShape='source-crown-clusters-v2';group.userData.treeLOD=[0,0,0,samples.length];group.userData.canopyLimits=CANOPY_LIMITS;
 group.userData.canopyMemory={atlasBytes:CANOPY_LIMITS.atlasBytes,geometryBytes:ownedGeometries.reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0),instanceBytes:all.reduce((sum,m)=>sum+m.instanceMatrix.array.byteLength+m.instanceMatrix.count*3*4,0),batches:all.length};
 group.updateView=(camera,low=false)=>{
  if(disposed)return false;const now=performance.now();if(now-lastTime<220&&low===lastLow)return false;
  group.updateWorldMatrix(true,false);camera.getWorldPosition(local);group.worldToLocal(local);camera.getWorldQuaternion(rotation);
  if(last.distanceToSquared(local)<4&&rotation.angleTo(lastRotation)<.003&&low===lastLow)return false;
  last.copy(local);lastRotation.copy(rotation);lastTime=now;lastLow=low;
  const ranked=samples.map(sample=>({sample,distance:sample.position.distanceTo(local)})).sort((a,b)=>a.distance-b.distance),counts=[0,0,0,0];all.forEach(m=>m.count=0);
  const near=low?38:70,mid=low?240:380,far=options.maxDistance??(low?CANOPY_LIMITS.farLow:CANOPY_LIMITS.farHigh);
  for(const {sample,distance} of ranked){
   const level=distance<near+(sample.level===0?4:-4)&&counts[0]<(low?CANOPY_LIMITS.nearLow:CANOPY_LIMITS.nearHigh)?0:distance<mid+(sample.level===1?10:-10)&&counts[1]<(low?CANOPY_LIMITS.midLow:CANOPY_LIMITS.midHigh)?1:distance<far?2:3;
   sample.level=level;counts[level]++;if(level===3)continue;
   for(const mesh of batches[sample.variant][level]){mesh.setMatrixAt(mesh.count,sample.matrix);mesh.setColorAt(mesh.count,sample.color);(mesh.geometry.getAttribute('canopyWaterRadius') as THREE.InstancedBufferAttribute).setX(mesh.count,sample.waterRadius);mesh.count++;}
  }
  for(const mesh of all){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.geometry.getAttribute('canopyWaterRadius').needsUpdate=true;if(mesh.count)mesh.computeBoundingSphere();}
  group.userData.treeLOD=counts;group.userData.canopyVisibleBatches=all.filter(m=>m.visible).length;
  group.userData.canopySubmittedTriangles=all.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3*m.count,0);return true;
 };
 // Standard scene traversal already releases geometry/material/atlas. Release
 // custom depth programs and instance resources that traversal does not own.
 group.userData.disposeCanopy=()=>{if(disposed)return;disposed=true;options.renderer?.domElement.removeEventListener('webglcontextrestored',resetCoverage);depths.forEach(d=>d.dispose());all.forEach(m=>m.dispose());};
 return group;
}
