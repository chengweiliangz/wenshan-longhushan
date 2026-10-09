import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
let sequence=0;
async function setup(){
 globalThis.window={scrollY:0,innerWidth:1600,innerHeight:900,scrollTo({top}){this.scrollY=top;}};
 globalThis.document={documentElement:{dataset:{}},getElementById(){return{getBoundingClientRect:()=>({top:1200-window.scrollY,height:900}),offsetHeight:900};}};
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/experience/tourSessionState.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+sequence++).toString('base64'));
}
const arrived={phase:'arrived',status:'arrived',transition:0};
test('world entry waits for scene readiness and arrival; duplicate publication preserves exploration',async()=>{
 const m=await setup();assert.equal(m.requestWorldExplore('zhengyi'),true);assert.equal(m.getTourSession().exploring,false);m.publishTourScene(arrived);assert.equal(m.getTourSession().exploring,false);m.setTourReady(true);m.publishTourScene(arrived);assert.equal(m.getTourSession().exploring,true);const serial=m.getTourSession().request.serial;m.publishTourScene(arrived);assert.equal(m.getTourSession().request.serial,serial);assert.equal(m.getTourSession().exploring,true);
});
test('same-site material entry restores world ownership without a second station journey',async()=>{
 const m=await setup();m.setTourReady(true);m.selectTourStation('tianshi');m.publishTourScene(arrived);const serial=m.getTourSession().request.serial;m.setTourBlocked(true);assert.equal(m.requestWorldExplore('tianshi'),false);m.setTourBlocked(false);assert.equal(m.requestWorldExplore('tianshi'),true);assert.equal(m.getTourSession().exploring,true);assert.equal(m.getTourSession().request.serial,serial);m.returnTourHome();assert.equal(m.getTourSession().exploring,true);m.continueTour();assert.equal(m.getTourSession().mode,'tour');assert.equal(m.getTourSession().request.serial,serial);
});
test('a newer destination or return-home cancels old auto-explore intent',async()=>{
 const m=await setup();m.setTourReady(true);m.requestWorldExplore('zhengyi');m.selectTourStation('shangqing');m.publishTourScene(arrived);assert.equal(m.getTourSession().exploring,false);assert.equal(m.getTourSession().station,'shangqing');m.requestWorldExplore('tianshi');m.returnTourHome();m.publishTourScene(arrived);m.continueTour();m.publishTourScene(arrived);assert.equal(m.getTourSession().exploring,false);
});
