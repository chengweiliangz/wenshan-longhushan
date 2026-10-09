import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createPropGroundSampler,fitPropToGround,measurePropExposure,type PropGroundingResult} from './propGrounding';
import {displayGroundOverride,displayInWalkable,displayToWorld,worldToDisplayLocal,type DisplayLayout,type DisplayPoint} from './displayLayout';
export type DisplayEnvironmentOptions={groundAt:(x:number,z:number)=>number;containsWater:(x:number,z:number)=>boolean;low?:boolean;sourceGround?:THREE.Object3D};
export type DisplayEnvironment=THREE.Group&{groundAt:(x:number,z:number)=>number;disposeInstances:()=>void};
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

/** Local artistic landscape, using metres/10 scene units. No canvas, fetched asset or extra GLB. */
export function createDisplayEnvironment(layout:DisplayLayout,options:DisplayEnvironmentOptions):DisplayEnvironment{
 const group=new THREE.Group() as DisplayEnvironment;group.name=layout.label+' · artistic riverside grounds';
 const instances:THREE.InstancedMesh[]=[];
 group.groundAt=(x,z)=>displayGroundOverride([layout],x,z,options.groundAt(x,z),options.containsWater);
 group.disposeInstances=()=>instances.forEach(m=>m.dispose());
 group.userData={displayId:layout.id,artistic:true,notice:layout.notice,spatialUnits:'1 scene unit = 10 metres',sourceBuildingsUnchanged:true};
 if(!layout.artistic)return group;
 const isZ=layout.id==='zhengyi',isT=layout.id==='tianshi',random=rng(isZ?72643:isT?98127:82917),scale=layout.model.scale;
 const materials={soil:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),stone:new THREE.MeshStandardMaterial({color:isZ?'#9e8e70':isT?'#a69f8a':'#b7b7a4',roughness:.93}),rock:new THREE.MeshStandardMaterial({color:isZ?'#9d795c':isT?'#8d8e7d':'#aaa18c',roughness:1,vertexColors:true}),wood:new THREE.MeshStandardMaterial({color:isZ?'#87734d':isT?'#74644a':'#837b62',roughness:.91}),dark:new THREE.MeshStandardMaterial({color:'#514d3d',roughness:1}),leaf:new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:false,roughness:1}),bark:new THREE.MeshStandardMaterial({color:isT?'#665f50':'#706452',roughness:1}),grass:new THREE.MeshStandardMaterial({color:isZ?'#758466':isT?'#79856a':'#7d886d',roughness:1,side:THREE.DoubleSide})};
 const local=layout.support.localBoundsModelMeters,blend=layout.support.blendMeters/(scale*10),b=[local[0]-blend,local[1]-blend,local[2]+blend,local[3]+blend],spacing=options.low?2.5:1.5,cols=Math.ceil((b[2]-b[0])/spacing),rows=Math.ceil((b[3]-b[1])/spacing);
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],wet:boolean[]=[],color=new THREE.Color(),soilColor=new THREE.Color(isZ?'#7d8267':isT?'#929685':'#9a9d84'),outerColor=new THREE.Color(isZ?'#6f795e':isT?'#738266':'#7e8a71'),forecourtColor=new THREE.Color('#a3a390');
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const x=lerp(b[0],b[2],i/cols),z=lerp(b[1],b[3],j/rows),p=displayToWorld(layout,[x,0,z]),y=group.groundAt(p[0],p[2]);
  positions.push(p[0],y+.002,p[2]);wet.push(options.containsWater(p[0],p[2]));
  const outside=Math.max(0,local[0]-x,x-local[2],local[1]-z,z-local[3]),t=Math.min(1,outside/Math.max(1,blend));
  color.copy(isT&&z>=134&&Math.abs(x)<46?forecourtColor:soilColor).lerp(outerColor,t).multiplyScalar(.95+Math.sin(x*.61+z*.39)*.024+Math.cos(x*.17-z*.29)*.024);colors.push(color.r,color.g,color.b);
  if(i<cols&&j<rows){const a=j*(cols+1)+i,c=a+cols+1;indices.push(a,c,a+1,a+1,c,c+1);}
 }
 const dry:number[]=[];for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];if(!wet[a]&&!wet[b]&&!wet[c]){const x=(positions[a*3]+positions[b*3]+positions[c*3])/3,z=(positions[a*3+2]+positions[b*3+2]+positions[c*3+2])/3;if(!options.containsWater(x,z))dry.push(a,b,c);}}
 const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.setIndex(dry);terrain.computeVertexNormals();terrain.computeBoundingSphere();
 const patch=new THREE.Mesh(terrain,materials.soil);patch.name='continuous '+spacing+'m artistic support and graded transition';patch.receiveShadow=true;patch.castShadow=true;group.add(patch);
 group.userData.supportVertexCount=positions.length/3;group.userData.supportTriangles=dry.length/3;group.userData.supportSpacingMeters=spacing*scale*10;
 const parts={wood:[] as THREE.BufferGeometry[],stone:[] as THREE.BufferGeometry[],dark:[] as THREE.BufferGeometry[]};
 const v=(p:DisplayPoint)=>new THREE.Vector3(...p);
 function strip(a:DisplayPoint,b:DisplayPoint,width:number,depth:number){
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1,nx=dz/length*width/2,nz=-dx/length*width/2;
  const points=[[a[0]-nx,a[1],a[2]-nz],[a[0]+nx,a[1],a[2]+nz],[b[0]+nx,b[1],b[2]+nz],[b[0]-nx,b[1],b[2]-nz]],p=points.concat(points.map(q=>[q[0],q[1]-depth,q[2]])).flat(),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex([0,3,1,1,3,2,4,5,7,5,6,7,0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6,3,0,7,0,4,7]);g.computeVertexNormals();return g;
 }
 function beam(a:DisplayPoint,b:DisplayPoint,radius:number,material:'wood'|'dark'='wood'){
  const aa=v(a),bb=v(b),g=new THREE.CylinderGeometry(radius*.86,radius,aa.distanceTo(bb),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bb.clone().sub(aa).normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);parts[material].push(g);
 }
 // Source stair boxes share a -1.6m bottom; fill only their original footprint to the graded soil.
 if(isZ){
  const a=displayToWorld(layout,[0,-1.599,78.23]),b=displayToWorld(layout,[0,-1.599,81.08]);
  const probeHeights=[-11.01,0,11.01].flatMap(x=>[78.23,79.65,81.08].map(z=>{const p=displayToWorld(layout,[x,0,z]);return group.groundAt(p[0],p[2]);}));
  const bottom=Math.min(...probeHeights)-.005,depth=a[1]-bottom;
  parts.stone.push(strip(a,b,22.02*scale,depth));
  group.userData.stairFooting={artistic:true,localBoundsMeters:[-11.01,78.23,11.01,81.08],sourceStairBottomMeters:-1.6,topLocalMeters:-1.599,bottomSceneY:bottom,topSceneY:a[1],minimumSoilEmbedMeters:(Math.min(...probeHeights)-bottom)*10,maximumOriginalGroundGapMeters:(layout.model.position[1]-1.6*scale-Math.min(...probeHeights))*10};
 }
 const walk=layout.landing.walkPath;
 const pierBounds=walk.reduce((bounds,p)=>({minX:Math.min(bounds.minX,p[0]-layout.landing.widthScene),maxX:Math.max(bounds.maxX,p[0]+layout.landing.widthScene),minZ:Math.min(bounds.minZ,p[2]-layout.landing.widthScene),maxZ:Math.max(bounds.maxZ,p[2]+layout.landing.widthScene)}),{minX:layout.model.position[0]-.1,maxX:layout.model.position[0]+.1,minZ:layout.model.position[2]-.1,maxZ:layout.model.position[2]+.1});
 const pierContact=createPropGroundSampler(options.sourceGround?[patch,options.sourceGround]:[patch],pierBounds);
 const pierPosts:{x:number;z:number;topY:number;bottomY:number;surfaceMinimumY:number|null}[]=[];
 let pierLegacyFallbacks=0;
 function pierFoot(x:number,z:number,originalBottom:number,topY:number){
  const heights:number[]=[];for(let j=0;j<=6;j++){const a=j*Math.PI/3,y=pierContact.sample(Math.fround(x+(j===6?0:Math.sin(a)*.0075)),Math.fround(z+(j===6?0:Math.cos(a)*.0075)));if(y===null){if(options.sourceGround)throw new Error('No actual river bed beneath pier post at '+x+','+z);pierLegacyFallbacks++;continue;}heights.push(y);}
  const surface=heights.length?Math.min(...heights):null,bottom=surface===null?originalBottom:Math.min(originalBottom,surface-.01);
  pierPosts.push({x,z,topY,bottomY:bottom,surfaceMinimumY:surface});return bottom;
 }
 for(let i=1;i<walk.length;i++){
  const aa=walk[i-1],bb=walk[i],length=Math.hypot(bb[0]-aa[0],bb[2]-aa[2]),overwater=i<=2,width=layout.landing.widthScene,dx=(bb[0]-aa[0])/(length||1),dz=(bb[2]-aa[2])/(length||1),at=(t:number):DisplayPoint=>[lerp(aa[0],bb[0],t),lerp(aa[1],bb[1],t),lerp(aa[2],bb[2],t)];
  // A small boarding overlap begins 0.8 m from the centre toward the gunwale.
  const begin=i===1?Math.min(.08/length,.9):0;
  const count=Math.max(1,Math.ceil(length*(1-begin)/(overwater?.027:.11)));
  for(let j=0;j<count;j++){
   const a=at(lerp(begin,1,j/count)),b=at(lerp(begin,1,(j+.96)/count));const mid=worldToDisplayLocal(layout,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]);if(!overwater&&((isZ&&Math.abs(mid[0])<2.5&&mid[2]>=81&&mid[2]<=116)||(isT&&mid[2]>=135&&mid[2]<=local[3]&&mid[0]>=local[0]&&mid[0]<=local[2])))continue;parts[overwater?'wood':'stone'].push(strip(a,b,width,overwater?.023:.018));
  }
  if(overwater){
   const posts=Math.max(2,Math.ceil(length/.3));
   for(let j=0;j<=posts;j++){
    const t=j/posts;if(t<begin)continue;const p=at(t);
    for(const sign of [-1,1]){const x=p[0]+dz*width*.46*sign,z=p[2]-dx*width*.46*sign;beam([x,pierFoot(x,z,isT?Math.min(p[1]-.11,layout.landing.waterAnchor[1]-.10):p[1]-.11,p[1]+.094),z],[x,p[1]+.094,z],.0075);}
   }
   for(const sign of [-1,1])for(const h of [.043,.09]){
    const a=at(begin),b=at(1);beam([a[0]+dz*width*.46*sign,a[1]+h,a[2]-dx*width*.46*sign],[b[0]+dz*width*.46*sign,b[1]+h,b[2]-dx*width*.46*sign],.006);
   }
  }
 }
 group.userData.pierGrounding={source:options.sourceGround?'actual-source-bed-and-dry-support':'legacy-support-only',embedScene:.01,posts:pierPosts,index:pierContact.getStats(),legacyFallbacks:pierLegacyFallbacks};pierContact.dispose();
 // Low, planted stone beds flank the Tian Shi forecourt; they are artistic, outside all walking regions.
 if(isT)for(const x of [-43,48])for(const z of [142,153,164]){
  const a=displayToWorld(layout,[x,0,z-1.9]),b=displayToWorld(layout,[x,0,z+1.9]);a[1]=group.groundAt(a[0],a[2])+.045;b[1]=group.groundAt(b[0],b[2])+.045;parts.stone.push(strip(a,b,.32,.045));
 }
 // Low retaining courses mark the dry terrace edge; the approach and central view remain open.
 for(const side of [-1,1]){
  const x=side<0?local[0]:local[2],start=local[1]+3,end=local[3]-15;
  for(let z=start;z<end;z+=2.5){
   const a=displayToWorld(layout,[x,0,z]),b=displayToWorld(layout,[x,0,Math.min(end,z+2.42)]);a[1]=group.groundAt(a[0],a[2])+.065;b[1]=group.groundAt(b[0],b[2])+.065;
   if(!options.containsWater(a[0],a[2])&&!options.containsWater(b[0],b[2]))parts.stone.push(strip(a,b,.052,.075));
  }
 }
 for(const key of ['wood','stone','dark'] as const)if(parts[key].length){parts[key].forEach(p=>p.deleteAttribute('uv'));const g=mergeGeometries(parts[key],false);parts[key].forEach(p=>p.dispose());if(g){g.computeBoundingSphere();const mesh=new THREE.Mesh(g,materials[key]);mesh.name=key+' artistic landing and terrace details';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}}
 const rockG=new THREE.IcosahedronGeometry(1,1),rp=rockG.getAttribute('position'),rcolors=[];
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),f=1+.11*Math.sin(x*11+z*7)+.07*Math.cos(y*9-x*4);rp.setXYZ(i,x*f,y*(.82+.09*Math.sin(z*8)),z*f);const shade=.86+.14*(y+1)/2;rcolors.push(shade,shade*.98,shade*.93);}rockG.setAttribute('color',new THREE.Float32BufferAttribute(rcolors,3));rockG.computeVertexNormals();
 const dummy=new THREE.Object3D(),rockPos:{x:number;z:number;s:number;y:number;rotation:number}[]=[],treePos:{x:number;z:number;height:number;width:number;seed:number}[]=[],grassPos:{x:number;z:number;size:number}[]=[];
 function allowed(x:number,z:number,clearance=.06){
  if(options.containsWater(x,z)||displayInWalkable(layout,x,z))return false;
  for(const [dx,dz]of [[clearance,0],[-clearance,0],[0,clearance],[0,-clearance]])if(displayInWalkable(layout,x+dx,z+dz)||options.containsWater(x+dx,z+dz))return false;
  const p=worldToDisplayLocal(layout,[x,layout.model.position[1],z]);return!(p[2]>layout.viewCorridor.localStartZ&&Math.abs(p[0])<layout.viewCorridor.localHalfWidthMeters);
 }
 // Clusters are asymmetric: Zhengyi bamboo/garden edges; Shangqing open limestone court with taller rear evergreens.
 const targetTrees=options.low?(isT?26:24):(isT?46:42);
 for(let attempt=0;attempt<500&&treePos.length<targetTrees;attempt++){
  const side=random()<.47?-1:1,band=5+Math.pow(random(),.7)*(isT?16:22),x=(side<0?local[0]:local[2])+side*band,z=isT?[-80,-22,48,105,148][Math.floor(random()*5)]+(random()-.5)*18:lerp(local[1]-20,local[3]-17,random()),p=displayToWorld(layout,[x,0,z]);
  if(!allowed(p[0],p[2],.35)||treePos.some(t=>Math.hypot(t.x-p[0],t.z-p[2])<.42))continue;
  const height=(isZ?5.3:isT?6.0:6.6)+random()*(isZ?5.4:isT?4.6:7.0);treePos.push({x:p[0],z:p[2],height:height/10,width:(isZ?3.1:isT?3.3+random()*1.1:2.4+random()*.8)/10,seed:random()});
 }
 if(isT)for(const x of [-43,48])for(const z of [142,153,164]){const p=displayToWorld(layout,[x,0,z]);treePos.push({x:p[0],z:p[2],height:.145,width:.13,seed:random()});}
 for(let attempt=0;attempt<(options.low?250:600);attempt++){
  const angle=random()*Math.PI*2,front=random()<.24,x=lerp(local[0]-13,local[2]+13,random()),z=front?lerp(local[3]-4,local[3]+20,random()):lerp(local[1]-12,local[3]+12,random()),p=displayToWorld(layout,[x,0,z]);
  const outside=Math.max(local[0]-x,x-local[2],local[1]-z,z-local[3]);
  if(outside<-1||!allowed(p[0],p[2],.08))continue;
  if(random()<.38)rockPos.push({x:p[0],z:p[2],s:(.55+random()*1.8)/10,y:random(),rotation:angle});
  else grassPos.push({x:p[0],z:p[2],size:(.24+random()*.75)/10});
 }
 const propBounds=[...rockPos,...treePos,...grassPos].reduce((bounds,p)=>({minX:Math.min(bounds.minX,p.x-.8),maxX:Math.max(bounds.maxX,p.x+.8),minZ:Math.min(bounds.minZ,p.z-.8),maxZ:Math.max(bounds.maxZ,p.z+.8)}),{minX:layout.model.position[0]-.8,maxX:layout.model.position[0]+.8,minZ:layout.model.position[2]-.8,maxZ:layout.model.position[2]+.8});
 const contacts=createPropGroundSampler(options.sourceGround?[patch,options.sourceGround]:[patch],propBounds);
 let fallbackSamples=0;
 const actualGround=(x:number,z:number)=>{const y=contacts.sample(x,z);if(y!==null||options.sourceGround)return y;fallbackSamples++;return group.groundAt(x,z);};
 const grounding:{rock:PropGroundingResult[];tree:PropGroundingResult[];grass:PropGroundingResult[]}={rock:[],tree:[],grass:[]};
 const fit=(kind:keyof typeof grounding,g:THREE.BufferGeometry,baseFraction:number,embedScene:number)=>{
  dummy.updateMatrix();const matrix=new THREE.Matrix4().fromArray(new Float32Array(dummy.matrix.elements));
  const result=fitPropToGround(g,matrix,actualGround,{baseFraction,embedScene});dummy.position.y+=result.translationY;dummy.updateMatrix();grounding[kind].push(result);return result;
 };
 const rocks=new THREE.InstancedMesh(rockG,materials.rock,rockPos.length);
 rockPos.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(p.y*.4,p.rotation,.05);dummy.scale.set(p.s*(1.2+p.y),p.s*.48,p.s*(.7+p.y*.4));fit('rock',rockG,.32,Math.max(.006,Math.min(.018,p.s*.08)));rocks.setMatrixAt(i,dummy.matrix);});
 // Only the independently audited finite high/low deterministic stones may change XZ.
 // Other instances retain their exact original matrices except for grounding Y.
 const rockRelocations:Record<string,unknown>[]=[];
 const relocationIndices=options.low?(isZ?[5]:isT?[19,20]:[1,17]):(isZ?[4,58]:isT?[6,31]:[]);
 if(options.sourceGround)for(const index of relocationIndices){
  if(index>=rockPos.length)continue;const before=new THREE.Matrix4();rocks.getMatrixAt(index,before);const exposureBefore=measurePropExposure(rockG,before,actualGround);
  if(exposureBefore.visibleFraction>=.1)continue;
  const oldPosition:[number,number]=[before.elements[12],before.elements[14]],oldBox=new THREE.Box3().setFromBufferAttribute(rp as THREE.BufferAttribute).applyMatrix4(before);
  const otherBoxes=rockPos.map((_r,i)=>{const m=new THREE.Matrix4();rocks.getMatrixAt(i,m);return new THREE.Box3().setFromBufferAttribute(rp as THREE.BufferAttribute).applyMatrix4(m);});
  const smallTianShi=Boolean(options.low&&isT&&index===20),requiredTop=smallTianShi?.35*(grounding.rock[index].baseCutoffY-grounding.rock[index].baseMinY)/.32:.025,maxRing=18;
  let chosen:{matrix:THREE.Matrix4;fit:PropGroundingResult;exposure:ReturnType<typeof measurePropExposure>}|null=null;
  search:for(let ring=1;ring<=maxRing;ring++)for(let direction=0;direction<32;direction++){
   const angle=direction*Math.PI/16,radius=ring*.025,x=Math.fround(oldPosition[0]+Math.cos(angle)*radius),z=Math.fround(oldPosition[1]+Math.sin(angle)*radius),q=worldToDisplayLocal(layout,[x,layout.model.position[1],z]),outside=Math.max(local[0]-q[0],q[0]-local[2],local[1]-q[2],q[2]-local[3]);
   if(outside<-1||q[0]<local[0]-13||q[0]>local[2]+13||q[2]<local[1]-12||q[2]>local[3]+20||!allowed(x,z,.08))continue;
   const matrix=before.clone();matrix.elements[12]=x;matrix.elements[14]=z;matrix.elements[13]=0;
   const result=fitPropToGround(rockG,matrix,actualGround,{baseFraction:.32,embedScene:grounding.rock[index].embedScene});
   if(result.missingSamples)continue;matrix.elements[13]=Math.fround(result.translationY);
   const candidateBox=new THREE.Box3().setFromBufferAttribute(rp as THREE.BufferAttribute).applyMatrix4(matrix);
   if(otherBoxes.some((box,i)=>i!==index&&candidateBox.intersectsBox(box)&&!oldBox.intersectsBox(box)))continue;
   if(treePos.some(tree=>tree.x>=candidateBox.min.x-.035&&tree.x<=candidateBox.max.x+.035&&tree.z>=candidateBox.min.z-.035&&tree.z<=candidateBox.max.z+.035))continue;
   const exposure=measurePropExposure(rockG,matrix,actualGround);
   if(exposure.missingSamples||exposure.visibleFraction<.3||exposure.maximumTopGapScene<requiredTop)continue;
   chosen={matrix,fit:result,exposure};break search;
  }
  if(chosen){rocks.setMatrixAt(index,chosen.matrix);grounding.rock[index]=chosen.fit;rockRelocations.push({index,status:'moved',beforeXZ:oldPosition,afterXZ:[chosen.matrix.elements[12],chosen.matrix.elements[14]],distanceMeters:Math.hypot(chosen.matrix.elements[12]-oldPosition[0],chosen.matrix.elements[14]-oldPosition[1])*10,exposureBefore,exposureAfter:chosen.exposure,minimumExposedHeightScene:requiredTop,maxSearchDistanceMeters:maxRing*.25,embedScene:chosen.fit.embedScene});}
  else rockRelocations.push({index,status:'unresolved',beforeXZ:oldPosition,exposureBefore});
 }
 group.userData.rockRelocations=rockRelocations;
