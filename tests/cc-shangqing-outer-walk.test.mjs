import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.WORLD_PALACE_TEST_PROJECT?pathToFileURL(process.env.WORLD_PALACE_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const source=buildSync({stdin:{contents:`export {createWorldPalace} from './scene/worldPalace';export {createDisplayLayouts,displayToWorld,worldToDisplayLocal} from './scene/displayLayout';export {createFreeExplorer,FREE_EXPLORER} from './scene/freeExplorer';`,loader:'ts',resolveDir:fileURLToPath(new URL('src/',root))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {createWaterDomain}=await import(new URL('shared/water-domain.mjs',root));
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const domain=createWaterDomain(read('public/assets/geo/water-surfaces.json').source,[[0,6,0],[1,6,1]]);
const layout=api.createDisplayLayouts({waterAt:()=>6,groundAt:()=>6,containsWater:(x,z)=>domain.contains(x,z)}).shangqing;
const world=api.createWorldPalace(layout,read('public/assets/palace-explore/bz/shangqing.json'));
const worldPoint=(x,z)=>api.displayToWorld(layout,[x,0,z]);
function walkTo(c,x,z){
 const target=worldPoint(x,z);let stationary=0;
 for(let frame=0;frame<8000;frame++){
  const p=c.pose(),dx=target[0]-p.position.x,dz=target[2]-p.position.z,d=Math.hypot(dx,dz);
  if(d<.003){c.clearInput();return;}
  c.look(Math.atan2(dx,dz)-p.yaw);c.setInput(Math.min(1,d/(.30/60)),0);c.advance(1/60);
  const q=c.pose();if(Math.hypot(q.position.x-p.position.x,q.position.z-p.position.z)<1e-10){if(++stationary>8)break;}else stationary=0;
 }
 const p=c.pose();assert.fail(`Blocked approaching ${x},${z}; stopped at local ${api.worldToDisplayLocal(layout,[p.position.x,p.position.y,p.position.z]).join(',')}`);
}
for(const side of [-1,1])test(`Shangqing ${side<0?'west':'east'} exterior goes from forecourt to rear and returns using the real controller`,()=>{
 const start=worldPoint(0,102),c=api.createFreeExplorer({initialPosition:{x:start[0],y:0,z:start[2]},sampleGround:world.ground,isBlocked:world.blocked,speed:.30,boost:.58});
 for(const [x,z]of [[side*46.5,102],[side*46.5,45],[side*46.5,20],[side*46.5,-35],[side*46.5,-53],[side*46.5,45],[side*46.5,102],[0,102]])walkTo(c,x,z);
 const p=c.pose();assert.ok(Math.hypot(p.position.x-start[0],p.position.z-start[2])<.003);
 let maxSlope=0;const r=api.FREE_EXPLORER.radius;
 for(let z=46;z<=49;z+=.025){const p=worldPoint(side*46.5,z),gx=(world.ground(p[0]+r,p[2])-world.ground(p[0]-r,p[2]))/(2*r),gz=(world.ground(p[0],p[2]+r)-world.ground(p[0],p[2]-r))/(2*r);maxSlope=Math.max(maxSlope,Math.hypot(gx,gz));assert.equal(world.blocked(p[0],p[2],r),false);}
 assert.ok(maxSlope<Math.tan(api.FREE_EXPLORER.maxSlopeRadians)-.05,`Exterior ground slope ${maxSlope} has no usable margin`);
 const protectedBuilding=worldPoint(0,0);assert.equal(world.blocked(protectedBuilding[0],protectedBuilding[2],r),true,'Original building collision must remain solid');
});
