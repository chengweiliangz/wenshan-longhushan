import * as THREE from 'three';

/** A local, world-aligned sun map. It follows the active view without moving any
 * source geometry. Trees/buildings are static: redraw only when the footprint or
 * their LOD changes. This also avoids rendering a second map for water captures. */
export function createSceneSun(renderer:THREE.WebGLRenderer,scene:THREE.Scene,low:boolean){
 const sun=new THREE.DirectionalLight('#fff3d7',2.7),direction=new THREE.Vector3(-300,600,180).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
 const resolution=low?1024:2048,shadow=sun.shadow,center=new THREE.Vector3();let radius=0,dirty=true,last=-Infinity,pending=false,frames=0;
 sun.name='Local daylight with world-stable shadow footprint';sun.castShadow=true;shadow.mapSize.set(resolution,resolution);shadow.camera.near=1;shadow.camera.far=320;
 shadow.bias=-.000012;shadow.normalBias=.01;shadow.autoUpdate=false;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 scene.add(sun,sun.target);sun.position.copy(direction).multiplyScalar(160);
 return {
  sun,
  invalidate(){dirty=true;},
  prepare(camera:THREE.Camera,target:THREE.Vector3,now:number){
   // The high regional overview is too broad for a useful contact-shadow texel.
   const active=camera.position.y<180;
   if(active!==sun.castShadow){sun.castShadow=active;dirty=true;}
   if(!active){renderer.domElement.dataset.sunShadows='overview-off';return;}
   const r=Math.ceil(THREE.MathUtils.clamp(camera.position.distanceTo(target),18,85)/5)*5,texel=2*r/resolution;
   const desired=target.clone();desired.addScaledVector(right,Math.round(desired.dot(right)/texel)*texel-desired.dot(right));desired.addScaledVector(up,Math.round(desired.dot(up)/texel)*texel-desired.dot(up));
   const moved=center.distanceToSquared(desired)>texel*texel*.25||r!==radius;
   if((dirty||moved)&&now-last>(low?300:140)){
    center.copy(desired);radius=r;sun.target.position.copy(center);sun.position.copy(center).addScaledVector(direction,160);sun.target.updateMatrixWorld();sun.updateMatrixWorld();
    shadow.normalBias=texel*1.1;shadow.bias=-texel*.35/(shadow.camera.far-shadow.camera.near);
    shadow.camera.left=shadow.camera.bottom=-r;shadow.camera.right=shadow.camera.top=r;shadow.camera.updateProjectionMatrix();
    shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;last=now;dirty=false;pending=true;
   }
   renderer.domElement.dataset.sunShadows=String(resolution);renderer.domElement.dataset.shadowTexelMeters=(texel*10).toFixed(3);
  },
  finishFrame(){if(pending&&!renderer.shadowMap.needsUpdate){frames++;pending=false;}renderer.domElement.dataset.shadowFrames=String(frames);},
  dispose(){shadow.dispose();scene.remove(sun,sun.target);}
 };
}