rocks.name='irregular weathered terrace stones';rocks.castShadow=rocks.receiveShadow=true;rocks.computeBoundingSphere();group.add(rocks);instances.push(rocks);
 // A small palette of lobed crowns and branching silhouettes avoids a row of identical spheres.
 const crownG=new THREE.IcosahedronGeometry(1,1),trunkG=new THREE.CylinderGeometry(.72,1,1,6),trunks=new THREE.InstancedMesh(trunkG,materials.bark,treePos.length*3),crowns=new THREE.InstancedMesh(crownG,materials.leaf,treePos.length*7);
 const branchConnections:{tree:number;branch:number;start:DisplayPoint;end:DisplayPoint}[]=[];
 treePos.forEach((p,i)=>{
  const h=p.height;dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.seed*6.28,0);dummy.scale.set(.018,h*.6,.018);fit('tree',trunkG,0,.004);trunks.setMatrixAt(i*3,dummy.matrix);
  const mainMatrix=new THREE.Matrix4();trunks.getMatrixAt(i*3,mainMatrix);const base=mainMatrix.elements[13]-mainMatrix.elements[5]/2,floor=base+.004,crownCentres:THREE.Vector3[]=[];
  for(let j=0;j<7;j++){
   const a=j*2.399+p.seed*8,level=j/7,reach=p.width*(j===0?.08:.55+random()*.2),narrow=!isZ&&!isT;
   dummy.position.set(p.x+Math.cos(a)*reach,floor+h*(.59+level*.32),p.z+Math.sin(a)*reach);dummy.rotation.set(random()*.5,a,random()*.4);dummy.scale.set(p.width*(.48+random()*.21),h*(narrow?.25:.16),p.width*(.48+random()*.17));dummy.updateMatrix();crowns.setMatrixAt(i*7+j,dummy.matrix);
   crownCentres.push(new THREE.Vector3(Math.fround(dummy.position.x),Math.fround(dummy.position.y),Math.fround(dummy.position.z)));
   const c=new THREE.Color().setHSL((isZ?.235:isT?.278:.255)+(random()-.5)*.035,.22+random()*.1,(isT?.28:.23)+random()*.1);crowns.setColorAt(i*7+j,c);
  }
  // A branch starts inside the main trunk axis and terminates inside an actual crown.
  for(let j=1;j<3;j++){
   const start=new THREE.Vector3(mainMatrix.elements[12],base+h*(j===1?.35:.43),mainMatrix.elements[14]),end=crownCentres[j===1?2:5],direction=end.clone().sub(start);
   dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());dummy.scale.set(.009,direction.length(),.009);dummy.updateMatrix();trunks.setMatrixAt(i*3+j,dummy.matrix);
   branchConnections.push({tree:i,branch:j,start:start.toArray() as DisplayPoint,end:end.toArray() as DisplayPoint});
  }
 });
 group.userData.branchConnections=branchConnections;
 for(const mesh of [trunks,crowns]){mesh.name=mesh===trunks?'varied branching trunks':'clustered crowns with open sightline';mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);instances.push(mesh);}
 const gpos:number[]=[],gix:number[]=[];
 for(let blade=0;blade<7;blade++){const a=blade*2.4,w=.13+blade*.009,height=.6+(blade%3)*.17,index=gpos.length/3;gpos.push(-Math.cos(a)*w,0,-Math.sin(a)*w,Math.cos(a)*w,0,Math.sin(a)*w,Math.sin(a)*.2,height,Math.cos(a)*.2);gix.push(index,index+1,index+2);}
 const grassG=new THREE.BufferGeometry();grassG.setAttribute('position',new THREE.Float32BufferAttribute(gpos,3));grassG.setIndex(gix);grassG.computeVertexNormals();const grasses=new THREE.InstancedMesh(grassG,materials.grass,grassPos.length);
 grassPos.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,random()*6.28,0);dummy.scale.setScalar(p.size);fit('grass',grassG,0,.0015);grasses.setMatrixAt(i,dummy.matrix);});grasses.name='sparse native-inspired tussocks';grasses.receiveShadow=true;grasses.computeBoundingSphere();group.add(grasses);instances.push(grasses);
 group.userData.propGrounding={source:options.sourceGround?'final-source-and-support-mesh':'support-mesh-with-legacy-fallback',units:'scene',rockBaseFraction:.32,treeBaseFraction:0,grounding,index:contacts.getStats(),fallbackSamples};contacts.dispose();
 if(!parts.dark.length)materials.dark.dispose();group.userData.boardingStartMeters=.8;group.userData.foliageColorMode='white linear base multiplied once by per-instance green; no geometry vertex colors';group.userData.treeCount=treePos.length;group.userData.rockCount=rockPos.length;group.userData.grassCount=grassPos.length;group.userData.groundFunction='displayGroundOverride';group.userData.walkSurface='getDisplayGround';group.userData.palette=isT?'grey stone forecourt, warm timber trestle, clustered broadleaf evergreens and six planted beds':isZ?'ochre garden terrace':'pale limestone terrace';group.userData.artisticScope=['relocated exterior','graded terrace','trestle access pier','land approach','retaining stone','representative vegetation'];
 return group;
}





