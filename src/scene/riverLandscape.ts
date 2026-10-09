import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {geoToWorld} from '../../shared/geography.mjs';
import {createTreeShapes,createTwigMap,createTwigMaterial} from './treeGeometry';
import type {VegetationGroup} from './siteVegetation';

export type RiverLandcoverData={id:string;mask:string;worldBounds:number[];source:{captureDate:string};polygons:{rock:number;forest:number;cropland:number};trees:{coordinates:number[];height:number;radius:number;variant:number}[]};
export type RiverLandcover={data:RiverLandcoverData;texture:THREE.Texture};

/** Category mask comes from reviewed image-space polygons. No imagery RGB is used.
 * Procedural surface grains are representative, not measured sedimentary layers. */
export function applyRiverLandcover(material:THREE.MeshStandardMaterial,cover:RiverLandcover){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.uniforms.uLandcover={value:cover.texture};shader.uniforms.uLandBounds={value:new THREE.Vector4(...cover.data.worldBounds)};
  shader.vertexShader='varying vec3 vLandPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLandPoint=(modelMatrix*vec4(position,1.)).xyz*10.;');
  shader.fragmentShader=`uniform sampler2D uLandcover;uniform vec4 uLandBounds;varying vec3 vLandPoint;
float lcHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float lcNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(lcHash(i),lcHash(i+vec3(1,0,0)),f.x),mix(lcHash(i+vec3(0,1,0)),lcHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(lcHash(i+vec3(0,0,1)),lcHash(i+vec3(1,0,1)),f.x),mix(lcHash(i+vec3(0,1,1)),lcHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 landUV=(vLandPoint.xz-uLandBounds.xy)/(uLandBounds.zw-uLandBounds.xy);
if(all(greaterThanEqual(landUV,vec2(0.)))&&all(lessThanEqual(landUV,vec2(1.)))){
 vec3 cover=texture2D(uLandcover,landUV).rgb;
 float edge=smoothstep(0.,.009,min(min(landUV.x,1.-landUV.x),min(landUV.y,1.-landUV.y)));cover*=edge;
 float broad=lcNoise(vLandPoint*.11),fineAA=1.-smoothstep(.6,2.4,length(fwidth(vLandPoint)));
 vec3 woods=mix(vec3(.048,.083,.038),vec3(.084,.118,.055),broad);
 diffuseColor.rgb=mix(diffuseColor.rgb,woods,cover.g*.91);
 vec3 earth=mix(vec3(.20,.166,.098),vec3(.29,.246,.149),broad);
 diffuseColor.rgb=mix(diffuseColor.rgb,earth,cover.b*.88);
 if(cover.r>.008){
  float weather=lcNoise(vLandPoint*vec3(.052,.18,.052)),grain=lcNoise(vLandPoint*1.65);
  float seam=sin(vLandPoint.y*1.37+lcNoise(vLandPoint*vec3(.12,.03,.12))*3.5);
  float streak=lcNoise(vLandPoint*vec3(.63,.045,.63));
  vec3 stone=mix(vec3(.205,.119,.080),vec3(.332,.237,.168),weather);
  stone*=.95+.09*grain*fineAA+.045*(1.-fineAA);
  stone*=1.-.06*smoothstep(.68,.92,seam)*fineAA;
  stone=mix(stone,vec3(.079,.086,.071),smoothstep(.64,.88,streak)*.18);
  diffuseColor.rgb=mix(diffuseColor.rgb,stone,cover.r);
 }
}`);
 };
 material.customProgramCacheKey=()=> 'mapped-luxi-rock-forest-v1:'+material.name;
}

/** Source-constrained stands; each stem position, height and branching is illustrative.
 * Near leaves and mid twigs reuse the authored tree library. At long range only
 * twig silhouettes are drawn, with no hidden trunk triangles or spherical crowns. */
