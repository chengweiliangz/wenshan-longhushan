import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const projectURL=process.env.RAFT_TEST_PROJECT?pathToFileURL(process.env.RAFT_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',projectURL)),{buildSync}=require('esbuild');
const sourceURL=new URL('src/scene/raftRide.ts',projectURL);
const source=buildSync({stdin:{contents:readFileSync(sourceURL,'utf8'),loader:'ts',resolveDir:fileURLToPath(new URL('.',sourceURL)),sourcefile:fileURLToPath(sourceURL)},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const {createRaftRideController,createRaftRideRoute,RAFT_JOURNEY}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const straight=(length=200)=>createRaftRideRoute([{x:0,y:5,z:0},{x:0,y:5,z:length/10}],[0,length],0,length);
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function finish(c,limit=12000){for(let i=0;i<limit&&!c.snapshot().arrived;i++)c.advance(.016,true);assert.equal(c.snapshot().arrived,true);}

test('short targeted journeys accelerate continuously, respect physical speed, arrive and hold',()=>{
 for(const length of [1,5,15,25]){const c=createRaftRideController(straight());c.requestTravel(length);let max=0,previousVelocity=0,previousAcceleration=0;
  for(let i=0;i<1600&&!c.snapshot().arrived;i++){c.advance(.01,true);const s=c.snapshot();assert.ok(s.travelMeters>=0&&s.travelMeters<=length+1e-8);assert.ok(Math.abs(s.velocityMetersPerSecond-previousVelocity)<.041);assert.ok(Math.abs(s.accelerationMetersPerSecondSquared-previousAcceleration)<.19);assert.ok(s.accelerationMetersPerSecondSquared<=4+1e-8);max=Math.max(max,s.speedMetersPerSecond);previousVelocity=s.velocityMetersPerSecond;previousAcceleration=s.accelerationMetersPerSecondSquared;}
  assert.equal(c.snapshot().travelMeters,length);assert.equal(c.snapshot().arrived,true);assert.ok(max<=6+1e-8);const pose=c.pose(),saved=c.snapshot();for(let i=0;i<100;i++)c.advance(.1,true);assert.deepEqual(c.pose(),pose);assert.equal(c.snapshot().journeyElapsedSeconds,saved.journeyElapsedSeconds);
 }
});
test('duration is a preference and lower device cap extends a short journey',()=>{
 const c=createRaftRideController(straight());c.requestTravel(25,{durationSeconds:3.4,maxSpeedMetersPerSecond:4});assert.ok(c.snapshot().journeyDurationSeconds>3.4);
 while(!c.snapshot().arrived){c.advance(.02,true);assert.ok(c.snapshot().speedMetersPerSecond<=4+1e-8);}assert.equal(c.snapshot().travelMeters,25);
});
test('long target uses a bounded cruise and never compresses the whole river into seconds',()=>{
 const c=createRaftRideController(straight(1000));c.requestTravel(700);assert.ok(c.snapshot().journeyDurationSeconds>280);for(let i=0;i<1000;i++){c.advance(.05,true);assert.ok(c.snapshot().speedMetersPerSecond<=RAFT_JOURNEY.longSpeedMetersPerSecond+1e-8);}assert.ok(c.snapshot().travelMeters<120);
});
test('same target does not restart elapsed time, and latest target replaces previous target',()=>{
 const c=createRaftRideController(straight());c.requestTravel(20,{journeyId:'first'});for(let i=0;i<60;i++)c.advance(.016,true);const saved=c.snapshot();c.requestTravel(20,{journeyId:'duplicate'});assert.equal(c.snapshot().journeyId,'first');assert.equal(c.snapshot().journeyElapsedSeconds,saved.journeyElapsedSeconds);
 c.requestTravel(35,{journeyId:'latest'});assert.equal(c.snapshot().journeyId,'latest');assert.equal(c.snapshot().targetTravelMeters,35);close(c.snapshot().velocityMetersPerSecond,saved.velocityMetersPerSecond);close(c.snapshot().accelerationMetersPerSecondSquared,saved.accelerationMetersPerSecondSquared);finish(c);assert.equal(c.snapshot().travelMeters,35);
});
test('retarget forward and reverse preserves initial velocity and acceleration',()=>{
 for(const frames of [1,20,70,130,220]){const c=createRaftRideController(straight());c.reset(60);c.requestTravel(85);for(let i=0;i<frames;i++)c.advance(.016,true);const saved=c.snapshot();c.requestTravel(40);const next=c.snapshot();close(next.journeyMotion.startVelocityMetersPerSecond,saved.velocityMetersPerSecond);close(next.journeyMotion.startAccelerationMetersPerSecondSquared,saved.accelerationMetersPerSecondSquared);assert.ok(next.journeyDurationSeconds<30,'retarget remains a finite short journey');c.advance(0,true);close(c.snapshot().velocityMetersPerSecond,saved.velocityMetersPerSecond);close(c.snapshot().accelerationMetersPerSecondSquared,saved.accelerationMetersPerSecondSquared);finish(c);assert.equal(c.snapshot().travelMeters,40);}
});
test('pause retains pending scroll target; explicit resume continues without losing manual look',()=>{
 const c=createRaftRideController(straight());c.requestTravel(20);for(let i=0;i<80;i++)c.advance(.016,true);c.look(.4,.1);c.setPaused(true);const pose=c.pose(),saved=c.snapshot();c.requestTravel(30);for(let i=0;i<200;i++)c.advance(.1,true);assert.deepEqual(c.pose(),pose);assert.equal(c.snapshot().travelMeters,saved.travelMeters);assert.equal(c.snapshot().journeyElapsedSeconds,0);assert.equal(c.snapshot().userPaused,true);
 c.requestTravel(30,{resume:true});assert.equal(c.snapshot().userPaused,false);finish(c);assert.equal(c.snapshot().travelMeters,30);assert.equal(c.snapshot().yaw,saved.yaw);assert.equal(c.snapshot().pitch,saved.pitch);assert.equal(c.snapshot().manualLook,true);
});
test('interior/home suspension freezes curve, sway and pose even if motion preference changes',()=>{
 const c=createRaftRideController(straight());c.requestTravel(20);for(let i=0;i<100;i++)c.advance(.016,true);const pose=c.pose();c.setSuspended(true);const saved=c.snapshot();c.setReducedMotion(true);for(let i=0;i<100;i++)c.advance(.1,false);assert.deepEqual(c.pose(),pose);assert.equal(c.snapshot().journeyElapsedSeconds,saved.journeyElapsedSeconds);assert.equal(c.snapshot().swayTime,saved.swayTime);c.setReducedMotion(false);c.setSuspended(false);assert.deepEqual(c.pose(),pose);c.advance(.016,true);assert.ok(c.snapshot().travelMeters>saved.travelMeters);
});
test('snapshot restore reproduces exact pose and every subsequent in-flight frame',()=>{
 const route=straight(),a=createRaftRideController(route);a.reset(30);a.requestTravel(65);for(let i=0;i<112;i++)a.advance(.016,true);a.look(.4,.06);const saved=JSON.parse(JSON.stringify(a.snapshot())),b=createRaftRideController(route);assert.deepEqual(b.restore(saved),a.pose());assert.deepEqual(b.snapshot(),a.snapshot());
 for(let i=0;i<500;i++){assert.deepEqual(b.advance(.016,true),a.advance(.016,true));assert.deepEqual(b.snapshot(),a.snapshot());}
});
test('snapshot restore retains manual pause and pending latest goal',()=>{
 const route=straight(),a=createRaftRideController(route);a.requestTravel(20);for(let i=0;i<100;i++)a.advance(.016,true);a.setPaused(true);a.requestTravel(30);const b=createRaftRideController(route);b.restore(a.snapshot());for(let i=0;i<10;i++)assert.deepEqual(b.advance(.1,true),a.advance(.1,true));assert.equal(b.snapshot().userPaused,true);b.requestTravel(30,{resume:true});finish(b);assert.equal(b.snapshot().travelMeters,30);
});
test('in-flight reversal snapshot retains its acceleration bridge and full future curve',()=>{
 const route=straight(),a=createRaftRideController(route);a.reset(50);a.requestTravel(75);for(let i=0;i<80;i++)a.advance(.016,true);a.requestTravel(30);a.advance(.016,true);const saved=JSON.parse(JSON.stringify(a.snapshot())),b=createRaftRideController(route);assert.ok(saved.journeyMotion.leadSeconds>0);b.restore(saved);assert.deepEqual(a.pose(),b.pose());for(let i=0;i<900;i++){assert.deepEqual(a.advance(.016,true),b.advance(.016,true));assert.deepEqual(a.snapshot(),b.snapshot());}assert.equal(b.snapshot().travelMeters,30);
});
test('rapid chapter requests keep only the final goal and do not create a travel queue',()=>{
 const c=createRaftRideController(straight());for(const target of [25,50,5,40,0,30]){c.requestTravel(target);for(let i=0;i<12;i++)c.advance(.016,true);}assert.equal(c.snapshot().targetTravelMeters,30);assert.ok(c.snapshot().journeyDurationSeconds<20);finish(c);assert.equal(c.snapshot().travelMeters,30);
});
test('reverse revisit leaves terminal safe boundary and is bounded on the original polyline',()=>{
 const c=createRaftRideController(straight(25));c.requestTravel(25);finish(c);assert.equal(c.snapshot().atEnd,true);c.requestTravel(5);assert.equal(c.snapshot().paused,false);let backwards=false;for(let i=0;i<1000&&!c.snapshot().arrived;i++){c.advance(.016,true);assert.ok(c.snapshot().travelMeters>=5-1e-8&&c.snapshot().travelMeters<=25);backwards||=c.snapshot().velocityMetersPerSecond<0;}assert.equal(backwards,true);assert.equal(c.snapshot().travelMeters,5);
});
test('target turn limit anticipates the sourced bend before increasing speed',()=>{
 const route=createRaftRideRoute([{x:0,y:5,z:0},{x:0,y:5,z:10},{x:10,y:5,z:10}],[0,100,200],0,200),c=createRaftRideController(route);c.reset(85);c.requestTravel(115);assert.ok(c.snapshot().journeyMotion.maxSpeedMetersPerSecond<=6*.52+1e-8);while(!c.snapshot().arrived){c.advance(.016,true);assert.ok(c.snapshot().speedMetersPerSecond<=6*route.bendSpeedFactorAt(c.snapshot().chainageMeters)+1e-8);}
});
test('reset clamps a selected station and restore rejects incompatible route/invalid snapshots',()=>{
 const c=createRaftRideController(straight());c.look(.3);c.setPaused(true);c.reset(250,{keepUserPaused:true});assert.equal(c.snapshot().travelMeters,200);assert.equal(c.snapshot().userPaused,true);assert.equal(c.snapshot().manualLook,false);assert.equal(c.snapshot().arrived,true);c.reset();assert.equal(c.snapshot().travelMeters,0);assert.equal(c.snapshot().userPaused,false);assert.throws(()=>c.requestTravel(NaN));assert.throws(()=>c.reset(Infinity));assert.throws(()=>createRaftRideController(straight(100)).restore(c.snapshot()));assert.throws(()=>c.restore({...c.snapshot(),swayTime:NaN}));
 const other=createRaftRideRoute([{x:5,y:5,z:0},{x:5,y:5,z:20}],[0,200],0,200);assert.throws(()=>createRaftRideController(other).restore(c.snapshot()));
});
