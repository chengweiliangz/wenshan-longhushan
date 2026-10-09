import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createObject3DDisposer} from './scene/disposeObject3D';
import {attachExplorationInput} from './experience/explorationInput';
import {createPalaceNavigation,palaceExploreAsset,PALACE_METRES_TO_SCENE} from './palaceExploreNavigation';
import type {PalaceExplorePose,PalaceSiteId,PalaceNavigation} from './palaceExploreNavigation';
import './palace-explore.css';
export type {PalaceExplorePose} from './palaceExploreNavigation';
export type PalaceExploreViewProps={siteId:PalaceSiteId;onBack:()=>void;pose?:PalaceExplorePose;onPose?:(value:PalaceExplorePose)=>void};
type Input=ReturnType<typeof attachExplorationInput>;
type ViewerApi={input:Input;save:()=>void;canvas:HTMLCanvasElement};
const siteLabels:Record<PalaceSiteId,string>={zhengyi:'正一观',tianshi:'天师府',shangqing:'上清宫'};
const directions=[{id:'forward',label:'向前',symbol:'↑',f:1,r:0},{id:'left',label:'向左',symbol:'←',f:0,r:-1},{id:'back',label:'向后',symbol:'↓',f:-1,r:0},{id:'right',label:'向右',symbol:'→',f:0,r:1}];
const sourceHref=(value:string)=>/^https?:\/\//i.test(value)?value:undefined;

