import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
const root=new URL('../',import.meta.url),require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const navCode=buildSync({stdin:{contents:"export * from './palaceExploreNavigation';",loader:'ts',resolveDir:fileURLToPath(new URL('src/',root))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const {createPalaceNavigation,PALACE_METRES_TO_SCENE}=await import('data:text/javascript;base64,'+Buffer.from(navCode).toString('base64'));
const close=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b);
const plain=x=>JSON.parse(JSON.stringify(x));
function data(){
 return {version:1,id:'zhengyi',label:'正一观',notice:'艺术化内部，并非测绘复原',modelSrc:'/assets/palace-explore/bz/zhengyi.glb',spawn:{position:[0,0,6],yaw:Math.PI},bounds:[-10,-12,6,8],
 floors:[{id:'court',bounds:[-6,-4,6,8],height:0},{id:'hall',bounds:[-5,-12,5,-4],height:0},{id:'cloister',bounds:[-7,-12,-5,8],height:0},{id:'room',bounds:[-10,-9,-7,-3],height:0}],
 colliders:[{id:'door-left',min:[-5,0,-4.1],max:[-1.2,4,-3.9]},{id:'door-right',min:[1.2,0,-4.1],max:[5,4,-3.9]},
 {id:'hall-side-front',min:[-5.1,0,-6],max:[-4.9,4,-4]},{id:'hall-side-rear',min:[-5.1,0,-12],max:[-4.9,4,-8]},
 {id:'room-front',min:[-7.1,0,-6],max:[-6.9,4,-3]},{id:'room-rear',min:[-7.1,0,-9],max:[-6.9,4,-8]}],
 zones:[{id:'entrance',label:'入口',bounds:[-6,4,6,8],basis:'艺术化布局'},{id:'court',label:'院落',bounds:[-6,-4,6,4],basis:'艺术化布局'},
 {id:'hall',label:'屋顶大厅',bounds:[-5,-12,5,-4],basis:'艺术化布局'},{id:'cloister',label:'廊道',bounds:[-7,-12,-5,8],basis:'艺术化布局'},{id:'room',label:'侧室',bounds:[-10,-9,-7,-3],basis:'艺术化布局'}],
 landmarks:[{id:'hall-view',label:'殿内陈设',position:[0,0,-7],description:'依据传统宫观意象艺术化设计'}],sources:[{title:'建模说明',url:'',basis:'艺术化内部'}]};
}
function walk(c,n,forward=1,right=0,fast=false,dt=.1){c.setInput(forward,right,fast);for(let i=0;i<n;i++)c.advance(dt);c.clearInput();}
test('navigation metres scale once; standing eye, ground, walls and walking speed agree',()=>{
 const nav=createPalaceNavigation(data(),'zhengyi'),c=nav.createExplorer();close(PALACE_METRES_TO_SCENE,.1);assert.deepEqual(nav.spawn,[0,0,6*.1]);close(c.pose().position.y,.16);close(nav.colliders[0].max.y,.4);close(nav.sampleGround(0,-.7),0);
 walk(c,10);close(c.pose().position.z,.34);close(c.pose().position.x,0);close(c.pose().position.y,.16);
});
test('actual free movement reaches entrance, courtyard, roofed hall, cloister and side room through openings',()=>{
 const nav=createPalaceNavigation(data()),c=nav.createExplorer();assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'entrance');
 walk(c,28);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'court');
 walk(c,22);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'hall');close(c.pose().position.z,-.7);
 c.look(Math.PI/2);walk(c,23);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'cloister');
 walk(c,10);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'room');assert.ok(c.pose().position.x<-.8);close(c.pose().position.y,.16);
 c.look(Math.PI);walk(c,33);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'hall');
});
test('off-center forward walk stops at physical doorway wall; strafe slides without tunneling',()=>{
 const nav=createPalaceNavigation(data()),c=nav.createExplorer();walk(c,10,0,1);close(c.pose().position.x,.26);
 walk(c,70,1,0,true);assert.ok(c.pose().position.z>=-.39+.035-1e-8);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'court');
 const z=c.pose().position.z;walk(c,7,1,-1,true);assert.ok(c.pose().position.x<.1);assert.ok(c.pose().position.z<=z);
 walk(c,12,1,0,true);assert.equal(nav.zoneAt(c.pose().position.x,c.pose().position.z).id,'hall');
});
test('floor union chooses highest support, admits small real steps, and footprint rejects open edges',()=>{
 const d=data();d.floors.push({id:'raised-hall',bounds:[-5,-12,5,-4],height:.18});const nav=createPalaceNavigation(d),c=nav.createExplorer();
 close(nav.sampleGround(0,-.5),.018);assert.equal(nav.sampleGround(.8,0),null);walk(c,53);assert.ok(c.pose().position.z<-.7);close(c.pose().groundY,.018);
 assert.ok(c.pose().position.y>.16&&c.pose().position.y<=.178+1e-10);
 c.look(-Math.PI/2);walk(c,120,1,0,true);assert.ok(c.pose().position.x<=.5-.035+1e-8);assert.ok(nav.sampleGround(c.pose().position.x,c.pose().position.z)!==null);
});
test('palace pose restores exact view and smoothing without old held keys; incompatible ground is rejected',()=>{
 const nav=createPalaceNavigation(data()),a=nav.createExplorer();walk(a,30);a.look(.43,.21);a.setInput(1,1,true);const saved=plain(a.snapshot()),b=nav.createExplorer(saved);
 assert.deepEqual(b.pose(),a.pose());assert.deepEqual(b.snapshot().input,{forward:0,right:0,fast:false});for(let i=0;i<30;i++)b.advance(.016);assert.deepEqual(b.pose(),a.pose());
 assert.throws(()=>nav.createExplorer({...saved,groundY:2}),/no longer matches/);assert.throws(()=>nav.createExplorer({...saved,position:{...saved.position,x:9}}),/no longer matches/);
});
test('invalid JSON/site/spawn never reaches renderer; small overlapping regions label the exact current room',()=>{
 assert.throws(()=>createPalaceNavigation({...data(),version:2}),/版本/);assert.throws(()=>createPalaceNavigation(data(),'tianshi'),/地点/);
 assert.throws(()=>createPalaceNavigation({...data(),spawn:{position:[6,0,8],yaw:0}}),/outside walkable/);
 assert.throws(()=>createPalaceNavigation({...data(),spawn:{position:[0,4,6],yaw:0}}),/高度/);
 assert.throws(()=>createPalaceNavigation({...data(),floors:[{id:'bad',bounds:[0,0,Infinity,5],height:0}]}),/坐标/);
 const d=data();d.zones.push({id:'altar',label:'殿内区域',bounds:[-.5,-8,.5,-6],basis:'艺术化'});const nav=createPalaceNavigation(d);
 assert.equal(nav.zoneAt(0,-.7).id,'altar');assert.equal(nav.nearbyLandmark(0,-.7).id,'hall-view');
});

