import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=process.env.EXPLORER_TEST_PROJECT?pathToFileURL(process.env.EXPLORER_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const entry="export {LandscapeScene} from './LandscapeScene'; export {Director} from '../experience/director'; export * as session from '../experience/tourSessionState'; export {createRaftTour} from './raftTour'; export {createRaftRideRoute,createRaftRideController} from './raftRide'; export * as THREE from 'three';";
const code=buildSync({stdin:{contents:entry,loader:'ts',resolveDir:fileURLToPath(new URL('src/scene/',root)),sourcefile:'actual-scene-transition-fixture.ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;
function events(){const listeners=new Map();return{addEventListener:(n,f)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener:(n,f)=>listeners.get(n)?.delete(f)};}
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 let now=0,serial=0;const callbacks=new Map(),window={...events(),innerWidth:1440,innerHeight:844,scrollY:0,scrollTo({top}){window.scrollY=top;}};
 const element=(id,top,height=1100)=>({id,dataset:{},offsetTop:top,offsetHeight:height,getBoundingClientRect:()=>({top:top-window.scrollY,bottom:top+height-window.scrollY,height})});
 const elements=new Map([['top',element('top',0,1000)],['journey',element('journey',1200,6000)],...['river','zhengyi','tianshi','shangqing'].map((id,i)=>['tour-'+id,element('tour-'+id,1200+i*1200)])]);
 const document={...events(),hidden:false,documentElement:{scrollHeight:8400,dataset:{},style:{setProperty(){},removeProperty(){}},toggleAttribute(){},removeAttribute(){}},body:{},activeElement:null,getElementById:id=>elements.get(id)??null};
 const exports={},module={exports},context=vm.createContext({window,document,module,exports,performance:{now:()=>now},requestAnimationFrame:f=>{callbacks.set(++serial,f);return serial;},cancelAnimationFrame:id=>callbacks.delete(id),ResizeObserver:class{observe(){}disconnect(){}},console,AbortController,AbortSignal});
 new vm.Script(code,{filename:'actual-scene-transition-fixture.cjs'}).runInContext(context);
 const {LandscapeScene,Director,session,THREE,createRaftTour,createRaftRideRoute,createRaftRideController}=module.exports;
 const routes=Object.fromEntries(['river','zhengyi','tianshi','shangqing'].map((id,i)=>[id,createRaftRideRoute([{x:i*100,y:5,z:0},{x:i*100,y:5,z:3}],[0,30],0,30)]));
 const tour=createRaftTour(routes,createRaftRideController(routes.river));tour.select({serial:1,id:'zhengyi',source:'click',resume:true});for(let i=0;i<1000&&tour.phase!=='arrived';i++)tour.advance(.02,true);assert.equal(tour.phase,'arrived');tour.controller.look(.35,.12);
 // The real Scene prototype is used without constructing a WebGLRenderer.
 const scene=Object.create(LandscapeScene.prototype),camera=new THREE.PerspectiveCamera(48,1,.015,3500),raft=new THREE.Group();
 const layout={id:'zhengyi',model:{position:[100,5,0],rotationY:0,scale:1},walkable:[{kind:'polygon',id:'test-ground',polygonXZ:[[50,-50],[150,-50],[150,50],[50,50]]}],colliders:[],landing:{walkPath:[[100,5,-50],[100,5,50]],widthScene:100},arrivalLookAt:[100,6,10],mapBoundsXZ:[50,-50,150,50],support:{polygonXZ:[[50,-50],[150,-50],[150,50],[50,50]]},entrance:[100,5,10]};
 Object.assign(scene,{camera,raft,raftRide:tour.controller,raftTour:tour,displayLayouts:{zhengyi:layout},worldPalaces:{},siteModels:new Map([['zhengyi',{}]]),explorer:null,exploring:false,exploreSuspended:false,explorerSite:'',returning:null,savedBoatView:null,pendingTourRequest:null,arrivalReady:true,arrivalAimKey:'',lastFrame:0});
 // GPU/environment/DOM telemetry are outside this CPU transition test; camera/state methods remain real.
 scene.writeRaftTelemetry=()=>{};scene.resize=()=>{};scene.projectAnchors=()=>{};
 scene.update=state=>{tour.advance(state.deltaSeconds,state.motion);scene.raftRide=tour.controller;scene.steerArrival(state.deltaSeconds);scene.applyRaftPose(state.deltaSeconds);};
 scene.applyRaftPose(0);
 session.selectTourStation('zhengyi','click');session.setTourReady(true);session.publishTourScene({phase:'arrived',status:'test arrived',transition:0});
 const d=new Director({getSections:()=>[0,1200,2400,3600,4800,6000,7200].map(top=>element('section-'+top,top)),onChapter(){},reducedMotion:false});
 d.start({clientWidth:1440,clientHeight:844,querySelector(){return{style:{opacity:'0'}};}});d.attachScene(scene);
 const step=()=>{now+=16;const next=callbacks.entries().next().value;callbacks.delete(next[0]);next[1](now);};
 step();d.setExploreActive(true);step();assert.equal(scene.exploring,true);assert.equal(session.getTourSession().exploring,true);
 d.setExploreInput(1,1,true);for(let i=0;i<30;i++)step();d.lookExplore(.22,.09);step();
 const calls=[],realSelect=tour.select;tour.select=request=>{calls.push({...request});realSelect(request);};
 const cameraPose=()=>({position:Array.from(camera.position.toArray()),quaternion:Array.from(camera.quaternion.toArray())});
 return{d,scene,tour,session,step,cameraPose,window,calls,close:()=>d.dispose()};
}

test('actual Director/Scene freezes free pose through home/continue and clears held movement',()=>{
 const f=fixture(),saved=f.cameraPose(),explorer=plain(f.scene.explorer.snapshot()),boat=plain(f.tour.controller.snapshot()),request=f.session.getTourSession().request.serial;
 f.session.returnTourHome();for(let i=0;i<80;i++)f.step();assert.deepEqual(f.cameraPose(),saved);assert.equal(f.scene.explorer.snapshot().suspended,true);assert.deepEqual(plain(f.scene.explorer.snapshot().input),{forward:0,right:0,fast:false});assert.equal(f.session.getTourSession().exploring,true);
 f.session.continueTour();assert.deepEqual(f.cameraPose(),saved);for(let i=0;i<30;i++)f.step();assert.deepEqual(f.cameraPose(),saved);assert.equal(f.scene.explorer.snapshot().suspended,false);assert.equal(f.session.getTourSession().request.serial,request);assert.equal(f.calls.length,0);
 const next=plain(f.scene.explorer.snapshot());assert.deepEqual(next.position,explorer.position);assert.equal(next.yaw,explorer.yaw);assert.equal(next.pitch,explorer.pitch);const boatNext=plain(f.tour.controller.snapshot());for(const key of ['travelMeters','yaw','pitch','swayTime','journeyElapsedSeconds','userPaused'])assert.equal(boatNext[key],boat[key]);f.close();
});
test('actual interior block/unblock restores free camera, reading position and no stale input',()=>{
 const f=fixture(),saved=f.cameraPose(),y=f.window.scrollY,boat=plain(f.tour.controller.snapshot());
 f.d.setPaused(true);f.window.scrollY=6200;f.d.setExploreInput(1,1,true);f.d.lookExplore(1,.5);for(let i=0;i<80;i++)f.step();assert.deepEqual(f.cameraPose(),saved);assert.equal(f.scene.explorer.snapshot().suspended,true);assert.deepEqual(plain(f.scene.explorer.snapshot().input),{forward:0,right:0,fast:false});
 f.d.setPaused(false);assert.equal(f.window.scrollY,y);assert.deepEqual(f.cameraPose(),saved);for(let i=0;i<30;i++)f.step();assert.deepEqual(f.cameraPose(),saved);assert.equal(f.calls.length,0);for(const key of ['travelMeters','yaw','pitch','swayTime','journeyElapsedSeconds','userPaused'])assert.equal(f.tour.controller.snapshot()[key],boat[key]);f.close();
});
test('station change while free completes the saved-raft fade and keeps only the newest destination',()=>{
 const f=fixture(),free=f.cameraPose(),boat={position:Array.from(f.scene.savedBoatView.position.toArray()),quaternion:Array.from(f.scene.savedBoatView.quaternion.toArray())};
 f.session.selectTourStation('shangqing','click');f.step();assert.equal(f.scene.exploring,false);assert.ok(f.scene.returning);assert.deepEqual(f.cameraPose(),free);assert.equal(f.calls.length,0);
 const elapsed=f.scene.returning.elapsed;f.session.selectTourStation('tianshi','click');f.step();assert.ok(f.scene.returning.elapsed>elapsed);assert.equal(f.calls.length,0);assert.deepEqual(f.cameraPose(),free);
 for(let i=0;i<22;i++)f.step();assert.ok(f.scene.returning.elapsed<.4);assert.deepEqual(f.cameraPose(),free);assert.equal(f.calls.length,0);
 f.step();assert.ok(f.scene.returning.elapsed>=.4);assert.deepEqual(f.cameraPose(),boat);assert.ok(f.scene.getTourPresentation().transition>.99);assert.equal(f.calls.length,0);
 while(f.scene.returning)f.step();assert.deepEqual(f.cameraPose(),boat);assert.deepEqual(f.calls.map(r=>r.id),['tianshi']);assert.equal(f.tour.target,'tianshi');assert.equal(f.tour.phase,'departing');f.step();assert.equal(f.tour.current,'zhengyi');f.close();
});
test('home freezes queued return fade; later manual pause survives pending click delivery',()=>{
 const f=fixture();f.session.selectTourStation('shangqing','click');f.step();f.d.toggleRaftPaused();assert.equal(f.tour.controller.snapshot().userPaused,true);
 const elapsed=f.scene.returning.elapsed,held=f.cameraPose();f.session.returnTourHome();for(let i=0;i<80;i++)f.step();assert.equal(f.scene.returning.elapsed,elapsed);assert.deepEqual(f.cameraPose(),held);assert.equal(f.calls.length,0);
 f.session.continueTour();const yaw=f.tour.controller.snapshot().yaw;f.d.lookRaft(.7,.2);f.d.recenterRaft();assert.equal(f.tour.controller.snapshot().yaw,yaw);
 while(f.scene.returning)f.step();assert.deepEqual(f.calls.map(r=>r.id),['shangqing']);assert.equal(f.tour.controller.snapshot().userPaused,true);const travel=f.tour.controller.snapshot().travelMeters;for(let i=0;i<30;i++)f.step();assert.equal(f.tour.controller.snapshot().travelMeters,travel);assert.equal(f.tour.target,'shangqing');f.close();
});

test('same-frame explore reentry cannot cancel returning or overwrite the saved raft view',()=>{
 const f=fixture(),free=f.cameraPose(),boat={position:Array.from(f.scene.savedBoatView.position.toArray()),quaternion:Array.from(f.scene.savedBoatView.quaternion.toArray())};
 f.d.setExploreActive(false);const returning=f.scene.returning,savedBoatView=f.scene.savedBoatView;
 assert.equal(f.session.getTourSession().exploring,false);assert.equal(f.session.getTourSession().phase,'returning');assert.ok(returning);assert.equal(returning.elapsed,0);
 // Both the public Director request and defensive Scene entry run before the next RAF.
 f.d.setExploreActive(true);f.scene.setExploreActive(true);
 assert.equal(f.session.getTourSession().exploring,false);assert.equal(f.scene.exploring,false);assert.equal(f.scene.returning,returning);assert.equal(f.scene.savedBoatView,savedBoatView);assert.deepEqual(f.cameraPose(),free);
 assert.deepEqual(plain(f.scene.explorer.snapshot().input),{forward:0,right:0,fast:false});
 f.step();assert.equal(f.scene.returning,returning);assert.deepEqual(f.cameraPose(),free);assert.equal(f.calls.length,0);
 while(f.scene.returning)f.step();assert.deepEqual(f.cameraPose(),boat);assert.equal(f.session.getTourSession().phase,'arrived');assert.equal(f.calls.length,0);
 f.d.setExploreActive(true);assert.equal(f.session.getTourSession().exploring,true);assert.equal(f.scene.exploring,true);assert.deepEqual({position:Array.from(f.scene.savedBoatView.position.toArray()),quaternion:Array.from(f.scene.savedBoatView.quaternion.toArray())},boat);
 f.close();
});
