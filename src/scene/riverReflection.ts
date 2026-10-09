import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import type {createFlowWater} from './riverFlow';
/** A local planar capture for the visible reach; distant elevation changes blend
 * back to environment color. Reduced quality skips the extra render entirely. */
export function createRiverReflection(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,water:ReturnType<typeof createFlowWater>){
 const geometry=new THREE.PlaneGeometry(1,1),reflector=new Reflector(geometry,{textureWidth:1024,textureHeight:512,multisample:2,clipBias:.0005});reflector.rotation.x=-Math.PI/2;
 let last=-Infinity,frames=0;const inverse=new THREE.Matrix4();water.uniforms.uReflectionMap.value=reflector.getRenderTarget().texture;water.uniforms.uReflectionTexel.value.set(1/1024,1/512);
 return {update(now:number,level:number,enabled:boolean){water.uniforms.uPlanarMix.value=enabled?1:0;if(!enabled)return;if(now-last<65&&Math.abs(level-reflector.position.y)<.08)return;last=now;reflector.position.y=level;reflector.updateMatrixWorld(true);camera.updateMatrixWorld(true);const visible=water.mesh.visible;water.mesh.visible=false;
  try{// Reflector's implementation consumes the first three callback arguments.
   (reflector.onBeforeRender as (r:THREE.WebGLRenderer,s:THREE.Scene,c:THREE.Camera)=>void).call(reflector,renderer,scene,camera);const matrix=(reflector.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;inverse.copy(reflector.matrixWorld).invert();water.uniforms.uReflectionMatrix.value.copy(matrix).multiply(inverse);water.uniforms.uReflectionLevel.value=level;frames++;}finally{water.mesh.visible=visible;}
  renderer.domElement.dataset.reflectionFrames=String(frames);},dispose(){reflector.dispose();geometry.dispose();}};
}