const viewerCode=buildSync({stdin:{contents:readFileSync(new URL('src/PalaceExploreView.tsx',root),'utf8'),loader:'tsx',resolveDir:fileURLToPath(new URL('src/',root)),sourcefile:'actual-palace-viewer-fixture.tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime','three','three/examples/jsm/loaders/GLTFLoader.js'],loader:{'.css':'empty'},write:false,logLevel:'silent'}).outputFiles[0].text;
function eventTarget(){const listeners=new Map();return{addEventListener:(n,f)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener:(n,f)=>listeners.get(n)?.delete(f),dispatch(n,values={}){const e={target:this,preventDefault(){this.prevented=true;},prevented:false,...values};for(const f of [...listeners.get(n)??[]])f(e);return e;},listenerCount:()=>[...listeners.values()].reduce((n,s)=>n+s.size,0)};}
function viewerFixture({parseDeferred=false,rendererFails=false,jsonDeferred=false,pose}={}){
 let time=1000,nextRaf=0,nextTimer=0,lockRequests=0,backCalls=0;const frames=new Map(),timers=new Map(),renderers=[],fetches=[],states=[],refs=[],effects=[],saved=[],counts={geometry:0,material:0,texture:0};
 const window={...eventTarget(),location:{href:'https://palace.test/'},devicePixelRatio:1,performance:{now:()=>time}};
 const document={...eventTarget(),hidden:false,visibilityState:'visible',hasFocus:()=>true,pointerLockElement:null,activeElement:{tagName:'DIV',closest:()=>null}};
 const node=(tag='DIV')=>({...eventTarget(),tagName:tag,ownerDocument:document,style:{},dataset:{},isContentEditable:false,closest:()=>null,removed:false,setAttribute(){},setPointerCapture(){},releasePointerCapture(){},focus(){document.activeElement=this;},remove(){this.removed=true;},getBoundingClientRect:()=>({width:1000,height:600})});
 const host=node(),children=[];host.append=child=>children.push(child);
 document.exitPointerLock=()=>{document.pointerLockElement=null;document.dispatch('pointerlockchange');};
 class Renderer{constructor(){if(rendererFails)throw new Error('WebGL unavailable');this.domElement=node('CANVAS');this.domElement.requestPointerLock=()=>{lockRequests++;document.pointerLockElement=this.domElement;document.dispatch('pointerlockchange');return Promise.resolve();};this.capabilities={getMaxAnisotropy:()=>4};this.shadowMap={};this.info={render:{calls:1,triangles:12}};this.disposes=0;this.losses=0;this.renders=0;renderers.push(this);}setPixelRatio(){}setSize(){}render(){this.renders++;}dispose(){this.disposes++;}forceContextLoss(){this.losses++;}}
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial(),texture=new THREE.Texture();material.map=texture;geometry.addEventListener('dispose',()=>counts.geometry++);material.addEventListener('dispose',()=>counts.material++);texture.addEventListener('dispose',()=>counts.texture++);
 const model=new THREE.Group();model.userData.kind='artistic-palace-interior';model.add(new THREE.Mesh(geometry,material));
 let resolveParse;const parsed=parseDeferred?new Promise(resolve=>{resolveParse=resolve;}):Promise.resolve({scene:model});
 class Loader{parseAsync(){return parsed;}}
 let resolveJSON;const json=jsonDeferred?new Promise(resolve=>{resolveJSON=resolve;}):Promise.resolve(data());
 const fetch=async(url,options)=>{fetches.push({url:String(url),signal:options.signal});return{ok:true,status:200,json:()=>json,arrayBuffer:async()=>new ArrayBuffer(8)};};
 let hook=0;const React={useRef:value=>{const ref={current:value};refs.push(ref);return ref;},useState:value=>{const i=hook++;states[i]=value;return[value,next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useEffect:effect=>effects.push(effect)};
 const jsx=(type,props)=>({type,props});const exports={},module={exports};
 const context=vm.createContext({window,document,fetch,AbortController,URL,performance:window.performance,ResizeObserver:class{observe(){}disconnect(){this.disconnected=true;}},requestAnimationFrame:f=>{frames.set(++nextRaf,f);return nextRaf;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:f=>{timers.set(++nextTimer,f);return nextTimer;},clearTimeout:id=>timers.delete(id),console,module,exports,require:name=>name==='react'?React:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='three'?{...THREE,WebGLRenderer:Renderer}:name==='three/examples/jsm/loaders/GLTFLoader.js'?{GLTFLoader:Loader}:require(name)});
 new vm.Script(viewerCode,{filename:'actual-palace-viewer-fixture.cjs'}).runInContext(context);
 const tree=module.exports.PalaceExploreView({siteId:'zhengyi',pose,onPose:value=>saved.push(plain(value)),onBack:()=>backCalls++});
 const all=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object'||!node.props)return;all.push(node);if(node.props.ref&&node.props.className==='palace-explore-viewport')node.props.ref.current=host;visit(node.props.children);}visit(tree);
 const cleanup=effects[0](),flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
 const step=(n=1)=>{for(let i=0;i<n;i++){time+=16;const next=frames.entries().next().value;if(!next)throw new Error('No viewer RAF');frames.delete(next[0]);next[1](time);}};
 const action=name=>all.find(node=>node.props['data-palace-action']===name);
 const move=name=>all.find(node=>node.props['data-palace-move']===name);
 const pointer=(id)=>({pointerId:id,currentTarget:node('BUTTON'),preventDefault(){}});
 return{window,document,host,children,renderers,model,counts,fetches,states,saved,frames,timers,cleanup,flush,step,action,move,pointer,resolveParse:()=>resolveParse?.({scene:model}),resolveJSON:()=>resolveJSON?.(data()),fireTimeout:()=>[...timers.values()].forEach(f=>f()),get canvas(){return renderers[0]?.domElement;},get lockRequests(){return lockRequests;},get backCalls(){return backCalls;}};
}
test('actual viewer readiness, native keys, independent two-touch pad/look, Esc and blur use the shared controller',async t=>{
 const f=viewerFixture();t.after(f.cleanup);await f.flush();assert.equal(f.canvas.dataset.ready,'true');assert.equal(f.canvas.dataset.site,'zhengyi');assert.equal(f.canvas.dataset.zone,'entrance');close(f.model.scale.x,.1);assert.equal(f.lockRequests,0);
 const before=f.canvas.dataset.camera;f.window.dispatch('keydown',{code:'KeyW',key:'w',ctrlKey:false,metaKey:false,altKey:false});f.step(8);assert.notEqual(f.canvas.dataset.camera,before);f.window.dispatch('keyup',{code:'KeyW',key:'w'});
 f.move('forward').props.onPointerDown(f.pointer(22));f.canvas.dispatch('pointerdown',{pointerId:11,pointerType:'touch',button:0,clientX:100,clientY:100});f.window.dispatch('pointermove',{pointerId:11,pointerType:'touch',clientX:130,clientY:120});const yaw=Number(f.canvas.dataset.yaw);f.step(2);assert.notEqual(Number(f.canvas.dataset.yaw),yaw);const changed=f.canvas.dataset.camera;
 f.window.dispatch('pointercancel',{pointerId:11});f.step(2);assert.notEqual(f.canvas.dataset.camera,changed);f.move('forward').props.onPointerUp(f.pointer(22));f.step();const held=f.canvas.dataset.camera;f.step(10);assert.equal(f.canvas.dataset.camera,held);
 f.action('lock').props.onClick();await f.flush();assert.equal(f.lockRequests,1);f.window.dispatch('keydown',{code:'Escape',key:'Escape'});assert.equal(f.document.pointerLockElement,null);assert.equal(f.backCalls,0);
 f.move('right').props.onPointerDown(f.pointer(44));f.step(2);f.window.dispatch('blur');f.step();const stopped=f.canvas.dataset.camera;f.step(10);assert.equal(f.canvas.dataset.camera,stopped);assert.equal(f.canvas.dataset.suspended,'true');
 f.window.dispatch('focus');f.move('forward').props.onPointerUp(f.pointer(22));f.step(10);assert.equal(f.canvas.dataset.camera,stopped);
 f.action('back').props.onClick();assert.equal(f.backCalls,1);assert.ok(f.saved.length);assert.equal(f.saved.at(-1).input.forward,0);
 f.cleanup();assert.equal(f.renderers[0].disposes,1);assert.equal(f.renderers[0].losses,1);assert.equal(f.canvas.dataset.disposed,'true');assert.equal(f.frames.size,0);assert.equal(f.window.listenerCount()+f.document.listenerCount()+f.canvas.listenerCount(),0);assert.deepEqual(f.counts,{geometry:1,material:1,texture:1});
});
test('actual viewer restores saved pose before ready frame and reports invalid pose fallback',async t=>{
 const c=createPalaceNavigation(data()).createExplorer();walk(c,15);c.look(.31,.18);c.setInput(1,1,true);const snapshot=plain(c.snapshot()),f=viewerFixture({pose:snapshot});t.after(f.cleanup);await f.flush();
 assert.deepEqual(f.canvas.dataset.camera.split(',').map(Number),[snapshot.position.x,snapshot.position.y,snapshot.position.z]);close(Number(f.canvas.dataset.yaw),snapshot.yaw);close(Number(f.canvas.dataset.pitch),snapshot.pitch);const held=f.canvas.dataset.camera;f.step(30);assert.equal(f.canvas.dataset.camera,held);
 const bad=viewerFixture({pose:{...snapshot,groundY:9}});t.after(bad.cleanup);await bad.flush();assert.equal(bad.canvas.dataset.ready,'true');assert.ok(bad.states[8].includes('不兼容'));assert.equal(bad.canvas.dataset.zone,'entrance');
});
test('actual renderer failure exposes retry/exit state without leaked listeners or RAF',async t=>{
 const f=viewerFixture({rendererFails:true});t.after(f.cleanup);await f.flush();assert.equal(f.states[2],true);assert.equal(f.states[3],false);assert.ok(f.states[1].includes('重试'));assert.equal(f.window.listenerCount()+f.document.listenerCount(),0);assert.equal(f.frames.size,0);assert.equal(f.fetches[0].signal.aborted,true);
 f.action('back').props.onClick();assert.equal(f.backCalls,1);
});
test('unmount cancels JSON load and never constructs a renderer; late parse releases model exactly once',async()=>{
 const early=viewerFixture({jsonDeferred:true});await early.flush();early.cleanup();assert.equal(early.fetches[0].signal.aborted,true);early.resolveJSON();await early.flush();assert.equal(early.renderers.length,0);
 const late=viewerFixture({parseDeferred:true});await late.flush();assert.equal(late.canvas.dataset.ready,'false');late.cleanup();late.resolveParse();await late.flush();late.cleanup();assert.deepEqual(late.counts,{geometry:1,material:1,texture:1});assert.equal(late.renderers[0].disposes,1);assert.equal(late.frames.size,0);assert.equal(late.window.listenerCount()+late.document.listenerCount()+late.canvas.listenerCount(),0);
});
test('30-second timeout covers a stuck parser, offers retry and disposes a later parser result',async()=>{
 const f=viewerFixture({parseDeferred:true});await f.flush();f.fireTimeout();assert.equal(f.states[2],true);assert.equal(f.states[3],false);assert.ok(f.states[1].includes('超时'));assert.equal(f.canvas.dataset.disposed,'true');assert.equal(f.fetches.at(-1).signal.aborted,true);
 f.resolveParse();await f.flush();assert.deepEqual(f.counts,{geometry:1,material:1,texture:1});assert.equal(f.states[3],false);assert.equal(f.frames.size,0);f.cleanup();
});
