import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=process.env.EXPLORER_TEST_PROJECT?pathToFileURL(process.env.EXPLORER_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
async function source(relative){const url=new URL(relative,root);const text=buildSync({stdin:{contents:readFileSync(url,'utf8'),loader:'ts',resolveDir:fileURLToPath(new URL('.',url)),sourcefile:fileURLToPath(url)},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;return import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));}
const {createFreeExplorer,FREE_EXPLORER}=await source('src/scene/freeExplorer.ts');
const {attachExplorationInput,isExplorationTextInput}=await source('src/experience/explorationInput.ts');
const close=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,a+' != '+b);
const make=(extra={})=>createFreeExplorer({initialPosition:{x:0,y:.16,z:0},initialDirection:{x:0,y:0,z:1},sampleGround:()=>0,...extra});
function frames(c,n,dt=.1){for(let i=0;i<n;i++)c.advance(dt);}
function surfacePose(c){const {position,direction}=c.pose();return{position,direction};}

test('scene-space walking advances at 2.4m/s and eye stays 1.6m above level ground',()=>{
 const c=make();c.setInput(1,0);frames(c,60,1/60);close(c.pose().position.z,.24);close(c.pose().position.y,.16);close(FREE_EXPLORER.radius*10,.35);close(FREE_EXPLORER.eyeHeight*10,1.6);
 c.clearInput();const held=surfacePose(c);frames(c,20);assert.deepEqual(surfacePose(c),held);c.advance(Infinity);c.advance(-1);assert.deepEqual(surfacePose(c),held);
});
test('movement follows horizontal view; strafe is camera-right and diagonal speed is normalized',()=>{
 const c=make({initialDirection:{x:0,y:0,z:-1}});c.setInput(0,1);c.advance(.1);close(c.pose().position.x,.024);close(c.pose().position.z,0);c.look(-Math.PI/2);c.setInput(1,0);c.advance(.1);close(c.pose().position.x,.048);close(c.pose().position.z,0);
 const d=make();d.setInput(1,1);d.advance(.1);close(Math.hypot(d.pose().position.x,d.pose().position.z),.024);assert.ok(d.pose().position.x<0&&d.pose().position.z>0);
});
test('view turns 360 degrees, pitch is bounded, looking up never flies',()=>{
 const c=make();c.look(Math.PI*9,100);close(c.pose().pitch,Math.PI*75/180);close(Math.hypot(c.pose().direction.x,c.pose().direction.y,c.pose().direction.z),1);c.setInput(1,0);frames(c,20);close(c.pose().position.y,.16);close(Math.hypot(c.pose().position.x,c.pose().position.z),.48);c.look(0,-200);close(c.pose().pitch,-Math.PI*75/180);
});
test('body radius blocks walls and diagonal walking slides tangentially instead of penetrating',()=>{
 const c=make({colliders:[{min:{x:-2,y:-1,z:.2},max:{x:2,y:1,z:.21}}]});c.setInput(1,0,true);frames(c,30);assert.ok(c.pose().position.z<=.2-.035+1e-10);assert.ok(c.pose().position.z>.14);
 c.setInput(1,1,true);const x=c.pose().position.x;frames(c,10);assert.ok(c.pose().position.x<x-.2);assert.ok(c.pose().position.z<=.165+1e-10);
});
test('fast walking and large frame deltas cannot tunnel through a thin rotated display collider',()=>{
 const c=make({colliders:[{kind:'box',center:[0,.5,.3],halfSize:[1,1,.0005],rotationY:Math.PI/4}]});c.setInput(1,0,true);for(let i=0;i<20;i++)c.advance(4);assert.ok(c.pose().position.z<.3);assert.ok(c.pose().position.z>.2);
 const p=c.pose().position,localZ=Math.sin(Math.PI/4)*p.x+Math.cos(Math.PI/4)*(p.z-.3);assert.ok(Math.abs(localZ)>=.035+.0005-1e-10);
});
test('custom collision receives the same radius and rejects intermediate movement',()=>{
 let calls=0;const c=make({isBlocked:(x,z,r)=>{close(r,.035);calls++;return z+r>.18;}});c.setInput(1,0,true);frames(c,20);assert.ok(c.pose().position.z<=.145+1e-10);assert.ok(calls>20);
});
test('natural boundary checks the whole footprint and stops before unsupported ground',()=>{
 const c=make({sampleGround:(x,z)=>Math.abs(x)<=.25&&Math.abs(z)<=.25?0:null});c.setInput(1,0,true);frames(c,20);assert.ok(c.pose().position.z<=.215+1e-10);assert.ok(c.pose().position.z>.19);
 assert.throws(()=>make({initialPosition:{x:0,y:.16,z:.24},sampleGround:(x,z)=>Math.abs(z)<=.25?0:null}),/outside walkable/);
});
test('ground follows a mild slope smoothly, while a steep slope or large height drop is refused',()=>{
 const c=make({sampleGround:(x,z)=>5+z*.4,initialPosition:{x:0,y:999,z:0}});close(c.pose().position.y,5.16);c.setInput(1,0);frames(c,10);close(c.pose().groundY,5+.24*.4);assert.ok(c.pose().position.y< c.pose().groundY+.16);assert.ok(c.pose().position.y>5.2);
 const steep=make({sampleGround:(x,z)=>z<=.2?0:(z-.2)*2});steep.setInput(1,0,true);frames(steep,30);assert.ok(steep.pose().position.z<.24);assert.ok(steep.pose().groundY<.08);
 const drop=make({sampleGround:(x,z)=>z<.2?0:-.3});drop.setInput(1,0,true);frames(drop,30);assert.ok(drop.pose().position.z<.2);close(drop.pose().groundY,0);
});
test('suspend freezes exact pose, clears held input, and resuming does not move by itself',()=>{
 const c=make();c.setInput(1,0,true);frames(c,2);c.look(.4,.2);const saved=c.pose();c.setSuspended(true);c.look(2,1);c.setInput(1,1,true);frames(c,20);assert.deepEqual(c.pose(),saved);assert.deepEqual(c.snapshot().input,{forward:0,right:0,fast:false});c.setSuspended(false);frames(c,20);assert.deepEqual(c.pose(),saved);
});
test('snapshot restores exact look/ground smoothing but never resurrects stale held keys',()=>{
 const opts={sampleGround:(x,z)=>z*.3},a=make(opts);a.setInput(1,0,true);frames(a,3);a.look(.5,.1);const saved=JSON.parse(JSON.stringify(a.snapshot())),b=make(opts);assert.deepEqual(b.restore(saved),a.pose());assert.deepEqual(b.snapshot().input,{forward:0,right:0,fast:false});
 a.clearInput();for(let i=0;i<20;i++){assert.deepEqual(b.advance(.016),a.advance(.016));}assert.throws(()=>b.restore({...saved,pitch:Infinity}));assert.throws(()=>b.restore({...saved,position:{x:0,y:0,z:5},groundY:999}));
});