export function PalaceExploreView({siteId,onBack,pose,onPose}:PalaceExploreViewProps){
 const host=useRef<HTMLDivElement>(null),marker=useRef<SVGCircleElement>(null),heading=useRef<SVGPathElement>(null),api=useRef<ViewerApi|null>(null);
 const resume=useRef({siteId,value:pose}),save=useRef({siteId,callback:onPose});
 if(resume.current.siteId!==siteId)resume.current={siteId,value:pose};
 save.current={siteId,callback:onPose};
 const held=useRef(new Map<string,{f:number;r:number;fast?:boolean}>());
 const [attempt,setAttempt]=useState(0),[status,setStatus]=useState('载入内部空间…'),[error,setError]=useState(false),[ready,setReady]=useState(false),[locked,setLocked]=useState(false);
 const [navigation,setNavigation]=useState<PalaceNavigation|null>(null),[zone,setZone]=useState('入口'),[landmark,setLandmark]=useState<{label:string;description:string}|null>(null),[restoredNotice,setRestoredNotice]=useState('');
 const applyPad=()=>{let f=0,r=0,fast=false;for(const value of held.current.values()){f+=value.f;r+=value.r;fast=fast||Boolean(value.fast);}api.current?.input.setUIInput(f,r,fast);};
 const releasePad=(key:string)=>{held.current.delete(key);applyPad();};
 const clearPad=()=>{held.current.clear();api.current?.input.clearUIInput();};
 const back=()=>{api.current?.save();clearPad();onBack();};
 useEffect(()=>{
  const ownSave=onPose,abort=new AbortController(),timeout=setTimeout(()=>{abort.abort();fail('内部空间载入超时，请重试。');},30000),releaseRoot=createObject3DDisposer();
  let cancelled=false,disposed=false,readyNow=false,focused=document.hasFocus?.()??true,raf=0,last=performance.now(),lastHud=0,input:Input|null=null;
  let renderer:THREE.WebGLRenderer|null=null,scene:THREE.Scene|null=null,canvas:HTMLCanvasElement|null=null,observer:ResizeObserver|null=null,ownedSun:THREE.DirectionalLight|null=null,controller:ReturnType<PalaceNavigation['createExplorer']>|null=null;
  const removers:(()=>void)[]=[];
  const listen=(target:EventTarget,event:string,handler:EventListener)=>{target.addEventListener(event,handler);removers.push(()=>target.removeEventListener(event,handler));};
  const available=()=>readyNow&&!disposed&&!cancelled&&focused&&!document.hidden;
  const commit=()=>{
   if(!controller||!readyNow)return;held.current.clear();input?.clearInput();controller.clearInput();
   const value=controller.snapshot();if(resume.current.siteId===siteId)resume.current={siteId,value};
   const callback=save.current.siteId===siteId?save.current.callback:ownSave;callback?.(value);
  };
  const dispose=()=>{
   if(disposed)return;commit();disposed=true;readyNow=false;abort.abort();clearTimeout(timeout);cancelAnimationFrame(raf);observer?.disconnect();
   held.current.clear();input?.dispose();for(const remove of removers)remove();
   if(api.current?.canvas===canvas)api.current=null;
   if(canvas){canvas.dataset.ready='false';canvas.dataset.disposed='true';canvas.dataset.released=JSON.stringify(releaseRoot(scene));}
   else releaseRoot(scene);
   ownedSun?.shadow.map?.dispose();renderer?.dispose();renderer?.forceContextLoss();canvas?.remove();
  };
  const fail=(message:string)=>{
   if(cancelled||disposed)return;dispose();setReady(false);setLocked(false);setError(true);setStatus(message);
  };
  setError(false);setReady(false);setLocked(false);setNavigation(null);setRestoredNotice('');setLandmark(null);setZone('入口');setStatus('载入内部空间…');
  void(async()=>{
   const jsonURL=new URL(palaceExploreAsset(siteId),window.location.href);
   const response=await fetch(jsonURL,{signal:abort.signal});if(!response.ok)throw new Error(`Navigation HTTP ${response.status}`);
   const nav=createPalaceNavigation(await response.json(),siteId);if(cancelled||disposed)return;
   try{controller=nav.createExplorer(resume.current.siteId===siteId?resume.current.value:undefined);}
   catch{controller=nav.createExplorer();setRestoredNotice('上次位置与当前模型不兼容，已回到入口。');}
   const hostNode=host.current;if(!hostNode)throw new Error('Viewer was removed');
   setNavigation(nav);setZone(nav.zoneAt(controller.pose().position.x,controller.pose().position.z)?.label??'连接步道');
   renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
   canvas=renderer.domElement;canvas.className='palace-explore-canvas';canvas.tabIndex=0;canvas.setAttribute('role','region');canvas.setAttribute('aria-label',`${nav.document.label}艺术化内部自由探索：WASD或方向键移动，Shift快走，拖动画面环视；Esc释放鼠标`);
   Object.assign(canvas.dataset,{site:siteId,ready:'false',modelStatus:'loading',disposed:'false',userData:JSON.stringify({kind:'artistic-palace-interior',metresToScene:PALACE_METRES_TO_SCENE})});hostNode.append(canvas);
   scene=new THREE.Scene();scene.background=new THREE.Color('#c9d4c9');
   const camera=new THREE.PerspectiveCamera(64,1,.012,100);camera.up.set(0,1,0);
   // Roofed rooms retain soft fill light. Materials keep their authored sidedness.
   scene.add(new THREE.HemisphereLight('#f1f2de','#899679',1.35),new THREE.AmbientLight('#fff0d4',.28));
   const sun=new THREE.DirectionalLight('#fff3d6',2.2);ownedSun=sun;sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.00015;sun.shadow.normalBias=.012;scene.add(sun,sun.target);
   for(const room of nav.zones.filter(z=>/hall|room|殿|堂|室/.test(z.id+' '+z.label)).slice(0,6)){
    const x=(room.bounds[0]+room.bounds[2])/2,z=(room.bounds[1]+room.bounds[3])/2,g=nav.sampleGround(x,z)??0;
    const light=new THREE.PointLight('#ffe9bd',.18,5,2);light.position.set(x,g+.32,z);scene.add(light);
   }
   input=attachExplorationInput({canvas,controller,canMove:available,canLook:available,getSensitivity:()=>.0025,onPointerLockChange:value=>{
    held.current.clear();if(!cancelled&&!disposed)setLocked(value);
   }});
   api.current={input,save:commit,canvas};
   const stop=()=>{held.current.clear();input?.clearInput();};
   const synchronize=()=>{controller?.setSuspended(!available());input?.refreshEnabled();};
   listen(window,'blur',()=>{focused=false;stop();synchronize();});
   listen(window,'focus',()=>{focused=true;stop();synchronize();last=performance.now();});
   listen(document,'visibilitychange',()=>{stop();synchronize();last=performance.now();});
   listen(window,'keydown',((event:KeyboardEvent)=>{if(event.key==='Escape'||event.code==='Escape')stop();}) as EventListener);
   listen(document,'focusin',((event:FocusEvent)=>{const target=event.target as HTMLElement|null;if(target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable)){held.current.clear();}}) as EventListener);
   listen(canvas,'pointerdown',()=>canvas?.focus({preventScroll:true}));
   listen(canvas,'webglcontextlost',event=>{event.preventDefault();fail('三维画面已中断，请重试或返回景区。');});
   const resize=()=>{
    if(disposed||!renderer)return;const rect=hostNode.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
   };
   observer=new ResizeObserver(resize);observer.observe(hostNode);resize();
   const updatePose=(dt:number,now:number)=>{
    if(!controller||!canvas||disposed)return;synchronize();const p=controller.advance(dt);
    camera.position.set(p.position.x,p.position.y,p.position.z);camera.lookAt(p.position.x+p.direction.x,p.position.y+p.direction.y,p.position.z+p.direction.z);
    const currentZone=nav.zoneAt(p.position.x,p.position.z),near=nav.nearbyLandmark(p.position.x,p.position.z,3.5);
    Object.assign(canvas.dataset,{ready:String(readyNow),camera:camera.position.toArray().join(','),worldposition:camera.position.toArray().join(','),direction:[p.direction.x,p.direction.y,p.direction.z].join(','),zone:currentZone?.id??'connection',zoneLabel:currentZone?.label??'连接步道',groundY:String(p.groundY),yaw:String(p.yaw),pitch:String(p.pitch),collisionCount:String(nav.colliders.length),suspended:String(controller.snapshot().suspended)});
    const mapScale=Math.max(nav.bounds[2]-nav.bounds[0],nav.bounds[3]-nav.bounds[1])*.07;
    marker.current?.setAttribute('cx',String(p.position.x));marker.current?.setAttribute('cy',String(p.position.z));
    heading.current?.setAttribute('d',`M ${p.position.x} ${p.position.z} l ${p.direction.x*mapScale} ${p.direction.z*mapScale}`);
    if(now-lastHud>=160){lastHud=now;setZone(currentZone?.label??'连接步道');setLandmark(near?{label:near.label,description:near.description}:null);}
   };
   updatePose(0,performance.now());
   setStatus('载入宫观模型…');const modelURL=new URL(nav.document.modelSrc,jsonURL);
   const modelResponse=await fetch(modelURL,{signal:abort.signal});if(!modelResponse.ok)throw new Error(`Model HTTP ${modelResponse.status}`);
   const buffer=await modelResponse.arrayBuffer();if(cancelled||disposed)return;
   const gltf=await new GLTFLoader().parseAsync(buffer,new URL('.',modelURL).href);
   if(cancelled||disposed){releaseRoot(gltf.scene);return;}
   gltf.scene.scale.setScalar(PALACE_METRES_TO_SCENE);
   gltf.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;mesh.castShadow=!/floor|ground|pavement|地面/i.test(mesh.name);mesh.receiveShadow=true;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value instanceof THREE.Texture)value.anisotropy=Math.min(4,renderer!.capabilities.getMaxAnisotropy());});
   scene.add(gltf.scene);const modelBounds=new THREE.Box3().setFromObject(gltf.scene),span=Math.max(nav.bounds[2]-nav.bounds[0],nav.bounds[3]-nav.bounds[1],2),cx=(nav.bounds[0]+nav.bounds[2])/2,cz=(nav.bounds[1]+nav.bounds[3])/2,top=modelBounds.isEmpty()?1:modelBounds.max.y;sun.position.set(cx-span*.7,top+span*1.3,cz+span*.8);sun.target.position.set(cx,Math.min(...nav.floors.map(f=>f.height)),cz);Object.assign(sun.shadow.camera,{left:-span*.85,right:span*.85,top:span*.85,bottom:-span*.85,near:.05,far:span*4+Math.max(1,top)*2});sun.shadow.camera.updateProjectionMatrix();sun.target.updateMatrixWorld();renderer.shadowMap.needsUpdate=true;canvas.dataset.modelStatus='ready';canvas.dataset.model=nav.document.modelSrc;
   readyNow=true;setReady(true);setStatus('自由步行已就绪');clearTimeout(timeout);synchronize();updatePose(0,performance.now());
   const render=(now:number)=>{
    if(cancelled||disposed)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    try{const frameStart=performance.now();updatePose(dt,now);if(!document.hidden)renderer!.render(scene!,camera);if(canvas)Object.assign(canvas.dataset,{drawCalls:String(renderer!.info.render.calls),triangles:String(renderer!.info.render.triangles),frameTime:(performance.now()-frameStart).toFixed(2)});}
    catch{fail('三维渲染中断，请重试或返回景区。');return;}
    raf=requestAnimationFrame(render);
   };
   last=performance.now();raf=requestAnimationFrame(render);
  })().catch(reason=>{if(cancelled||disposed)return;fail(reason?.name==='AbortError'?'内部空间载入超时，请重试。':'内部空间暂未载入，请重试或返回景区。');});
  return()=>{cancelled=true;dispose();};
 },[siteId,attempt]);
 const mapBounds=navigation?.bounds,mapWidth=mapBounds?mapBounds[2]-mapBounds[0]:1,mapHeight=mapBounds?mapBounds[3]-mapBounds[1]:1;
 return <section className="palace-explore" data-palace-explore-root tabIndex={-1} aria-label={`${siteLabels[siteId]}内部自由探索`}>
  <header className="palace-explore-toolbar">
   <div><strong>{siteLabels[siteId]}</strong><span>艺术化内部 · 自由步行</span></div>
   <div className="palace-explore-actions"><button type="button" data-palace-action="lock" disabled={!ready} onClick={()=>{const viewer=api.current;if(!viewer)return;if(viewer.input.isPointerLocked())document.exitPointerLock?.();else{viewer.canvas.focus({preventScroll:true});void viewer.input.requestPointerLock();}}}>{locked?'释放鼠标':'锁定环视'}</button><button type="button" data-palace-action="back" onClick={back}>返回景区</button></div>
  </header>
  <div className="palace-explore-viewport" ref={host}>
   <div className="palace-explore-zone"><span>当前区域</span><strong>{zone}</strong></div>
   {!ready&&<div className="palace-explore-load" role={error?'alert':'status'}><p>{status}</p>{error&&<button type="button" onClick={()=>setAttempt(value=>value+1)}>重新载入</button>}</div>}
   <div className="palace-explore-pad" aria-label="触屏移动方向盘">
    {directions.map(direction=><button key={direction.id} className={'palace-pad-'+direction.id} data-palace-move={direction.id} type="button" disabled={!ready} aria-label={direction.label}
     onPointerDown={event=>{event.preventDefault();held.current.set('pointer-'+event.pointerId,{f:direction.f,r:direction.r});event.currentTarget.setPointerCapture(event.pointerId);applyPad();}}
     onPointerUp={event=>releasePad('pointer-'+event.pointerId)} onPointerCancel={event=>releasePad('pointer-'+event.pointerId)} onLostPointerCapture={event=>releasePad('pointer-'+event.pointerId)}
     onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();held.current.set('key-'+direction.id,{f:direction.f,r:direction.r});applyPad();}}}
     onKeyUp={event=>{if(event.key===' '||event.key==='Enter')releasePad('key-'+direction.id);}} onBlur={()=>releasePad('key-'+direction.id)}>{direction.symbol}</button>)}
    <button className="palace-pad-stop" type="button" disabled={!ready} aria-label="停止移动" onClick={()=>{held.current.clear();api.current?.input.clearInput();}}>停</button>
   </div>
   {mapBounds&&<svg className="palace-explore-minimap" viewBox={`${mapBounds[0]} ${mapBounds[1]} ${mapWidth} ${mapHeight}`} role="img" aria-label="艺术化空间示意与当前位置">
    {navigation!.floors.map(floor=><rect key={floor.id} x={floor.bounds[0]} y={floor.bounds[1]} width={floor.bounds[2]-floor.bounds[0]} height={floor.bounds[3]-floor.bounds[1]} />)}
    {navigation!.colliders.map((collider,i)=>'min' in collider&&<rect key={i} className="is-wall" x={collider.min.x} y={collider.min.z} width={collider.max.x-collider.min.x} height={collider.max.z-collider.min.z}/>)}
    <path ref={heading}/><circle ref={marker} r={Math.max(mapWidth,mapHeight)*.018}/>
   </svg>}
  </div>
  <p className="palace-explore-help">WASD / 方向键移动 · Shift 快走 · 拖动画面环视 · Esc 释放鼠标<span>触屏：一指按方向，另一指拖动画面</span></p>
  {restoredNotice&&<p className="palace-explore-restore" role="status">{restoredNotice}</p>}
  {landmark&&<p className="palace-explore-observation"><strong>{landmark.label}</strong> {landmark.description}</p>}
  <details className="palace-explore-basis"><summary>艺术化空间说明与依据</summary><p>{navigation?.document.notice??'室内布局为艺术化建模，空间关系与陈设不表示已核验的测绘复原。'}</p>{navigation?.document.sources.map((source,i)=><p key={i}>{sourceHref(source.url)?<a href={sourceHref(source.url)} target="_blank" rel="noreferrer">{source.title} ↗</a>:<strong>{source.title}</strong>} · {source.basis}</p>)}</details>
 </section>;
}
export default PalaceExploreView;