function farSupport(variant:number){
 const parts:THREE.BufferGeometry[]=[];
 const branch=(a:THREE.Vector3,b:THREE.Vector3,r:number,top:number)=>{const g=new THREE.CylinderGeometry(top,r,a.distanceTo(b),3,1,true);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);const count=g.getAttribute('position').count;g.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:count},()=>[.11,.095,.072]).flat(),3));parts.push(g);};
 branch(new THREE.Vector3(),new THREE.Vector3(.1,8.9,-.05),.22,.035);
 for(const i of [0,2,4,6,8,10]){const a=i*2.399+variant*.7,y=3+i*.43,reach=3.25-i*.085;branch(new THREE.Vector3(0,y,0),new THREE.Vector3(Math.sin(a)*reach,y+2.25,Math.cos(a)*reach),.09-i*.004,.015);}
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function createRiverForest(data:RiverLandcoverData,ground:(coordinates:number[])=>THREE.Vector3,maxDistance?:number):VegetationGroup {
 const group=new THREE.Group() as VegetationGroup;group.scale.setScalar(.1);
 const map=createTwigMap(),spray=createTwigMaterial(map),wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),leaf=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
 const object=new THREE.Object3D();
 const samples=data.trees.map((tree,index)=>{const p=ground(tree.coordinates).multiplyScalar(10),[x,z]=geoToWorld(tree.coordinates);object.position.copy(p);object.rotation.set(0,index*2.399,0);object.scale.set(tree.radius/4,tree.height/10,tree.radius/4);object.updateMatrix();return {position:new THREE.Vector3(x,p.y+tree.height*.5,z),matrix:object.matrix.clone(),variant:tree.variant%4,color:new THREE.Color(.34+tree.variant*.018,.44+tree.variant*.023,.32+tree.variant*.016),level:2};});
 const make=(geometry:THREE.BufferGeometry,material:THREE.Material,name:string)=>{const m=new THREE.InstancedMesh(geometry,material,samples.length);m.name=name;m.count=0;m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(m);return m;};
 const batches=Array.from({length:4},(_,variant)=>{const shape=createTreeShapes(variant);return [[make(shape.near.wood,wood,'river near branches'),make(shape.near.leaves,leaf,'river folded leaves')],[make(shape.mid.wood,wood,'river mid branches'),make(shape.mid.leaves,spray,'river mid twig cards')],[make(farSupport(variant),wood,'river distant branch support'),make(shape.far.leaves,spray,'river distant twig silhouette')]];});
 const local=new THREE.Vector3(),last=new THREE.Vector3(Infinity,Infinity,Infinity);let lastTime=-Infinity,lastLow:boolean|undefined;
 group.name='Luxi imagery-constrained representative woodland';group.userData.treeSamples=samples.length;group.userData.treeShape='branched-broadleaf-v1';group.userData.treeLOD=[0,0,0,samples.length];
 group.updateView=(camera,low=false)=>{const now=performance.now();if(now-lastTime<220&&low===lastLow)return false;group.updateWorldMatrix(true,false);camera.getWorldPosition(local);group.worldToLocal(local);if(last.distanceToSquared(local)<16&&low===lastLow)return false;last.copy(local);lastTime=now;lastLow=low;const counts=[0,0,0,0];batches.flat(2).forEach(m=>m.count=0);
  for(const sample of samples){const d=sample.position.distanceTo(local),near=low?28:48,mid=low?105:160,far=maxDistance??(low?650:950);const level=d<near+(sample.level===0?4:-4)?0:d<mid+(sample.level===1?4:-4)?1:d<far?2:3;sample.level=level;counts[level]++;if(level===3)continue;for(const m of batches[sample.variant][level]){m.setMatrixAt(m.count,sample.matrix);m.setColorAt(m.count,sample.color);m.count++;}}
  for(const m of batches.flat(2)){m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;if(m.count)m.computeBoundingSphere();}group.userData.treeLOD=counts;return true;
 };
 return group;
}