export type DisplayTerrainClipRegion={layout:DisplayLayout;localBoundsMeters:readonly[number,number,number,number]};
export type DisplayTerrainClipStats={meshesChanged:number;trianglesExamined:number;trianglesCut:number;trianglesRemoved:number;trianglesAdded:number;removedAreaSquareMeters:number};
/**
 * Replace a narrowly selected dry source-terrain region with the existing dense
 * display support. Rectangles are in unchanged GLB-local metres; no heights move.
 * Call only on the source-terrain group, before terrain contacts/shader attachment.
 * Each source triangle is geometrically cut at the rectangle, preserving every
 * interpolated attribute outside it. This avoids both depth fighting and actual
 * crossings caused by differently triangulated samples of the same grade.
 */
export function clipDisplayTerrainRegions(terrain:THREE.Object3D,regions:readonly DisplayTerrainClipRegion[]):DisplayTerrainClipStats{
 const stats:DisplayTerrainClipStats={meshesChanged:0,trianglesExamined:0,trianglesCut:0,trianglesRemoved:0,trianglesAdded:0,removedAreaSquareMeters:0};
 if(!regions.length)return stats;
 const usable=regions.filter(r=>r.layout.artistic).map(r=>{
  const b=r.localBoundsMeters,s=r.layout.support.localBoundsModelMeters;
  if(b[0]<s[0]||b[1]<s[1]||b[2]>s[2]||b[3]>s[3]||b[0]>=b[2]||b[1]>=b[3])throw new Error('Terrain replacement must stay inside its continuous display support');
  const p=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,z])=>displayToWorld(r.layout,[x,0,z]));
  return{...r,bounds:new THREE.Box3(new THREE.Vector3(Math.min(...p.map(v=>v[0])),-Infinity,Math.min(...p.map(v=>v[2]))),new THREE.Vector3(Math.max(...p.map(v=>v[0])),Infinity,Math.max(...p.map(v=>v[2]))))};
 });
 type Vertex={world:THREE.Vector3;values:number[]};
 const interpolate=(a:Vertex,b:Vertex,t:number):Vertex=>({world:a.world.clone().lerp(b.world,t),values:a.values.map((v,i)=>lerp(v,b.values[i],t))});
 const area=(p:Vertex[])=>{let a=0;for(let i=0;i<p.length;i++){const u=p[i].world,v=p[(i+1)%p.length].world;a+=u.x*v.z-v.x*u.z;}return Math.abs(a)*.5;};
 terrain.updateMatrixWorld(true);
 terrain.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!object.name.startsWith('terrain chunk '))return;
  const original=object.geometry;original.computeBoundingBox();
  const bounds=original.boundingBox!.clone().applyMatrix4(object.matrixWorld),active=usable.filter(r=>r.bounds.intersectsBox(bounds));
  if(!active.length)return;
  const names=Object.keys(original.attributes),attributes=names.map(name=>original.getAttribute(name));
  if(attributes.some(a=>a instanceof THREE.InterleavedBufferAttribute))throw new Error('Source terrain attributes must be non-interleaved');
  const sizes=attributes.map(a=>a.itemSize),offsets:number[]=[];let stride=0;for(const size of sizes){offsets.push(stride);stride+=size;}
  const positions=original.getAttribute('position'),count=original.index?.count??positions.count,output=names.map(()=>[] as number[]);
  let changed=false;
  const vertex=(index:number):Vertex=>({world:new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(object.matrixWorld),values:attributes.flatMap(a=>Array.from({length:a.itemSize},(_,i)=>a.getComponent(index,i)))});
  for(let i=0;i<count;i+=3){
   const triangle=[0,1,2].map(j=>vertex(original.index?original.index.getX(i+j):i+j));stats.trianglesExamined++;
   let polygons=[triangle],cut=false,removedArea=0;
   for(const region of active){
    const next:Vertex[][]=[],b=region.localBoundsMeters;
    const distances=(v:Vertex)=>{const q=worldToDisplayLocal(region.layout,[v.world.x,v.world.y,v.world.z]);return[q[0]-b[0],b[2]-q[0],q[2]-b[1],b[3]-q[2]];};
    for(const polygon of polygons){
     if([0,1,2,3].some(edge=>polygon.every(v=>distances(v)[edge]<0))){next.push(polygon);continue;}
     let remaining=polygon;const outsideParts:Vertex[][]=[];
     for(let edge=0;edge<4&&remaining.length;edge++){
      const inside:Vertex[]=[],outside:Vertex[]=[];
      for(let j=0;j<remaining.length;j++){
       const a=remaining[j],c=remaining[(j+1)%remaining.length],da=distances(a)[edge],dc=distances(c)[edge],aInside=da>=0,cInside=dc>=0;
       (aInside?inside:outside).push(a);
       if(aInside!==cInside){const crossing=interpolate(a,c,da/(da-dc));inside.push(crossing);outside.push(crossing);}
      }
      if(outside.length>=3&&area(outside)>1e-12)outsideParts.push(outside);
      remaining=inside;
     }
     const removed=remaining.length>=3?area(remaining):0;
     if(removed>1e-10){cut=true;removedArea+=removed;next.push(...outsideParts);}else next.push(polygon);
    }
    polygons=next;
   }
   if(cut){changed=true;stats.trianglesCut++;stats.removedAreaSquareMeters+=removedArea*100;if(!polygons.length)stats.trianglesRemoved++;}
   let produced=0;
   for(const polygon of polygons)for(let j=1;j<polygon.length-1;j++){
    const tri=[polygon[0],polygon[j],polygon[j+1]];if(area(tri)<=1e-12)continue;produced++;
    for(const v of tri)for(let a=0;a<names.length;a++)for(let component=0;component<sizes[a];component++)output[a].push(v.values[offsets[a]+component]);
   }
   if(cut)stats.trianglesAdded+=Math.max(0,produced-1);
  }
  if(!changed)return;
  const replacement=new THREE.BufferGeometry();
  for(let a=0;a<names.length;a++)replacement.setAttribute(names[a],new THREE.Float32BufferAttribute(output[a],sizes[a]));
  replacement.computeBoundingBox();replacement.computeBoundingSphere();
  object.geometry=replacement;original.dispose();stats.meshesChanged++;
  if(!output[names.indexOf('position')].length)object.visible=false;
 });
 terrain.userData.displayTerrainReplacement={...stats,regions:regions.map(r=>({id:r.layout.id,localBoundsMeters:[...r.localBoundsMeters]})),method:'exact XZ rectangle subtraction; retained attributes interpolated; display heights unchanged'};
 return stats;
}
