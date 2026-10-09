import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {buildSync} from 'esbuild';

const sourceURL = new URL('../src/experience/director.ts', import.meta.url);
const code = buildSync({stdin: {contents: readFileSync(sourceURL, 'utf8'), loader: 'ts',
  resolveDir: fileURLToPath(new URL('../src/experience/', import.meta.url)), sourcefile: 'director.ts'},
  bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent'}).outputFiles[0].text;
// Deterministic events/RAF; actual Director and its real cameraRoute import drive scene.update.
function events(){const map=new Map();return {addEventListener:(n,f)=>{if(!map.has(n))map.set(n,new Set());map.get(n).add(f);},removeEventListener:(n,f)=>map.get(n)?.delete(f),dispatch:(n,e={})=>{for(const f of map.get(n)||[])f(e);},size:()=>[...map.values()].reduce((n,s)=>n+s.size,0)};}
function simulate({pauseMs=600,attack='none',active='none'}={}){
 let now=0,serial=0;const callbacks=new Map(),trace=[],winEvents=events(),docEvents=events(),props=new Map(),attributes=new Set();
 const root={scrollHeight:8400,dataset:{},style:{setProperty:(n,v)=>props.set(n,v),removeProperty:n=>props.delete(n)},toggleAttribute:(n,on)=>on?attributes.add(n):attributes.delete(n),removeAttribute:n=>attributes.delete(n)};
 const window={...winEvents,innerWidth:1440,innerHeight:844,scrollY:450,scrollTo({top}){window.scrollY=top;}};
 const element=(id,top,height=1100)=>({id,dataset:{},offsetTop:top,offsetHeight:height,getBoundingClientRect:()=>({top:top-window.scrollY,bottom:top+height-window.scrollY,height})});
 const elements=new Map([['top',element('top',0,1000)],['journey',element('journey',1200,6000)],...['river','zhengyi','tianshi','shangqing'].map((id,i)=>['tour-'+id,element('tour-'+id,1200+i*1200)])]);
 const document={...docEvents,documentElement:root,body:{},hidden:false,activeElement:null,getElementById:id=>elements.get(id)??null};
 const exports={},module={exports};const context=vm.createContext({window,document,module,exports,performance:{now:()=>now},requestAnimationFrame:f=>{callbacks.set(++serial,f);return serial;},cancelAnimationFrame:id=>callbacks.delete(id),ResizeObserver:class{observe(){}disconnect(){}}});new vm.Script(code,{filename:'actual-bundled-director.cjs'}).runInContext(context);
 const {Director}=module.exports;const sections=[0,1200,2400,3600,4800,6000,7200].map(top=>({getBoundingClientRect:()=>({top:top-window.scrollY})}));let resetCount=0;
 const scene={update:s=>trace.push({at:now,...JSON.parse(JSON.stringify(s))}),projectAnchors(){},resize(){},resetFrameClock(){resetCount++;},setRaftSuspended(){},setRaftReducedMotion(){},selectTourStation(){},getTourPresentation(){return{phase:'approaching',status:'test station',transition:0};}};
 const director=new Director({getSections:()=>sections,onChapter(){},reducedMotion:false});director.start({clientWidth:1440,clientHeight:844,querySelector(){return null;}});director.attachScene(scene);
 const step=t=>{now=t;const entry=callbacks.entries().next().value;if(!entry)throw Error('Real RAF stopped');callbacks.delete(entry[0]);entry[1](now);};
 const mouse=(x,y)=>window.dispatch('pointermove',{pointerType:'mouse',clientX:x,clientY:y});const touch=()=>window.dispatch('pointermove',{pointerType:'touch',clientX:50,clientY:800});
 step(16);now=24;mouse(1296,168.8);window.scrollY=820;for(const t of[48,64,80,96,112,128])step(t);
 const before=trace.at(-1),savedPointer=JSON.parse(JSON.stringify(director.pointer)),setupResets=resetCount;director.setPaused(true);const pauseTraceStart=trace.length,endPause=128+pauseMs;
 const injectedEvents=[];let delivered=false;for(let t=144;t<=endPause;t=Math.min(t+16,endPause)){step(t);if(!delivered&&t>=endPause-32){delivered=true;if(attack==='mousemove'||attack==='combined'){mouse(72,801.8);injectedEvents.push({at:now,event:'mousemove'});}if(attack==='pointerleave'||attack==='combined'){document.dispatch('pointerleave');injectedEvents.push({at:now,event:'pointerleave'});}if(attack==='blur'||attack==='combined'){window.dispatch('blur');injectedEvents.push({at:now,event:'blur'});}if(attack==='combined'){mouse(72,801.8);injectedEvents.push({at:now,event:'mousemove-final'});}if(attack==='touch'){touch();injectedEvents.push({at:now,event:'touch'});}}if(t===endPause)break;}
 if(attack!=='none'&&injectedEvents.length!==(attack==='combined'?4:1))throw Error('Modal attack event was not actually delivered: '+attack);
 const duringOutputs=trace.length-pauseTraceStart,pointerAtResume=JSON.parse(JSON.stringify(director.pointer));director.setPaused(false);
 if(active==='mousemove')mouse(144,759.6);if(active==='touch')touch();if(active==='pointerleave')document.dispatch('pointerleave');if(active==='blur')window.dispatch('blur');
 for(let i=1;i<=20;i++)step(endPause+i*16);const post=trace.slice(pauseTraceStart),first=post[0],natural={progressDelta:first.progress-before.progress,pointerXDelta:first.pointerX-before.pointerX,pointerYDelta:first.pointerY-before.pointerY,timeDelta:first.time-before.time,pausedWallMs:pauseMs,savedPointer,pointerAtResume};director.dispose();
 return {before,post,duringOutputs,resetCount:resetCount-setupResets,natural,injectedEvents,disposedListeners:window.size()+document.size()};
}
for (const pauseMs of [600, 4000]) {
  for (const attack of ['mousemove', 'pointerleave', 'blur', 'combined', 'touch']) {
    test('paused '+pauseMs+'ms: '+attack+' does not contaminate resumed view', () => {
      const control = simulate({pauseMs}), actual = simulate({pauseMs, attack});
      assert.deepEqual(actual.post, control.post);
      assert.deepEqual(actual.natural.pointerAtResume, control.natural.pointerAtResume);
      assert.equal(actual.duringOutputs, 0);
      assert.equal(actual.resetCount, 2);
      assert.equal(actual.disposedListeners, 0);
      // Resuming earlier easing/idle is valid; permanent absolute pose freezing is not required.
      assert.ok(control.natural.progressDelta > 0);
      assert.ok(pauseMs === 600 ? control.natural.pointerXDelta > 0 : control.natural.pointerXDelta < 0);
    });
  }
}
for (const active of ['mousemove', 'touch', 'pointerleave', 'blur']) {
  test('active '+active+' retains its input behavior', () => {
    const control = simulate(), actual = simulate({active});
    const changed = JSON.stringify(actual.post) !== JSON.stringify(control.post);
    assert.equal(changed, active !== 'touch');
  });
}
