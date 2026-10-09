import * as THREE from 'three';
type Cover={data:{worldBounds:number[]};texture:THREE.Texture};
export const RIVER_SLOPE_SCOPE={boundsSceneXZ:[-438,-182,-305,-18] as [number,number,number,number],kind:'Representative color/normal weathering on unchanged terrain; mapped rock classes retained; small unlocated outcrop mottles artistic.'};
/** Adds roughness/normal/weathering to existing material hooks; no terrain displacement. */
export function attachRiverSlopeDetail(ground:THREE.Object3D,options:{cover?:Cover;boundsSceneXZ?:[number,number,number,number];artisticSlopePatches?:boolean}={}){
 const used=new Set<THREE.MeshStandardMaterial>(),scope=options.boundsSceneXZ??RIVER_SLOPE_SCOPE.boundsSceneXZ,cover=options.cover;
 ground.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(!(m instanceof THREE.MeshStandardMaterial)||used.has(m))continue;used.add(m);const previous=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);
 m.onBeforeCompile=(shader,renderer)=>{previous.call(m,shader,renderer);shader.uniforms.uBOBounds={value:new THREE.Vector4(...scope).multiplyScalar(10)};if(cover){shader.uniforms.uBOCover={value:cover.texture};shader.uniforms.uBOCoverBounds={value:new THREE.Vector4(...cover.data.worldBounds)};}
 shader.vertexShader='varying vec3 vBOPoint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBOPoint=(modelMatrix*vec4(position,1.)).xyz*10.;');
 shader.fragmentShader=`varying vec3 vBOPoint;uniform vec4 uBOBounds;${cover?'uniform sampler2D uBOCover;uniform vec4 uBOCoverBounds;':''}
float boHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float boNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(boHash(i),boHash(i+vec2(1,0)),f.x),mix(boHash(i+vec2(0,1)),boHash(i+1.),f.x),f.y);}
float boLocal(){vec2 a=smoothstep(uBOBounds.xy,uBOBounds.xy+vec2(55.),vBOPoint.xz),b=1.-smoothstep(uBOBounds.zw-vec2(55.),uBOBounds.zw,vBOPoint.xz);return a.x*a.y*b.x*b.y;}
float boLayer(vec3 p){
 vec2 along=vec2(dot(p.xz,vec2(.71,.70)),dot(p.xz,vec2(-.70,.71)));
 float warp=boNoise(along*.031)*2.7;
 float broad=boNoise(vec2(along.x*.049+along.y*.023,p.y*.27+warp));
 float fine=boNoise(vec2(along.y*.115+along.x*.033,p.y*.83+boNoise(along*.13)));
 // Noise intervals and cross-cutting weathering interrupt the beds: no repeated sine relief.
 return mix(broad,fine,.24);
}
float boRelief(vec3 p){float beds=boLayer(p),grain=boNoise(p.xz*1.65+p.y*.31);return beds*.032+grain*.006;}
`+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
float boScope=boLocal();vec3 boCover=vec3(0.);${cover?'vec2 boUV=(vBOPoint.xz-uBOCoverBounds.xy)/(uBOCoverBounds.zw-uBOCoverBounds.xy);if(all(greaterThanEqual(boUV,vec2(0.)))&&all(lessThanEqual(boUV,vec2(1.))))boCover=texture2D(uBOCover,boUV).rgb;':''}
float boSlope=1.-abs(normalize(cross(dFdx(vBOPoint),dFdy(vBOPoint))).y);
float boArt=${options.artisticSlopePatches===false?'0.':'smoothstep(.035,.16,boSlope)*(.18+.82*smoothstep(.28,.74,boNoise(vBOPoint.xz*.041+vec2(vBOPoint.y*.024))))*(1.-boCover.g*.30)*(1.-boCover.b)*.78'};
float boRock=max(boCover.r,boArt)*boScope;
float boBroad=boNoise(vBOPoint.xz*.072+vBOPoint.y*.037),boBands=boLayer(vBOPoint),boAA=1.-smoothstep(.8,3.,length(fwidth(vBOPoint)));
vec3 boStone=mix(vec3(.165,.101,.065),vec3(.345,.231,.143),boBroad);float boBreak=smoothstep(.29,.72,boNoise(vBOPoint.xz*.093+vec2(vBOPoint.y*.037)));float boSeam=smoothstep(.53,.67,boBands)*(1.-smoothstep(.67,.79,boBands))*boBreak;boStone*=1.-boSeam*.21*boAA;
float boRunoff=smoothstep(.54,.78,boNoise(vBOPoint.xz*.16+vec2(vBOPoint.y*.014)));
boStone=mix(boStone,vec3(.094,.107,.075),boRunoff*.32);diffuseColor.rgb=mix(diffuseColor.rgb,boStone,boRock*.72);
// Broad irregular cover mottling breaks smooth green slopes without moving a skyline.
diffuseColor.rgb*=1.-boScope*(1.-boRock)*(.13+.09*boCover.g)*(boNoise(vBOPoint.xz*.075+vec2(vBOPoint.y*.018))-.38);
`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 boDx=dFdx(-vViewPosition),boDy=dFdy(-vViewPosition),boR1=cross(boDy,normal),boR2=cross(normal,boDx);float boDet=dot(boDx,boR1);float boH=boRelief(vBOPoint)*.1; /* metre relief converted to scene units */vec3 boGrad=sign(boDet)*(dFdx(boH)*boR1+dFdy(boH)*boR2);normal=normalize(normal-boGrad/max(abs(boDet),.00001)*boRock*boAA*.72);
`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.79+.16*boBroad,boRock);');
 };
 m.customProgramCacheKey=()=>cache()+':BO-slope-2:'+Boolean(cover)+':'+(options.artisticSlopePatches!==false);m.needsUpdate=true;
 }});ground.userData.riverSlopeDetail={...RIVER_SLOPE_SCOPE,boundsSceneXZ:scope,materials:used.size,artisticSlopePatches:options.artisticSlopePatches!==false};return {materials:used.size,scope};
}