function eventTarget(){const listeners=new Map();return{addEventListener:(n,f)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener:(n,f)=>listeners.get(n)?.delete(f),dispatch(n,values={}){const e={target:this,prevented:false,preventDefault(){this.prevented=true;},...values};for(const f of listeners.get(n)??[])f(e);return e;},listenerCount:()=>[...listeners.values()].reduce((n,s)=>n+s.size,0)};}
function fixture(){
 let move=true,look=true,time=1000,lockRequests=0,exits=0;const window={...eventTarget(),performance:{now:()=>time}},body={tagName:'DIV',isContentEditable:false,closest:()=>null};
 const document={...eventTarget(),hidden:false,visibilityState:'visible',activeElement:body,pointerLockElement:null};
 const canvas={...eventTarget(),ownerDocument:document,requestPointerLock(){lockRequests++;document.pointerLockElement=canvas;document.dispatch('pointerlockchange');return Promise.resolve();},setPointerCapture(){},releasePointerCapture(){}};
 document.exitPointerLock=()=>{exits++;document.pointerLockElement=null;document.dispatch('pointerlockchange');};
 const c=make(),input=attachExplorationInput({canvas,controller:c,window,document,canMove:()=>move,canLook:()=>look,getSensitivity:()=>.0025});
 const key=(type,code,extra={})=>window.dispatch(type,{code,key:code==='ShiftLeft'?'Shift':code.startsWith('Key')?code.slice(3).toLowerCase():code,target:document.activeElement,ctrlKey:false,metaKey:false,altKey:false,...extra});
 return{window,document,canvas,c,input,key,body,setMove:v=>move=v,setLook:v=>look=v,get lockRequests(){return lockRequests;},get exits(){return exits;},tick:dt=>time+=dt};
}
test('real input helper merges keyboard/UI and releasing one source preserves the other',()=>{
 const f=fixture();assert.equal(f.lockRequests,0);assert.equal(f.key('keydown','KeyW').prevented,true);f.input.setUIInput(0,1);assert.deepEqual(f.c.snapshot().input,{forward:1,right:1,fast:false});f.input.clearUIInput();assert.deepEqual(f.c.snapshot().input,{forward:1,right:0,fast:false});f.key('keydown','ShiftLeft');f.c.advance(.1);close(f.c.pose().position.z,.042);f.key('keyup','KeyW');const held=f.c.pose().position;f.c.advance(.1);assert.deepEqual(f.c.pose().position,held);f.input.dispose();
});
test('typing fields/contenteditable do not eat shortcuts and focusing one clears old motion',()=>{
 for(const tagName of ['INPUT','TEXTAREA','SELECT','DIV']){
  const f=fixture(),editing={tagName,isContentEditable:tagName==='DIV',closest:()=>null};assert.equal(isExplorationTextInput(editing),true);f.key('keydown','KeyW');f.document.activeElement=editing;f.document.dispatch('focusin',{target:editing});assert.deepEqual(f.c.snapshot().input,{forward:0,right:0,fast:false});assert.equal(f.key('keydown','KeyW').prevented,false);f.c.advance(.1);close(f.c.pose().position.z,0);f.input.dispose();
 }
});
test('blur, visibility and mode changes clear all movement and release only owned pointer lock',async()=>{
 const f=fixture();f.key('keydown','KeyW');f.input.setUIInput(0,1,true);f.window.dispatch('blur');assert.deepEqual(f.c.snapshot().input,{forward:0,right:0,fast:false});assert.equal(await f.input.requestPointerLock(),true);f.key('keydown','KeyW');f.document.hidden=true;f.document.visibilityState='hidden';f.document.dispatch('visibilitychange');assert.equal(f.document.pointerLockElement,null);assert.deepEqual(f.c.snapshot().input,{forward:0,right:0,fast:false});f.document.hidden=false;f.document.visibilityState='visible';f.setLook(false);f.input.refreshEnabled();assert.equal(await f.input.requestPointerLock(),false);const saved=f.c.pose();f.c.advance(.1);assert.deepEqual(f.c.pose(),saved);f.input.dispose();
});
test('pointer lock requires explicit action, tour can look while movement/wheel stays native',async()=>{
 const f=fixture();f.setMove(false);f.input.refreshEnabled();assert.equal(f.lockRequests,0);assert.equal(await f.input.requestPointerLock(),true);f.window.dispatch('pointermove',{movementX:20,movementY:-8});close(f.c.pose().yaw,-.05);close(f.c.pose().pitch,.02);assert.equal(f.key('keydown','KeyW').prevented,false);assert.equal(f.canvas.dispatch('wheel').prevented,false);f.document.exitPointerLock();f.setMove(true);assert.equal(f.canvas.dispatch('wheel').prevented,true);f.input.dispose();assert.equal(f.window.listenerCount()+f.document.listenerCount()+f.canvas.listenerCount(),0);
});
test('two-touch UI move and canvas look stay independent; cancel look does not clear UI movement',()=>{
 const f=fixture();f.input.setUIInput(1,0);f.canvas.dispatch('pointerdown',{pointerId:11,pointerType:'touch',button:0,clientX:100,clientY:100});f.window.dispatch('pointermove',{pointerId:99,pointerType:'touch',clientX:150,clientY:150});close(f.c.pose().yaw,0);
 const change=f.window.dispatch('pointermove',{pointerId:11,pointerType:'touch',clientX:120,clientY:112});assert.equal(change.prevented,true);close(f.c.pose().yaw,-.05);close(f.c.pose().pitch,-.03);assert.deepEqual(f.c.snapshot().input,{forward:1,right:0,fast:false});f.window.dispatch('pointercancel',{pointerId:11});f.window.dispatch('pointermove',{pointerId:11,clientX:180,clientY:100});close(f.c.pose().yaw,-.05);f.c.advance(.1);assert.ok(f.c.pose().position.z>0);f.input.clearUIInput();const position=f.c.pose().position;f.c.advance(.1);assert.deepEqual(f.c.pose().position,position);f.input.dispose();
});
test('touch vertical drag remains native in raft mode and fullscreen mouse drag is a fallback',()=>{
 const f=fixture();f.setMove(false);f.input.refreshEnabled();f.canvas.dispatch('pointerdown',{pointerId:1,pointerType:'touch',button:0,clientX:100,clientY:100});const vertical=f.window.dispatch('pointermove',{pointerId:1,pointerType:'touch',clientX:102,clientY:125});assert.equal(vertical.prevented,false);close(f.c.pose().yaw,0);
 f.canvas.dispatch('pointerdown',{pointerId:2,pointerType:'mouse',button:0,clientX:100,clientY:100});f.window.dispatch('pointermove',{pointerId:2,pointerType:'mouse',clientX:140,clientY:120});close(f.c.pose().yaw,-.1);close(f.c.pose().pitch,-.05);f.window.dispatch('pointerup',{pointerId:2,clientX:140,clientY:120});f.canvas.dispatch('click');assert.equal(f.lockRequests,0);f.input.dispose();
});

test('Escape releases owned pointer lock and focused editing stops locked look',async()=>{
 const f=fixture();await f.input.requestPointerLock();f.key('keydown','KeyW');f.key('keydown','Escape');assert.equal(f.document.pointerLockElement,null);assert.deepEqual(f.c.snapshot().input,{forward:0,right:0,fast:false});await f.input.requestPointerLock();const held=f.c.pose();f.document.activeElement={tagName:'INPUT',isContentEditable:false,closest:()=>null};f.window.dispatch('pointermove',{movementX:100,movementY:100});assert.deepEqual(f.c.pose(),held);f.document.dispatch('focusin',{target:f.document.activeElement});assert.equal(f.document.pointerLockElement,null);assert.equal(await f.input.requestPointerLock(),false);f.input.dispose();
});
