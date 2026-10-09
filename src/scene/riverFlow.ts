import * as THREE from 'three';
import {createWaterDomain} from '../../shared/water-domain.mjs';
export type WaterSettings={speed:number;strength:number;opacity:number;reflection:number};
export const DEFAULT_WATER:WaterSettings={speed:.65,strength:.7,opacity:.86,reflection:1};
export type WaterDomain=ReturnType<typeof createWaterDomain>;
export function createFlowWater(points:THREE.Vector3[],domain:WaterDomain,raw:ArrayBuffer,vertexCount:number,indexCount:number){
 const coordinates=new Float32Array(raw,0,vertexCount*2),index=new Uint32Array(raw,vertexCount*8,indexCount);
 const positions=new Float32Array(vertexCount*3),uv=new Float32Array(vertexCount*2),direction=new Float32Array(vertexCount*2),shore=new Float32Array(vertexCount*2);
 for(let i=0;i<vertexCount;i++){const x=coordinates[i*2]/10,z=coordinates[i*2+1]/10,q=domain.sample(x,z);positions.set([x,q.level,z],i*3);uv.set([q.across,q.s],i*2);direction.set([q.tx,q.tz],i*2);shore.set([Math.min(80,q.shoreDistance*10),Math.min(10000,q.islandDistance*10)],i*2);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('flowDirection',new THREE.BufferAttribute(direction,2));geometry.setAttribute('shore',new THREE.BufferAttribute(shore,2));geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.computeVertexNormals();
 const uniforms={uTime:{value:0},uTravel:{value:0},uSpeed:{value:DEFAULT_WATER.speed},uStrength:{value:DEFAULT_WATER.strength},uOpacity:{value:DEFAULT_WATER.opacity},uReflection:{value:1},uWakeS:{value:-1e6},uWakeX:{value:0},uWakeSpeed:{value:0},uReflectionMap:{value:null as THREE.Texture|null},uReflectionTexel:{value:new THREE.Vector2(1/1024,1/512)},uReflectionMatrix:{value:new THREE.Matrix4()},uPlanarMix:{value:0},uReflectionLevel:{value:0}};
 const material=new THREE.ShaderMaterial({uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),...uniforms},lights:true,fog:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,
 vertexShader:`
 #include <common>
 #include <shadowmap_pars_vertex>
 #include <fog_pars_vertex>
 attribute vec2 flowDirection,shore;varying vec2 vFlow,vDirection,vShore;varying vec3 vWorld;varying vec4 vReflection;uniform mat4 uReflectionMatrix;uniform float uTime,uTravel,uStrength;
 void main(){vFlow=uv;vDirection=flowDirection;vShore=shore;vec3 p=position;float s=uv.y-uTravel;float amplitude=smoothstep(0.,2.,shore.x);p.y+=amplitude*uStrength*(sin(s*.8+uv.x*.27)*.004+sin(s*1.7-uv.x*.46)*.002);vWorld=(modelMatrix*vec4(p,1.)).xyz;vReflection=uReflectionMatrix*vec4(vWorld,1.);vec4 worldPosition=vec4(vWorld,1.);vec4 mvPosition=viewMatrix*worldPosition;vec3 transformedNormal=normalMatrix*normal;
 #include <shadowmap_vertex>
 gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
 }`,
 fragmentShader:`precision highp float;
 #include <common>
 #include <packing>
 #include <lights_pars_begin>
 #include <shadowmap_pars_fragment>
 #include <shadowmask_pars_fragment>
 #include <fog_pars_fragment>
varying vec2 vFlow,vDirection,vShore;varying vec3 vWorld;varying vec4 vReflection;uniform sampler2D uReflectionMap;uniform vec2 uReflectionTexel;uniform float uTime,uTravel,uSpeed,uStrength,uOpacity,uReflection,uWakeS,uWakeX,uWakeSpeed,uPlanarMix,uReflectionLevel;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 float height(vec2 p){float s=p.y-uTravel;return sin(s*.8+p.x*.27)*.20+sin(s*1.7-p.x*.46)*.09+noise(vec2(p.x*.85,s*.65))*.2;}
 void main(){vec2 p=vFlow;float n=height(p),dx=(height(p+vec2(.12,0))-n)/.12,ds=(height(p+vec2(0,.12))-n)/.12;
 float aa=1./(1.+length(fwidth(p))*.65);vec2 tangent=normalize(vDirection),side=vec2(-tangent.y,tangent.x),slope=(side*dx+tangent*ds)*uStrength*.18*aa;vec3 normal=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(cameraPosition-vWorld);float fres=.035+.965*pow(1.-max(dot(normal,view),0.),5.);
 float depth=.18+3.2*(1.-exp(-vShore.x*.085));vec3 shallow=vec3(.28,.36,.25),deep=vec3(.065,.19,.18),body=mix(shallow,deep,1.-exp(-depth*.65));float sunVisibility=getShadowMask();body*=mix(.62,1.,sunVisibility);vec3 sky=vec3(.48,.62,.61);
 vec2 reflectUv=vReflection.xy/vReflection.w+slope*.035;float valid=step(0.,reflectUv.x)*step(0.,reflectUv.y)*step(reflectUv.x,1.)*step(reflectUv.y,1.)*step(0.,vReflection.w);float levelWeight=1.-smoothstep(.10,.55,abs(vWorld.y-uReflectionLevel));
 vec2 safeUv=clamp(reflectUv,0.,1.),texel=uReflectionTexel*.8;vec3 reflected=(texture2D(uReflectionMap,safeUv+texel).rgb+texture2D(uReflectionMap,safeUv-texel).rgb+texture2D(uReflectionMap,safeUv+vec2(texel.x,-texel.y)).rgb+texture2D(uReflectionMap,safeUv+vec2(-texel.x,texel.y)).rgb)*.25;vec3 environment=mix(sky,reflected,uPlanarMix*valid*levelWeight);vec3 col=mix(body,environment,clamp((.13+fres*.67)*uReflection,0.,.76));
 float streak=noise(vec2(p.x*.43,(p.y-uTravel)*.16));col+=vec3(.048,.068,.056)*smoothstep(.57,.81,streak)*uStrength*aa;
 float behind=uWakeS-p.y,envelope=exp(-max(behind,0.)*.17)*step(0.,behind)*step(behind,28.);float ridge=exp(-pow((abs(p.x-uWakeX)-behind*.20)*2.1,2.));float wake=ridge*envelope*clamp(abs(uWakeSpeed)*.45,0.,1.65);col+=vec3(.19)*wake*(.6+.4*sin(behind*4.-uTime*3.))*aa;
 // Disturbance stays local to actual mapped islands; not a blanket foam border.
 float obstacle=(1.-smoothstep(.2,2.4,vShore.y))*smoothstep(.08,.4,vShore.x);float foam=obstacle*smoothstep(.63,.79,noise(vec2(p.x*1.7,(p.y-uTravel)*1.5)))*uStrength*min(uSpeed,1.);col=mix(col,vec3(.67,.70,.61),foam*.28*aa);
 if(uReflection>.5){vec3 r=reflect(-view,normal);col+=vec3(1.,.94,.77)*pow(max(dot(r,normalize(vec3(-300.,600.,180.))),0.),220.)*.28*sunVisibility;}
 float alpha=uOpacity*(.43+.54*(1.-exp(-depth*.9)))*(1.-.45*(1.-smoothstep(0.,1.1,vShore.x)));gl_FragColor=vec4(col,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='OSM water polygons with real island holes and downstream flow';mesh.renderOrder=2;mesh.receiveShadow=true;mesh.userData.shoreSource='OSM relation 17918405 / way 1306285176';return {mesh,uniforms,length:domain.length,points,distances:domain.distances};
}
