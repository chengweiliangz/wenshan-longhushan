import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
const sourceURL = new URL('../src/scene/riverFollowDirection.ts', import.meta.url);
const code = buildSync({stdin:{contents:readFileSync(sourceURL,'utf8'),loader:'ts',resolveDir:fileURLToPath(new URL('../src/scene/',import.meta.url)),sourcefile:'riverFollowDirection.ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const {createRiverFollowDirection} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const direction=(f,s)=>f.sample(s,{x:0,z:0}),angle=(a,b)=>Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z));
// Actual current native-grid scene path around BC's84.7786029857m fold; not WGS84.
const points=[{x:-368.26119240834475,z:-60.182211029614166},{x:-369.4265380061444,z:-61.41384987574038},{x:-370.05010529405547,z:-63.16305014109306}];
const distances=[15833.545096709582,15850.500817306473,15869.071056214098],fold=distances[1],follow=createRiverFollowDirection(points,distances);
function camera(s,smooth){const i=s<=fold?0:1,a=points[i],b=points[i+1],u=(s-distances[i])/(distances[i+1]-distances[i]),dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz),d=smooth?direction(follow,s):{x:dx/n,z:dz/n};return {x:a.x+dx*u-5*d.x-1.6*d.z,z:a.z+dz*u-5*d.z+1.6*d.x,d};}
test('recorded real fold removes camera jump without moving sourced boat position',()=>{
  assert.ok(Math.abs(fold-15765.722214320773-84.77860298569976)<1e-9);
  const oldA=camera(fold-1e-6,false),oldB=camera(fold+1e-6,false),a=camera(fold-1e-6,true),b=camera(fold+1e-6,true);
  assert.ok(Math.hypot(oldA.x-oldB.x,oldA.z-oldB.z)>2);assert.ok(Math.abs(angle(oldA.d,oldB.d)-.41530605261470793)<1e-7);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-5);assert.ok(angle(a.d,b.d)<1e-6);
});
test('turn and both window endpoints are continuous with zero endpoint angular slope',()=>{
  const t=follow.turns[0];for(const s of[t.start,t.at,t.end])assert.ok(angle(direction(follow,s-1e-6),direction(follow,s+1e-6))<1e-6);
  for(const [a,b]of[[t.start,t.start+1e-4],[t.end-1e-4,t.end]])assert.ok(angle(direction(follow,a),direction(follow,b))/1e-4<1e-3);
  assert.ok(angle(direction(follow,distances[0]-1),direction(follow,t.start))<1e-12);assert.ok(angle(direction(follow,t.end),direction(follow,distances.at(-1)+1))<1e-12);
});
test('same travel is exact on pause/repeat and reverse sampling, independent of update rate',()=>{
  const s=[fold-6,fold-3,fold,fold+3,fold+6],expected=s.map(v=>direction(follow,v));for(let i=s.length-1;i>=0;i--)assert.deepEqual(direction(follow,s[i]),expected[i]);
  for(let i=0;i<50;i++)assert.deepEqual(direction(follow,fold),expected[2]);
  for(const hz of[10,30,60,144])for(let s=fold-6;s<fold+6;s+=.65/hz)assert.ok(angle(direction(follow,s),direction(follow,s+.65/hz))*hz<.04);
});
test('plusPi to minusPi follows shortest two-degree turn',()=>{
  const e=Math.PI/180,a={x:Math.sin(Math.PI-e),z:Math.cos(Math.PI-e)},b={x:a.x+Math.sin(-Math.PI+e),z:a.z+Math.cos(-Math.PI+e)},f=createRiverFollowDirection([{x:0,z:0},a,b],[0,10,20],2);
  assert.ok(Math.abs(f.turns[0].delta-2*e)<1e-12);assert.ok(direction(f,10).z<-.99999);
});
test('short adjacent segments have nonoverlapping finite transition windows',()=>{
  const f=createRiverFollowDirection([{x:0,z:0},{x:0,z:1},{x:.01,z:1},{x:.01,z:2}],[0,10,10.1,20.1]);assert.ok(f.turns[0].end<f.turns[1].start);
  for(const t of f.turns)for(const s of[t.start,t.at,t.end]){const d=direction(f,s);assert.ok(Math.abs(Math.hypot(d.x,d.z)-1)<1e-14);assert.ok(angle(direction(f,s-1e-7),direction(f,s+1e-7))<1e-5);}
});
test('rejects empty or unordered paths, nonfinite inputs and invalid windows',()=>{
  assert.throws(()=>createRiverFollowDirection([{x:0,z:0},{x:0,z:0}],[0,1]));assert.throws(()=>createRiverFollowDirection(points,[0,0,1]));assert.throws(()=>createRiverFollowDirection(points,[0,1]));
  assert.throws(()=>createRiverFollowDirection([{x:NaN,z:0},{x:1,z:0}],[0,1]));for(const w of[0,-1,NaN,Infinity])assert.throws(()=>createRiverFollowDirection(points,distances,w));assert.throws(()=>direction(follow,NaN));
});
test('rejects finite increasing chainage whose turn window collapses through rounding',()=>{
  const h=1/81920,s=1e12,d=1/8192;
  assert.throws(()=>createRiverFollowDirection([{x:0,z:0},{x:0,z:h},{x:h,z:h}],[s,s+d,s+2*d]),/Unrepresentable river follow window/);
});
