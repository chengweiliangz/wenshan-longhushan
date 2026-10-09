import {useEffect,useRef,useState} from 'react';
import './palace-route.css';
import {routeMapLabel} from './routeMapLabel';
import {measurePath,pointOnPath,advancePath} from '../shared/route-path.mjs';
type Vec3=[number,number,number];
type RouteViewpoint={id:string;label:string;target:Vec3;fov?:number;photoId?:string};
type RouteNode={id:string;label:string;pathIndex:number;position:Vec3;target:Vec3;photoId?:string;observation?:string;viewpoints?:RouteViewpoint[]};
type Route={id:string;label:string;source?:string;sourceLabel?:string;modelSrc:string;path:Vec3[];nodes:RouteNode[];notice?:string;planBounds?:[number,number,number,number];floorRings?:[number,number][][];context?:string};
export type RoutePose={distance:number;node:number;yaw:number;pitch:number;fov:number;paused?:boolean;followPath?:boolean;destination?:number;travelMode?:'node'|'step';activeView?:string};
/** A bounded, source-based observation route. It does not invent off-route spaces. */
export function InteriorRouteView({src,label,photoIds=[],onBack,onPhotos,pose,onPose}:{src:string;label?:string;photoIds?:readonly string[];onBack:()=>void;onPhotos:(photoId:string)=>void;pose?:RoutePose;onPose?:(value:RoutePose)=>void}){
 const marker=useRef<SVGCircleElement>(null),routeProgress=useRef<HTMLSpanElement>(null);
 const host=useRef<HTMLDivElement>(null),save=useRef(onPose);save.current=onPose;
 const [attempt,setAttempt]=useState(0),[status,setStatus]=useState('载入路线资料…'),[error,setError]=useState(false),[route,setRoute]=useState<Route|null>(null),[node,setNode]=useState(pose?.node??0),[moving,setMoving]=useState(false),[paused,setPaused]=useState(pose?.paused??false),[photoNode,setPhotoNode]=useState(0),[travelMode,setTravelMode]=useState<'node'|'step'>(pose?.travelMode??'node'),[activeView,setActiveView]=useState(pose?.activeView??'');
 const activeViewRef=useRef(activeView);activeViewRef.current=activeView;
 const api=useRef<{go:(index:number)=>void;zoom:(delta:number)=>void;reset:()=>void;pause:()=>void;step:(meters:number)=>void;look:(view:RouteViewpoint)=>void}|null>(null);
 const routeLabel=label?.trim()||route?.label?.trim()||'局部参观路线',observationNode=route?.nodes[photoNode];
 const photoId=observationNode?.viewpoints?.find(v=>v.id===activeView)?.photoId??observationNode?.photoId;
 const hasPhoto=!!photoId&&photoIds.includes(photoId),source=route?.source?.trim();
 const mapTextSize=route?.planBounds?Math.max(route.planBounds[2]/98,route.planBounds[3]/125)*11:4;
 const sourceHref=source&&/^https?:\/\//i.test(source)?source:undefined,sourceLabel=route?.sourceLabel?.trim()||'查看路线来源资料';
 useEffect(()=>{
  let cancelled=false,dispose=()=>{};const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);
  setError(false);setRoute(null);setPhotoNode(0);setStatus('载入路线资料…');setMoving(false);setPaused(false);setActiveView(pose?.activeView??'');
  void(async()=>{
   const response=await fetch(src,{signal:abort.signal});if(!response.ok)throw new Error(`Route HTTP ${response.status}`);const data:Route=await response.json(),distances=measurePath(data.path);
   if(!Array.isArray(data.nodes)||data.nodes.length<2||data.nodes.some(n=>!Number.isInteger(n.pathIndex)||!data.path[n.pathIndex]||!Array.isArray(n.target)||n.target.length!==3||n.target.some(v=>!Number.isFinite(v))||n.viewpoints?.some(v=>v.target.length!==3||v.target.some(x=>!Number.isFinite(x)))))throw new Error('Invalid observation nodes');
   const [T,{GLTFLoader}]=await Promise.all([import('three'),import('three/examples/jsm/loaders/GLTFLoader.js')]);if(cancelled)return;
   setRoute(data);const hostNode=host.current!,renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NeutralToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
   const canvas=renderer.domElement;hostNode.append(canvas);canvas.tabIndex=0;canvas.setAttribute('role','region');canvas.setAttribute('aria-label',`${data.label||'局部参观路线'}三维观察：拖动或方向键转动，PageDown下一站、PageUp上一站，W或S沿路线微移，加减号缩放，空格暂停`);
   const scene=new T.Scene();scene.background=new T.Color('#d9e1e2');scene.fog=new T.Fog('#d9e1e2',145,245);
   const camera=new T.PerspectiveCamera(pose?.fov??62,1,.06,280);camera.rotation.order='YXZ';
   scene.add(new T.HemisphereLight('#f1f5ff','#8a8171',2.1));const sun=new T.DirectionalLight('#fff6e4',2.5);sun.position.set(-20,40,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:100});sun.shadow.bias=-.00025;sun.shadow.normalBias=.015;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);scene.add(sun.target);const shadowCenter=new T.Vector3(Infinity,0,Infinity);let lastShadowUpdate=-Infinity,shadowUpdates=0,mapUpdated=-Infinity,mapX=NaN,mapZ=NaN,progressText='';
   let ready=false,disposed=false,raf=0,current=Math.max(0,Math.min(data.nodes.length-1,Math.trunc(pose?.node??0))),distance=Math.max(0,Math.min(distances.at(-1)!,pose?.distance??0)),destination=pose?.travelMode==='step'&&Number.isFinite(pose.destination)?Math.max(0,Math.min(distances.at(-1)!,pose.destination!)):distances[data.nodes[current].pathIndex],autoLook=pose?.followPath??false,isPaused=pose?.paused??false,lastPhoto=-1;
   let mode:'node'|'step'=pose?.travelMode??'node';
   let yaw=pose?.yaw??0,pitch=pose?.pitch??0,last=performance.now();const target=new T.Vector3(),direction=new T.Vector3();
   const aim=(followPath=false)=>{
    target.fromArray(data.nodes[current].target);direction.copy(target).sub(camera.position).normalize();
    const finalYaw=Math.atan2(-direction.x,-direction.z),finalPitch=Math.asin(direction.y),remaining=Math.abs(destination-distance);
    if(!followPath||remaining<.001)return{yaw:finalYaw,pitch:finalPitch};
    // Look ahead on the same traced route; blend to the observation target near arrival.
    const ahead=pointOnPath(data.path,distances,distance+Math.sign(destination-distance)*Math.min(3,remaining)),travelYaw=Math.atan2(camera.position.x-ahead[0],camera.position.z-ahead[2]);
    const arrival=1-Math.min(1,remaining/2.5),turn=Math.atan2(Math.sin(finalYaw-travelYaw),Math.cos(finalYaw-travelYaw));
    return{yaw:travelYaw+turn*arrival,pitch:-.06+(finalPitch+.06)*arrival};
   };
   camera.position.fromArray(pointOnPath(data.path,distances,distance) as Vec3);if(!pose){const a=aim();yaw=a.yaw;pitch=a.pitch;}
   const go=(index:number)=>{if(!ready||index<0||index>=data.nodes.length)return;current=index;mode='node';setTravelMode(mode);setActiveView('');isPaused=false;setPaused(false);destination=distances[data.nodes[index].pathIndex];autoLook=true;setNode(index);setMoving(Math.abs(destination-distance)>.001);if(matchMedia('(prefers-reduced-motion: reduce)').matches){distance=destination;camera.position.fromArray(pointOnPath(data.path,distances,distance) as Vec3);const a=aim();yaw=a.yaw;pitch=a.pitch;setMoving(false);}};
   const zoom=(delta:number)=>{camera.fov=T.MathUtils.clamp(camera.fov+delta,35,85);camera.updateProjectionMatrix();};
   const observe=()=>{autoLook=false;setActiveView('');if(ready&&distance!==destination){isPaused=true;setPaused(true);}};
   const step=(meters:number)=>{if(!ready)return;observe();mode='step';setTravelMode(mode);destination=T.MathUtils.clamp(distance+meters,0,distances.at(-1)!);current=data.nodes.reduce((best,n,i)=>Math.abs(distances[n.pathIndex]-destination)<Math.abs(distances[data.nodes[best].pathIndex]-destination)?i:best,0);setNode(current);isPaused=false;setPaused(false);setMoving(distance!==destination);if(matchMedia('(prefers-reduced-motion: reduce)').matches){distance=destination;setMoving(false);}};
   api.current={go,zoom,pause:()=>{if(ready&&distance!==destination){isPaused=!isPaused;setPaused(isPaused);}},step,look:(view)=>{if(!ready)return;observe();target.fromArray(view.target);direction.copy(target).sub(camera.position).normalize();yaw=Math.atan2(-direction.x,-direction.z);pitch=Math.asin(direction.y);camera.fov=T.MathUtils.clamp(view.fov??62,35,85);camera.updateProjectionMatrix();setActiveView(view.id);},reset:()=>{observe();const nearest=data.nodes.reduce((best,n,i)=>Math.abs(distances[n.pathIndex]-distance)<Math.abs(distances[data.nodes[best].pathIndex]-distance)?i:best,0);target.fromArray(data.nodes[nearest].target);direction.copy(target).sub(camera.position).normalize();yaw=Math.atan2(-direction.x,-direction.z);pitch=Math.asin(direction.y);camera.fov=62;camera.updateProjectionMatrix();}};
   const pointers=new Map<number,{x:number;y:number}>();let pinch=0;
   const pinchSize=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
   canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});observe();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2)pinch=pinchSize();});
   canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});autoLook=false;if(pointers.size===2){const next=pinchSize();zoom((pinch-next)*.1);pinch=next;}else if(pointers.size===1){yaw-=(e.clientX-old.x)*.004;pitch=T.MathUtils.clamp(pitch-(e.clientY-old.y)*.004,-1.25,1.25);}});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>pointers.delete((e as PointerEvent).pointerId));
   canvas.addEventListener('wheel',e=>{e.preventDefault();observe();zoom(e.deltaY*.025)},{passive:false});
   canvas.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key===' '){e.preventDefault();api.current?.pause();}else if(e.key==='PageDown'){e.preventDefault();go(current+1);}else if(e.key==='PageUp'){e.preventDefault();go(current-1);}else if(e.key.toLowerCase()==='w'||e.key.toLowerCase()==='s'){e.preventDefault();if(!e.repeat)step(e.key.toLowerCase()==='w'?1:-1);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();observe();yaw+=e.key==='ArrowLeft'?.1:e.key==='ArrowRight'?-.1:0;pitch=T.MathUtils.clamp(pitch+(e.key==='ArrowUp'?.08:e.key==='ArrowDown'?-.08:0),-1.25,1.25);}else if(['+','=','-','_'].includes(e.key)){e.preventDefault();zoom(e.key==='-'||e.key==='_'?5:-5);}});
   const release=(root:import('three').Object3D)=>{const materials=new Set<import('three').Material>(),textures=new Set<import('three').Texture>(),geometries=new Set<import('three').BufferGeometry>();root.traverse(o=>{const m=o as import('three').Mesh;if(m.geometry)geometries.add(m.geometry);for(const material of Array.isArray(m.material)?m.material:m.material?[m.material]:[]){materials.add(material);for(const v of Object.values(material))if(v instanceof T.Texture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());const bitmaps=new Set<ImageBitmap>();textures.forEach(t=>{if(typeof ImageBitmap!=='undefined'&&t.image instanceof ImageBitmap)bitmaps.add(t.image);t.dispose();});bitmaps.forEach(b=>b.close());return{geometries:geometries.size,materials:materials.size,textures:textures.size,bitmaps:bitmaps.size};};
   const resize=new ResizeObserver(()=>{const r=hostNode.getBoundingClientRect();const width=Math.max(1,r.width),height=Math.max(1,r.height);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(hostNode);
   dispose=()=>{if(disposed)return;disposed=true;if(ready)save.current?.({distance,node:current,yaw,pitch,fov:camera.fov,paused:isPaused,followPath:autoLook,destination,travelMode:mode,activeView:activeViewRef.current});cancelAnimationFrame(raf);resize.disconnect();api.current=null;const released=release(scene);sun.shadow.map?.dispose();renderer.dispose();canvas.dataset.released=JSON.stringify(released);canvas.dataset.disposed='true';renderer.forceContextLoss();canvas.remove();};
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed||cancelled)return;abort.abort();clearTimeout(timeout);setError(true);setStatus('三维画面已中断，可重试或返回外部视角。');dispose();});
   const render=(now:number)=>{if(cancelled||disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(ready&&!isPaused&&distance!==destination){distance=advancePath(distance,destination,dt);if(distance===destination)setMoving(false);}camera.position.fromArray(pointOnPath(data.path,distances,distance) as Vec3);if(autoLook){const a=aim(true),delta=Math.atan2(Math.sin(a.yaw-yaw),Math.cos(a.yaw-yaw));yaw+=delta*(1-Math.exp(-dt*4));pitch+=(a.pitch-pitch)*(1-Math.exp(-dt*4));}camera.rotation.set(pitch,yaw,0);if(ready&&now-lastShadowUpdate>140&&Math.hypot(camera.position.x-shadowCenter.x,camera.position.z-shadowCenter.z)>2){shadowCenter.copy(camera.position);shadowCenter.y=0;sun.target.position.copy(shadowCenter);sun.position.copy(shadowCenter).add(new T.Vector3(-20,40,25));sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;shadowUpdates++;}renderer.render(scene,camera);if(marker.current&&(now-mapUpdated>120||isPaused||distance===destination)&&(camera.position.x!==mapX||camera.position.z!==mapZ)){marker.current.setAttribute('cx',String(camera.position.x));marker.current.setAttribute('cy',String(camera.position.z));mapX=camera.position.x;mapZ=camera.position.z;mapUpdated=now;}const progress=`路线位置 ${distance.toFixed(0)} / ${distances.at(-1)!.toFixed(0)} m（估算）`;if(routeProgress.current&&progress!==progressText){routeProgress.current.textContent=progress;progressText=progress;}const nearest=data.nodes.reduce((best,n,i)=>Math.abs(distances[n.pathIndex]-distance)<Math.abs(distances[data.nodes[best].pathIndex]-distance)?i:best,0);if(nearest!==lastPhoto){if(lastPhoto>=0)setActiveView('');lastPhoto=nearest;setPhotoNode(nearest);}Object.assign(canvas.dataset,{route:data.id,node:data.nodes[current].id,distance:String(distance),destination:String(destination),camera:camera.position.toArray().join(','),yaw:String(yaw),pitch:String(pitch),fov:String(camera.fov),ready:String(ready),moving:String(!isPaused&&distance!==destination),paused:String(isPaused),followPath:String(autoLook),travelMode:mode,photo:data.nodes[nearest].photoId??'',shadowUpdates:String(shadowUpdates),triangles:String(renderer.info.render.triangles),drawCalls:String(renderer.info.render.calls)});raf=requestAnimationFrame(render);};raf=requestAnimationFrame(render);
   setStatus('载入路线模型…');const modelResponse=await fetch(data.modelSrc,{signal:abort.signal});if(!modelResponse.ok)throw new Error(`Model HTTP ${modelResponse.status}`);const total=Number(modelResponse.headers.get('content-length')),reader=modelResponse.body?.getReader();if(!reader)throw new Error('No model body');const chunks:Uint8Array[]=[];let size=0;
   while(true){const item=await reader.read();if(item.done)break;chunks.push(item.value);size+=item.value.length;if(!cancelled)setStatus(total?`路线模型 ${Math.round(size/total*100)}%`:'正在读取路线模型…');}const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}const gltf=await new GLTFLoader().parseAsync(buffer.buffer,'');if(cancelled||disposed){release(gltf.scene);return;}
   gltf.scene.traverse(o=>{const m=o as import('three').Mesh;if(m.isMesh){m.castShadow=!/floor|context/i.test(m.name);m.receiveShadow=true;for(const material of Array.isArray(m.material)?m.material:[m.material])for(const value of Object.values(material))if(value instanceof T.Texture)value.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}});scene.add(gltf.scene);
   // Limited presentation ground for the cropped Tianshi court only. It is never a route surface.
   // The other two models already cover their inspected route views with their own paving.
   if(data.id==='tianshi-court-route'&&data.floorRings?.[0]?.length){
    gltf.scene.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3());
    if(!bounds.isEmpty()&&[size.x,size.z].every(v=>Number.isFinite(v)&&v>0&&v<160)){
     const floor=data.floorRings[0],cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2;
     const groundY=data.path[0][1]-1.65-.15; // -0.41m: below the -0.26m paving, at the inherited tree roots.
     const outline=(pad:number)=>{const points:[number,number][]=[],x0=bounds.min.x-pad,x1=bounds.max.x+pad,z0=bounds.min.z-pad,z1=bounds.max.z+pad,r=2;
      for(const [x,z,start] of [[x1-r,z1-r,0],[x0+r,z1-r,Math.PI/2],[x0+r,z0+r,Math.PI],[x1-r,z0+r,3*Math.PI/2]])for(let i=0;i<=8;i++){const a=start+i*Math.PI/16;points.push([x+Math.cos(a)*r,z+Math.sin(a)*r]);}return points;};
     const inner=outline(3),outer=outline(7),shape=new T.Shape(inner.map(([x,z])=>new T.Vector2(x,-z)));
     const center=floor.reduce((c,p)=>[c[0]+p[0]/floor.length,c[1]+p[1]/floor.length],[0,0]);
     // Leave the original courtyard and its enclosed feature empty underneath; only 18cm edge overlap.
     const hole=new T.Path(floor.map(([x,z])=>new T.Vector2(x+Math.sign(center[0]-x)*.18,-z-Math.sign(center[1]-z)*.18)));hole.closePath();shape.holes.push(hole);
     const coreGeometry=new T.ShapeGeometry(shape);coreGeometry.rotateX(-Math.PI/2);coreGeometry.translate(0,groundY,0);
     const base=new T.Color('#7b7d69'),colorAt=(x:number,z:number)=>base.clone().multiplyScalar(.98+.035*Math.sin(x*.37+z*.21)+.025*Math.cos(z*.49-x*.13));
     const coreColors:number[]=[];const corePositions=coreGeometry.getAttribute('position');for(let i=0;i<corePositions.count;i++){const c=colorAt(corePositions.getX(i),corePositions.getZ(i));coreColors.push(c.r,c.g,c.b);}coreGeometry.setAttribute('color',new T.Float32BufferAttribute(coreColors,3));
     const core=new T.Mesh(coreGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));core.name='BP finite Tianshi illustrative ground';core.receiveShadow=true;
     const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
     for(let i=0;i<inner.length;i++){for(const [ring,alpha] of [[inner,1],[outer,0]] as const){const [x,z]=ring[i],c=colorAt(x,z);vertices.push(x,groundY,z);colors.push(c.r,c.g,c.b,alpha);}const a=i*2,b=((i+1)%inner.length)*2;indices.push(a,b,a+1,b,b+1,a+1);}
     const fadeGeometry=new T.BufferGeometry();fadeGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));fadeGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,4));fadeGeometry.setIndex(indices);fadeGeometry.computeVertexNormals();
     const fade=new T.Mesh(fadeGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,transparent:true,depthWrite:false,side:T.DoubleSide}));fade.name='BP finite Tianshi soft ground edge';fade.receiveShadow=true;
     const ground=new T.Group();ground.name='BP illustrative ground transition - not walkable';ground.userData={kind:'illustrative-ground-transition',walkable:false,basis:'Existing Tianshi model bounds and original courtyard edge; approximate presentation surface'};ground.add(core,fade);scene.add(ground);
     canvas.dataset.groundTransition='illustrative-non-walkable';canvas.dataset.groundBounds=JSON.stringify({min:[bounds.min.x-7,groundY,bounds.min.z-7],max:[bounds.max.x+7,groundY,bounds.max.z+7],floorHole:true,fadeMeters:4});
    }
   }
   renderer.shadowMap.needsUpdate=true;ready=true;setNode(current);setMoving(distance!==destination);setPaused(isPaused);clearTimeout(timeout);setStatus('');
  })().catch(e=>{clearTimeout(timeout);if(!cancelled){console.error('路线模型载入失败',e);setError(true);setStatus('路线模型暂未载入，可重试或返回外部视角。');dispose();}});
  return()=>{cancelled=true;clearTimeout(timeout);abort.abort();dispose();};
 },[src,attempt]);
 return <section className="interior-route palace-route" data-viewpoint={activeView} data-comparison-photo={photoId??''} aria-label={`${routeLabel} · 路线资料模型`}>
  <div className="route-top">
   <button onClick={onBack}>← 返回原外部视角</button>
   <strong role="status">{moving&&!paused?(travelMode==='step'?'沿现有路线微移':'前往：'+(route?.nodes[node]?.label??routeLabel)):'停留观察：'+(observationNode?.label??routeLabel)}</strong>
   <button disabled={!hasPhoto} title={hasPhoto?undefined:'当前观察节点暂无可核验的对应实拍'} onClick={()=>{if(hasPhoto&&photoId)onPhotos(photoId);}}>对照附近实拍</button>
  </div>
  {route?.context&&<p className="palace-route-context">{route.context}</p>}
  <div className="route-stage"><div className="route-viewport"><div className="route-host" ref={host}/>{status&&<div className="model-status" role="status">{status}{error&&<button onClick={()=>setAttempt(a=>a+1)}>重试路线</button>}</div>}
   <div className="palace-route-mode">{moving&&!paused?'沿线行走 · 拖动画面即可停留':'原地观察 · 可拖动环看'}</div>
   <div className="route-zoom"><button disabled={!!status} aria-label="放大路线视野" onClick={()=>api.current?.zoom(-7)}>＋</button><button disabled={!!status} aria-label="缩小路线视野" onClick={()=>api.current?.zoom(7)}>－</button><button disabled={!!status} onClick={()=>api.current?.reset()}>朝向观察目标</button></div>
  </div>{route?.planBounds&&<aside className="route-map" aria-label="资料平面中的当前位置"><svg viewBox={route.planBounds.join(' ')} role="img" aria-label="路线、观察节点和移动位置"><path d={route.floorRings?.map(r=>'M '+r.map(p=>p.join(',')).join(' L ')+' Z').join(' ')} fill="#dce0d5" fillRule="evenodd"/><polyline points={route.path.map(p=>`${p[0]},${p[2]}`).join(' ')} fill="none" stroke="#4a7563" strokeWidth=".8"/>{route.nodes.map((n,i)=>{const label=routeMapLabel(route.id,n.id,n.position,mapTextSize,route.planBounds!);return <g key={n.id}><circle cx={n.position[0]} cy={n.position[2]} r="1.4" fill={photoNode===i?'#814b31':'#ba995d'}/><text x={label.x} y={label.y} textAnchor={label.anchor} fontSize={mapTextSize} fill="#274c3a">{i+1}</text></g>;})}<circle ref={marker} r="1.8" fill="#fff" stroke="#a76c36" strokeWidth=".65"/><text x={route.planBounds[0]+4} y={route.planBounds[1]+mapTextSize+2} fontSize={mapTextSize} fill="#274c3a">路线平面</text></svg><span ref={routeProgress}/></aside>}</div>
  <div className="palace-route-walk" role="group" aria-label="沿现有路线观察">
   <button disabled={!!status||node===0} onClick={()=>api.current?.go(node-1)}>← 上一站</button>
   <button disabled={!!status} onClick={()=>api.current?.step(-1)} aria-label="沿现有路线后移约一米">后移一步</button>
   <button disabled={!!status||!moving} onClick={()=>api.current?.pause()}>{moving?(paused?'继续沿线':'停留观察'):'已停留'}</button>
   <button disabled={!!status} onClick={()=>api.current?.step(1)} aria-label="沿现有路线前移约一米">前移一步</button>
   <button disabled={!!status||!route||node>=route.nodes.length-1} onClick={()=>api.current?.go(node+1)}>下一站 →</button>
  </div>
  {observationNode&&<div className="palace-route-observation"><div><small>附近观察点 {String(photoNode+1).padStart(2,'0')}</small><h3>{observationNode.label}</h3><p>{observationNode.observation??'可在此原地环看，再沿资料路线前往下一处。观察位置与距离为模型内估算。'}</p></div>{!!observationNode.viewpoints?.length&&<div className="palace-route-looks" role="group" aria-label="本节点观察方向">{observationNode.viewpoints.map(v=><button key={v.id} disabled={!!status} aria-pressed={activeView===v.id} onClick={()=>api.current?.look(v)}>{v.label}</button>)}</div>}</div>}
  <p className="route-help">拖动或方向键会停留观察 · 双指或加减号缩放 · W / S 沿线微移约1米 · PageUp / PageDown 换站 · 空格暂停或继续。所有移动仅沿图示估计路线。</p>
  <nav className="route-nodes" aria-label="路线观察节点">{route?.nodes.map((n,i)=><button key={n.id} disabled={!!status} aria-current={node===i?'step':undefined} onClick={()=>api.current?.go(i)}><span>{String(i+1).padStart(2,'0')}</span>{n.label}</button>)}</nav>
  <p className="visit-note">{route?.notice??'局部空间资料模型；非扫描或360°实拍。观察范围以路线所示区域为限。'}{route?.id==='tianshi-court-route'?' 模型周边的有限地面与柔化边缘为示意过渡，不是测绘地形，也不增加可行走范围。':''}{hasPhoto?' 实拍用于对照所在区域，拍摄点未做相机标定。':' 当前观察节点暂无可核验的对应实拍。'}</p>
  {sourceHref?<a className="route-source" href={sourceHref} target="_blank" rel="noreferrer">依据：{sourceLabel} ↗</a>:<p className="route-source">{route?`依据：${route.sourceLabel?.trim()||'路线来源资料待补充'}`:'载入路线来源资料…'}</p>}
 </section>;
}
