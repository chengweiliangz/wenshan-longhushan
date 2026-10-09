import {refineNativeRockCell,BI_NATIVE_ROCK_DETAIL} from './nativeRockDetail';
import * as THREE from 'three';

import {applyRiverLandcover,type RiverLandcover} from './riverLandscape';
import type {WaterDomain} from './riverFlow';
/** Source DEM with mapped water shorelines. Bed depths and vertical bank grading
 * are display estimates; raw terrain and OSM horizontal boundaries stay intact. */
export function createRiverTerrain(bounds:[number,number,number,number],cols:number,rows:number,
 point:(u:number,v:number)=>THREE.Vector3,domain:WaterDomain,low:boolean,focusAreas:{center:THREE.Vector3;radius:number}[]=[],landcover?:RiverLandcover,nativeRockDetailEnabled=false){
 const nearest=(p:THREE.Vector3)=>domain.sample(p.x,p.z);
  const quantum=low?.25:.125,step=low?2:1,N=(cols-1)/quantum,M=(rows-1)/quantum;
  const at=(x:number,y:number)=>point(x/N,y/M);
  type Cell={x:number;y:number;size:number};const leaves:Cell[]=[];
  const split=(x:number,y:number,size:number)=>{
    const p=at(x+size/2,y+size/2),a=at(x,y),b=at(x+size,y+size),n=nearest(p);
    const radius=Math.hypot(a.x-b.x,a.z-b.z)/2;
    const focused=focusAreas.some(f=>Math.hypot(p.x-f.center.x,p.z-f.center.z)<f.radius+radius);
    if((size>1&&n.shoreDistance<3.5+radius)||(focused&&size>(low?.5:1))||(nativeRockDetailEnabled&&refineNativeRockCell(a,b))){const h=size/2;split(x,y,h);split(x+h,y,h);split(x,y+h,h);split(x+h,y+h,h);}
    else leaves.push({x,y,size});
  };
  for(let y=0;y<M;y+=step/quantum)for(let x=0;x<N;x+=step/quantum)split(x,y,step/quantum);
  const rowMap=new Map<number,Set<number>>(),colMap=new Map<number,Set<number>>();
  const add=(x:number,y:number)=>{if(!rowMap.has(y))rowMap.set(y,new Set());if(!colMap.has(x))colMap.set(x,new Set());rowMap.get(y)!.add(x);colMap.get(x)!.add(y);};
  for(const {x,y,size:s} of leaves){add(x,y);add(x+s,y);add(x,y+s);add(x+s,y+s);}
  const lineRows=new Map([...rowMap].map(([k,v])=>[k,[...v].sort((a,b)=>a-b)]));
  const lineCols=new Map([...colMap].map(([k,v])=>[k,[...v].sort((a,b)=>a-b)]));
  const positions:number[]=[],colors:number[]=[],banks:number[]=[],indices:number[]=[],vertices=new Map<string,number>();
  const green=new THREE.Color('#4b6845'),rock=new THREE.Color('#8c795a'),bank=new THREE.Color('#969376');
  const vertex=(x:number,y:number)=>{
    const key=`${x}:${y}`,existing=vertices.get(key);if(existing!==undefined)return existing;
    const p=at(x,y),original=p.y,n=nearest(p);
    // Unmeasured bathymetry: shallow at the mapped edge, gently deeper inside.
    // Outside grading blends back into the unchanged source DEM over 25m.
    if(n.inside){const depth=.018+.32*(1-Math.exp(-n.shoreDistance*.85));p.y=n.level-depth;}
    else if(n.shoreDistance<2.5){const blend=THREE.MathUtils.smoothstep(n.shoreDistance,0,2.5);p.y=THREE.MathUtils.lerp(n.level+.025,Math.max(original,n.level+.025),blend);}
    const eps=1/quantum,dx=at(Math.min(N,x+eps),y).y-at(Math.max(0,x-eps),y).y,dz=at(x,Math.min(M,y+eps)).y-at(x,Math.max(0,y-eps)).y;
    const c=green.clone().lerp(rock,THREE.MathUtils.clamp(Math.hypot(dx,dz)*.1,0,.8));
    c.multiplyScalar(.94+.06*Math.sin(p.x*.18)*Math.sin(p.z*.21));
    if(n.inside)c.copy(bank).multiplyScalar(.73);else if(n.shoreDistance<1.2){c.lerp(bank,(1-THREE.MathUtils.smoothstep(n.shoreDistance,0,1.2))*.85);if(n.shoreDistance<.25)c.multiplyScalar(.68+.32*THREE.MathUtils.smoothstep(n.shoreDistance,0,.25));}
    if(!n.inside&&n.exposedDistance<3)c.copy(bank).multiplyScalar(.90);
    banks.push(n.inside?-Math.min(80,n.shoreDistance*10):Math.min(80,n.shoreDistance*10),Number(n.exposedDistance<3));
    const index=positions.length/3;positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);vertices.set(key,index);return index;
  };
  const between=(list:number[],a:number,b:number)=>list.filter(n=>n>=a&&n<=b);
  for(const {x,y,size:s} of leaves){
    const perimeter=[...between(lineRows.get(y)!,x,x+s).map(v=>[v,y]),...between(lineCols.get(x+s)!,y,y+s).slice(1).map(v=>[x+s,v]),...between(lineRows.get(y+s)!,x,x+s).reverse().slice(1).map(v=>[v,y+s]),...between(lineCols.get(x)!,y,y+s).reverse().slice(1,-1).map(v=>[x,v])];
    const center=vertex(x+s/2,y+s/2),ring=perimeter.map(([a,b])=>vertex(a,b));
    for(let i=0;i<ring.length;i++)indices.push(center,ring[(i+1)%ring.length],ring[i]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('bankData',new THREE.Float32BufferAttribute(banks,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,side:THREE.DoubleSide});
  const plainMaterial=material.clone();
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 bankData; varying vec2 vBankData; varying vec3 vGroundPoint;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundPoint=(modelMatrix*vec4(position,1.)).xyz*10.;vBankData=bankData;');
    shader.fragmentShader=`varying vec2 vBankData;varying vec3 vGroundPoint;
float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float pebbles(vec2 p){vec2 cell=floor(p),f=fract(p);float d=2.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 q=vec2(float(x),float(y));vec2 jitter=vec2(groundHash(cell+q),groundHash(cell+q+17.));d=min(d,length(q+jitter*.8+.1-f));}return smoothstep(.08,.34,d);}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float shoreWeight=max(1.-smoothstep(6.,14.,abs(vBankData.x)),vBankData.y);float aa=1.-smoothstep(.18,.65,length(fwidth(vGroundPoint.xz)));if(shoreWeight>.01&&aa>.01){float gravel=pebbles(vGroundPoint.xz*2.4);float mottling=groundHash(floor(vGroundPoint.xz*.35));diffuseColor.rgb*=mix(1.,.84+.23*gravel,shoreWeight*aa);diffuseColor.rgb*=mix(1.,.94+.08*mottling,shoreWeight*.5);}`);
  };
  // A single regional buffer forced the GPU to draw the entire high-detail river
  // corridor even at eye level. Compact 1km chunks retain identical shared-edge
  // positions and normals, but let Three's camera frustum reject unseen terrain.
  const coveredMaterials=new Map<THREE.Material,THREE.Material>();
  if(landcover)for(const base of [material,plainMaterial]){const copy=base.clone();copy.name=base===material?'bank-cover':'land-cover';copy.onBeforeCompile=base.onBeforeCompile;applyRiverLandcover(copy,landcover);coveredMaterials.set(base,copy);}
  const normals=geometry.getAttribute('normal'),chunks=new Map<string,number[]>();
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2],x=(positions[a*3]+positions[b*3]+positions[c*3])/3,z=(positions[a*3+2]+positions[b*3+2]+positions[c*3+2])/3;
    // Dense bank/platform triangles get 250m chunks; broad source-DEM triangles
    // keep 1km chunks. All vertex attributes and triangles remain unchanged.
    const edge=(u:number,v:number)=>Math.hypot(positions[u*3]-positions[v*3],positions[u*3+2]-positions[v*3+2]);
    const chunkSize=Math.max(edge(a,b),edge(b,c),edge(c,a))<2?25:100;
    const distances=[banks[a*2],banks[b*2],banks[c*2]],banked=distances.some(v=>Math.abs(v)<14)||[a,b,c].some(v=>banks[v*2+1]>0)||(Math.min(...distances)<=0&&Math.max(...distances)>=0);
    // Where all vertices have zero shoreline weight, linear interpolation also
    // yields zero. Use the identical base material without the gravel shader.
    const key=`${banked?'bank':'land'}:${chunkSize}:${Math.floor(x/chunkSize)}:${Math.floor(z/chunkSize)}`;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key)!.push(a,b,c);}
  const group=new THREE.Group();group.name='Source DEM chunks with OSM shores and display bathymetry';group.userData.sourceBounds=bounds;group.userData.nativeRockDetail=nativeRockDetailEnabled?BI_NATIVE_ROCK_DETAIL:null;group.userData.chunkCount=chunks.size;
  for(const [key,source] of chunks){const lookup=new Map<number,number>(),p:number[]=[],c:number[]=[],n:number[]=[],b:number[]=[],ix:number[]=[];
    for(const old of source){let id=lookup.get(old);if(id===undefined){id=p.length/3;lookup.set(old,id);p.push(positions[old*3],positions[old*3+1],positions[old*3+2]);c.push(colors[old*3],colors[old*3+1],colors[old*3+2]);n.push(normals.getX(old),normals.getY(old),normals.getZ(old));b.push(banks[old*2],banks[old*2+1]);}ix.push(id);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('bankData',new THREE.Float32BufferAttribute(b,2));g.setIndex(ix);g.computeBoundingSphere();let surface=key.startsWith('bank:')?material:plainMaterial;
    if(landcover){g.computeBoundingBox();const box=g.boundingBox!,b=landcover.data.worldBounds;if(box.max.x*10>=b[0]&&box.min.x*10<=b[2]&&box.max.z*10>=b[1]&&box.min.z*10<=b[3])surface=coveredMaterials.get(surface)! as THREE.MeshStandardMaterial;}
    const mesh=new THREE.Mesh(g,surface);mesh.name='terrain chunk '+key;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  geometry.dispose();return group;
}
