import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import vm from 'node:vm';
const projectURL=process.env.RAFT_TEST_PROJECT?pathToFileURL(process.env.RAFT_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',projectURL));
const {buildSync}=require('esbuild');
function bundle(relative,format='esm') {const sourceURL=new URL(relative,projectURL);return buildSync({stdin:{contents:readFileSync(sourceURL,'utf8'),loader:'ts',resolveDir:fileURLToPath(new URL('.',sourceURL)),sourcefile:fileURLToPath(sourceURL)},bundle:true,platform:'node',format,write:false,logLevel:'silent'}).outputFiles[0].text;}
const ride=await import('data:text/javascript;base64,'+Buffer.from(bundle('src/scene/raftRide.ts')).toString('base64'));
const pointer=await import('data:text/javascript;base64,'+Buffer.from(bundle('src/scene/raftRidePointer.ts')).toString('base64'));
const {createRaftRideRoute,createRaftRideController,measureRaftRidePath,RAFT_RIDE}=ride;
const straight=(length=100)=>createRaftRideRoute([{x:0,y:5,z:0},{x:0,y:5,z:length/10}],[0,length],0,length);
const angle=(a,b)=>Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z));
const readJSON=relative=>JSON.parse(readFileSync(new URL(relative,projectURL),'utf8'));

test('seated physical scale keeps the eye at 1.2m, deck at 17cm and near clip at 15cm',()=>{
 const c=createRaftRideController(straight()),p=c.pose();
 assert.ok(Math.abs((p.eye.y-p.y)*10-1.2)<1e-12);assert.ok(RAFT_RIDE.eyeAboveWaterMeters>=1.1&&RAFT_RIDE.eyeAboveWaterMeters<=1.3);
 assert.equal(RAFT_RIDE.nearScene*10,.15);assert.equal(RAFT_RIDE.deckAboveWaterMeters,.17);assert.equal(RAFT_RIDE.widthMeters,2.2);assert.equal(RAFT_RIDE.lengthMeters,5.8);
 assert.ok(Math.abs(Math.hypot(p.eye.x-p.x,p.eye.z-p.z)*10-.4)<1e-12);
 for(let i=0;i<100;i++){const p=c.advance(.1,true);assert.ok(Math.abs(p.heave*10)<=.006);assert.ok(Math.abs(p.roll)<=.0015);}
});

test('cruise advances in real metres independently of unrelated water speed or page progress',()=>{
 const c=createRaftRideController(straight());for(let i=0;i<60;i++)c.advance(.1,true);
 assert.ok(Math.abs(c.snapshot().travelMeters-3.9)<1e-12);assert.ok(Math.abs(c.pose().z*10-3.9)<1e-12);
 c.advance(Infinity,true);c.advance(-4,true);assert.ok(Math.abs(c.snapshot().travelMeters-3.9)<1e-12);
});

test('user pause and interior freeze preserve travel, yaw, pitch and exact pose on return',()=>{
 const c=createRaftRideController(straight());c.look(.4,.1);for(let i=0;i<20;i++)c.advance(.1,true);c.togglePaused();
 const saved=c.snapshot(),pose=c.pose();for(let i=0;i<10;i++)c.advance(.1,true);assert.deepEqual(c.pose(),pose);
 c.setSuspended(true);c.look(-2,-.3);c.recenter();c.togglePaused();for(let i=0;i<100;i++)c.advance(.1,true);c.setSuspended(false);
 for(const key of ['travelMeters','yaw','pitch','userPaused'])assert.equal(c.snapshot()[key],saved[key]);assert.deepEqual(c.pose(),pose);
 c.togglePaused();c.advance(.1,true);assert.ok(c.snapshot().travelMeters>saved.travelMeters);assert.equal(c.snapshot().yaw,.4);
});

test('reduced motion pauses travel and sway while explicit manual observation still works',()=>{
 const c=createRaftRideController(straight());c.advance(.1,false);const s=c.snapshot();c.look(.5,.1);for(let i=0;i<100;i++)c.advance(.1,false);
 assert.equal(c.snapshot().travelMeters,s.travelMeters);assert.equal(c.pose().heave,0);assert.equal(c.pose().roll,0);assert.equal(c.snapshot().yaw,.5);assert.ok(Math.abs(c.snapshot().pitch-.075)<1e-12);
 const p=c.pose();c.setSuspended(true);c.advance(.1,false);c.setSuspended(false);assert.deepEqual(c.pose(),p);
});

test('mouse drag persists until recenter; touch vertical scroll cancels without turning',()=>{
 const c=createRaftRideController(straight()),g=pointer.createRaftLookGesture();g.begin(1,100,100,false);assert.equal(g.move(1,103,100),null);
 const delta=g.move(1,180,120);c.look(delta.yaw,delta.pitch);assert.equal(g.end(1),false);const held=c.snapshot();for(let i=0;i<500;i++)c.advance(.1,true);assert.equal(c.snapshot().yaw,held.yaw);assert.equal(c.snapshot().pitch,held.pitch);
 g.begin(2,100,100,true);assert.equal(g.move(2,103,125),null);assert.equal(g.move(2,190,130),null);assert.equal(g.end(2),false);
 g.begin(3,100,100,true);const horizontal=g.move(3,130,104);assert.equal(horizontal.pitch,0);assert.ok(horizontal.yaw<0);g.cancel();assert.equal(g.move(3,150,104),null);
 c.recenter();assert.equal(c.snapshot().yaw,0);assert.equal(c.snapshot().pitch,-.025);
});

test('safe route boundary stops once, never wraps, and clamps outside sample requests',()=>{
 const route=straight(5),c=createRaftRideController(route);for(let i=0;i<2000;i++)c.advance(.1,true);
 assert.equal(c.snapshot().travelMeters,5);assert.equal(c.snapshot().atEnd,true);assert.equal(c.snapshot().speedMetersPerSecond,0);
 const end=c.pose();for(let i=0;i<100;i++)c.advance(.1,true);assert.deepEqual(c.pose(),end);c.togglePaused();assert.equal(c.snapshot().travelMeters,5);
 assert.deepEqual(route.sample(-5),route.sample(0));assert.deepEqual(route.sample(15),route.sample(5));assert.throws(()=>createRaftRideRoute([{x:0,y:0,z:0},{x:0,y:0,z:1}],[0,10],5,20));
});

test('heading, anticipated look and bend speed stay continuous on both sides of the sourced corner',()=>{
 const route=createRaftRideRoute([{x:0,y:5,z:0},{x:0,y:5,z:10},{x:10,y:5,z:10}],[0,100,200],0,200);
 for(const s of [82,87,91,96,100,105,109,112,118]){
   const a=route.sample(s-1e-6),b=route.sample(s+1e-6);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-6);
   assert.ok(angle({x:Math.sin(a.heading),z:Math.cos(a.heading)},{x:Math.sin(b.heading),z:Math.cos(b.heading)})<1e-6);
   assert.ok(angle({x:Math.sin(a.lookHeading),z:Math.cos(a.lookHeading)},{x:Math.sin(b.lookHeading),z:Math.cos(b.lookHeading)})<1e-6);
   assert.ok(Math.abs(route.speedAt(s-1e-6)-route.speedAt(s+1e-6))<1e-6);
 }
 assert.ok(route.speedAt(92)<route.speedAt(75));assert.ok(route.sample(96).lookHeading>route.sample(96).heading);
});

test('current real OSM route keeps a 5.8 by 2.2m raft and seated camera within the validated first kilometre',async()=>{
 const {geoToWorld}=await import(new URL('shared/geography.mjs',projectURL)),{createWaterDomain}=await import(new URL('shared/water-domain.mjs',projectURL));
 const region=readJSON('public/assets/geo/region.json'),terrain=readJSON('public/assets/geo/terrain.json'),water=readJSON('public/assets/geo/water-surfaces.json'),b=terrain.bounds;
 const coords=[...region.rivers.find(r=>r.id==='72051564').coordinates,...region.rivers.find(r=>r.id==='81192445').coordinates.slice(1)].filter(c=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3]);
 const points=coords.map(c=>{const[x,z]=geoToWorld(c);return{x:x/10,y:5,z:z/10};}),domain=createWaterDomain(water.source,points.map(p=>[p.x,p.y,p.z])),hero=geoToWorld([116.9629831,28.0749637]),start=domain.flow(hero[0]/10,hero[1]/10).s;
 assert.ok(Math.abs(start-15765.722214320773)<1e-7);
 const route=createRaftRideRoute(points,domain.distances,start,start+1000);let minimum=Infinity;
 for(let offset=0;offset<=1000;offset++){
  const p=route.sample(start+offset),dx=Math.sin(p.heading),dz=Math.cos(p.heading);
  for(const fore of [-2.9,0,2.9])for(const side of [-1.1,0,1.1]){const x=p.x+(fore*dx-side*dz)/10,z=p.z+(fore*dz+side*dx)/10,n=domain.sample(x,z);assert.equal(n.inside,true,`raft footprint outside water at ${offset}m`);minimum=Math.min(minimum,n.shoreDistance*10);}
  const eye=domain.sample(p.x-dx*.14,p.z-dz*.14);assert.equal(eye.inside,true);
 }
 assert.ok(minimum>7,'first kilometre preserves real mapped shore and island clearance');
});

function events(){const map=new Map();return{addEventListener:(n,f)=>{if(!map.has(n))map.set(n,new Set());map.get(n).add(f);},removeEventListener:(n,f)=>map.get(n)?.delete(f)};}
test('actual Director selects latest scroll station, freezes home and modal, and preserves physical pause',()=>{
 let now=0,serial=0;const callbacks=new Map(),props=new Map(),trace=[],requests=[],attributes=new Set(),veil={style:{opacity:'0'}};
 const window={...events(),innerWidth:1440,innerHeight:844,scrollY:0,scrollTo({top}){window.scrollY=top;}};
 const root={scrollHeight:8400,dataset:{},style:{setProperty:(n,v)=>props.set(n,v),removeProperty:n=>props.delete(n)},toggleAttribute:(n,on)=>on?attributes.add(n):attributes.delete(n),removeAttribute:n=>attributes.delete(n)};
 const element=(id,top,height=1100)=>({id,dataset:{},offsetTop:top,offsetHeight:height,getBoundingClientRect:()=>({top:top-window.scrollY,bottom:top+height-window.scrollY,height})});
 const elements=new Map([['top',element('top',0,1000)],['journey',element('journey',1200,6000)],...['river','zhengyi','tianshi','shangqing'].map((id,i)=>['tour-'+id,element('tour-'+id,1200+i*1200)])]);
 const document={...events(),documentElement:root,body:{},hidden:false,activeElement:null,getElementById:id=>elements.get(id)??null};
 const entry="export {Director} from './director'; export {getTourSession,selectTourStation,continueTour} from './tourSessionState'; export {createRaftTour} from '../scene/raftTour'; export {createRaftRideRoute,createRaftRideController} from '../scene/raftRide';";
 const integration=buildSync({stdin:{contents:entry,loader:'ts',resolveDir:fileURLToPath(new URL('src/experience/',projectURL)),sourcefile:'director-tour-fixture.ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;
 const exports={},module={exports},context=vm.createContext({window,document,module,exports,performance:{now:()=>now},requestAnimationFrame:f=>{callbacks.set(++serial,f);return serial;},cancelAnimationFrame:id=>callbacks.delete(id),ResizeObserver:class{observe(){}disconnect(){}}});
 new vm.Script(integration,{filename:'actual-director-tour-fixture.cjs'}).runInContext(context);const api=module.exports;
 const routes=Object.fromEntries(['river','zhengyi','tianshi','shangqing'].map((id,i)=>[id,api.createRaftRideRoute([{x:i*10,y:5,z:0},{x:i*10,y:5,z:3}],[0,30],0,30)]));
 const tour=api.createRaftTour(routes,api.createRaftRideController(routes.river));
 const scene={update:s=>{tour.advance(s.deltaSeconds,s.motion);trace.push(tour.controller.pose());},projectAnchors(){},resize(){},resetFrameClock(){},
  setRaftSuspended:value=>tour.suspend(value),setRaftReducedMotion:value=>tour.controller.setReducedMotion(value),getRaftState:()=>tour.controller.snapshot(),
  selectTourStation:request=>{requests.push({...request});tour.select(request);},getTourPresentation:()=>tour.presentation(),
  lookRaft:(yaw,pitch)=>tour.controller.look(yaw,pitch),recenterRaft:()=>tour.controller.recenter(),toggleRaftPaused:()=>tour.controller.togglePaused()};
 const sections=[0,1200,2400,3600,4800,6000,7200].map(top=>element('section-'+top,top));
 const d=new api.Director({getSections:()=>sections,onChapter(){},reducedMotion:false});d.start({clientWidth:1440,clientHeight:844,querySelector:selector=>selector==='.tour-region-veil'?veil:null});d.attachScene(scene);
 const step=()=>{now+=16;const callback=callbacks.entries().next().value;callbacks.delete(callback[0]);callback[1](now);};
 const pose=()=>tour.controller.pose(),state=()=>tour.controller.snapshot();
 step();const initial=pose();for(let i=0;i<20;i++)step();assert.deepEqual(pose(),initial);assert.equal(state().suspended,true);assert.equal(api.getTourSession().mode,'home');
 // Multiple scroll positions before one actual RAF converge on only the latest chapter.
 window.scrollY=2400;window.scrollY=4800;window.scrollY=6200;for(let i=0;i<20;i++)step();
 assert.ok(Number(props.get('--chapter-fill'))>.7);assert.ok(state().travelMeters<.25);assert.equal(pose().eye.y,5.12+pose().heave);
 assert.equal(requests.length,1);assert.equal(requests[0].id,'shangqing');assert.equal(requests[0].source,'scroll');assert.equal(requests[0].resume,false);assert.equal(tour.target,'shangqing');
 const requestSerial=requests[0].serial,targetTravel=state().targetTravelMeters;
 d.lookRaft(.3,.1);const saved=pose();window.scrollY=0;for(let i=0;i<250;i++)step();
 assert.equal(api.getTourSession().mode,'home');assert.equal(state().suspended,true);assert.deepEqual(pose(),saved);assert.equal(state().targetTravelMeters,targetTravel);assert.equal(tour.target,'shangqing');assert.equal(requests.length,1);
 api.continueTour();assert.equal(state().suspended,false);assert.deepEqual(pose(),saved);step();assert.ok(state().travelMeters<.3);assert.ok(Math.abs(state().yaw-.3)<1e-12);assert.equal(requests.length,1);assert.equal(api.getTourSession().request.serial,requestSerial);
 // Manual pause retains the most recent scroll destination without moving the held boat.
 d.toggleRaftPaused();const manuallyHeld=pose(),manualTravel=state().travelMeters;
 window.scrollY=2400;for(let i=0;i<20;i++)step();
 assert.equal(state().userPaused,true);assert.deepEqual(pose(),manuallyHeld);assert.equal(state().travelMeters,manualTravel);assert.equal(tour.target,'zhengyi');
 const pausedRequestCount=requests.length;api.selectTourStation('zhengyi','click');step();assert.equal(requests.length,pausedRequestCount+1);assert.equal(requests.at(-1).resume,true);assert.equal(state().userPaused,false);
 // Modal freeze restores its prior reading anchor before accepting a later real page scroll.
 const modalScrollY=window.scrollY,modalSerial=api.getTourSession().request.serial;d.setPaused(true);const modalPose=pose(),modalState=state(),modalRequestCount=requests.length,modalTraceCount=trace.length;
 d.lookRaft(-1,-.2);d.recenterRaft();window.scrollY=6200;for(let i=0;i<250;i++)step();
 assert.deepEqual(pose(),modalPose);assert.deepEqual(state(),modalState);assert.equal(trace.length,modalTraceCount);assert.equal(requests.length,modalRequestCount);assert.equal(tour.target,'zhengyi');
 d.setPaused(false);assert.deepEqual(pose(),modalPose);assert.equal(window.scrollY,modalScrollY);assert.equal(tour.target,'zhengyi');assert.equal(state().targetTravelMeters,modalState.targetTravelMeters);assert.equal(api.getTourSession().request.serial,modalSerial);assert.equal(requests.length,modalRequestCount);assert.equal(state().suspended,false);
 // Expire the 180ms programmatic restoration guard while keeping the restored page position.
 for(let i=0;i<12;i++)step();assert.equal(window.scrollY,modalScrollY);assert.equal(tour.target,'zhengyi');assert.equal(requests.length,modalRequestCount);assert.equal(api.getTourSession().request.serial,modalSerial);
 // A new scroll after return, rather than the modal-time mutation, sends the sole latest request.
 window.scrollY=6200;step();assert.deepEqual(requests.slice(modalRequestCount).map(r=>r.id),['shangqing']);assert.equal(requests.at(-1).source,'scroll');assert.equal(tour.target,'shangqing');
 for(let i=0;i<600;i++)step();assert.equal(tour.current,'shangqing');assert.equal(tour.target,'shangqing');assert.equal(state().arrived,true);
 // Original reduced-motion/manual observation guarantees still run through actual source.
 d.recenterRaft();d.lookRaft(.3,.1);d.reducedMotion=true;step();const travel=state().travelMeters;d.lookRaft(.2);for(let i=0;i<10;i++)step();
 assert.equal(state().travelMeters,travel);assert.ok(Math.abs(state().yaw-.5)<1e-12);assert.equal(pose().heave,0);assert.equal(pose().roll,0);d.dispose();
});


test('nonuniform offset samples are reparameterized by actual metre arc length',()=>{
 const points=[{x:0,y:5,z:0},{x:0,y:5,z:.001},{x:0,y:5,z:.41},{x:0,y:5,z:2}],distances=measureRaftRidePath(points);
 assert.deepEqual(distances,[0,.01,4.1,20]);const c=createRaftRideController(createRaftRideRoute(points,distances,0,20,{headingWindowMeters:12}));
 for(let i=0;i<100;i++){const before=c.pose(),after=c.advance(.1,true);assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)*10-.065)<1e-10);}
});

test('one sourced bank observation fades by route distance and manual look takes control without a jump',()=>{
 const route=createRaftRideRoute([{x:0,y:5,z:0},{x:0,y:5,z:10}],[0,100],0,100,{observation:{startMeters:1,endMeters:12,target:{x:-2,y:5,z:6}}}),c=createRaftRideController(route);
 for(let i=0;i<100;i++)c.advance(.1,true);assert.ok(route.sample(c.snapshot().chainageMeters).observationYaw<0);
 const before=c.pose();c.look(0);assert.deepEqual(c.pose().direction,before.direction);assert.equal(c.snapshot().manualLook,true);const held=c.snapshot().yaw;
 for(let i=0;i<100;i++)c.advance(.1,true);assert.equal(c.snapshot().yaw,held);assert.equal(c.pose().cameraHeading,held);
 c.recenter();assert.equal(c.snapshot().manualLook,true);assert.equal(c.pose().cameraHeading,route.sample(c.snapshot().chainageMeters).lookHeading);for(const s of [1,12])assert.ok(Math.abs(route.sample(s-1e-6).observationYaw-route.sample(s+1e-6).observationYaw)<1e-8);
});

test('local hull pitch and minimal lift leave wave clearance without raising the seated eye',async()=>{
 const surface=(x,z)=>5+(z<0?.02249:0),route=createRaftRideRoute([{x:0,y:5,z:-1},{x:0,y:5,z:1}],[0,20],10,20,{surfaceAt:surface}),c=createRaftRideController(route),p=c.pose();
 assert.ok(Math.abs(p.boatPitch)>0);assert.ok(Math.abs((p.eye.y-surface(p.eye.x,p.eye.z))*10-1.2)<1e-12);
 const THREE=await import(new URL('node_modules/three/build/three.module.js',projectURL)),rotation=new THREE.Euler(p.boatPitch,p.heading,p.roll,'YXZ'),matrix=new THREE.Matrix4().makeRotationFromEuler(rotation);
 for(const fore of[-.29,0,.29])for(const side of[-.11,0,.11]){const q=new THREE.Vector3(side,.017,fore).applyMatrix4(matrix);q.add(new THREE.Vector3(p.x,p.hullCenterY+p.heave,p.z));assert.ok((q.y-surface(q.x,q.z))*10>.10);}
});


test('approved near-bank V3 has no positional loops, uses physical arc length and stays clear of mapped islands',async()=>{
 const {geoToWorld}=await import(new URL('shared/geography.mjs',projectURL)),{createWaterDomain}=await import(new URL('shared/water-domain.mjs',projectURL)),THREE=await import(new URL('node_modules/three/build/three.module.js',projectURL));
 const {createNearBankTourPath}=await import('data:text/javascript;base64,'+Buffer.from(bundle('src/scene/raftRideNearBank.ts')).toString('base64'));
 const region=readJSON('public/assets/geo/region.json'),terrain=readJSON('public/assets/geo/terrain.json'),water=readJSON('public/assets/geo/water-surfaces.json'),b=terrain.bounds;
 const coords=[...region.rivers.find(r=>r.id==='72051564').coordinates,...region.rivers.find(r=>r.id==='81192445').coordinates.slice(1)].filter(c=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3]);
 const points=coords.map(c=>{const[x,z]=geoToWorld(c);return new THREE.Vector3(x/10,5,z/10);}),domain=createWaterDomain(water.source,points.map(p=>p.toArray())),hero=geoToWorld([116.9629831,28.0749637]),start=domain.flow(hero[0]/10,hero[1]/10).s;
 const near=createNearBankTourPath(points,domain.distances,domain,start,start+1000),nearPoints=near.samples.map(s=>s.position),distances=measureRaftRidePath(nearPoints),length=distances.at(-1),route=createRaftRideRoute(nearPoints,distances,0,length,{headingWindowMeters:12,surfaceAt:(x,z)=>domain.flow(x,z).level});
 assert.ok(Math.abs(length-1013.380336)<.001);assert.ok(near.samples[0].offsetMeters>10);assert.equal(near.samples.at(-1).offsetMeters,0);
 const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);let intersections=0;
 for(let i=0;i<nearPoints.length-1;i++)for(let j=i+2;j<nearPoints.length-1;j++){const a=nearPoints[i],bb=nearPoints[i+1],c=nearPoints[j],d=nearPoints[j+1];if(cross(a,bb,c)*cross(a,bb,d)<-1e-12&&cross(c,d,a)*cross(c,d,bb)<-1e-12)intersections++;}assert.equal(intersections,0);
 let minimum=Infinity;for(let metres=0;metres<=length;metres+=.5){const p=route.sample(metres),dx=Math.sin(p.heading),dz=Math.cos(p.heading);for(const fore of[-2.9,0,2.9])for(const side of[-1.1,0,1.1]){const n=domain.sample(p.x+(fore*dx-side*dz)/10,p.z+(fore*dz+side*dx)/10);assert.equal(n.inside,true);minimum=Math.min(minimum,n.shoreDistance*10);}
  const ahead=route.sample(Math.min(length,metres+.02));assert.ok(angle({x:dx,z:dz},{x:Math.sin(ahead.heading),z:Math.cos(ahead.heading)})<.02);}
 assert.ok(minimum>6);const c=createRaftRideController(route),before=c.pose(),speed=route.speedAt(0),after=c.advance(.1,true);assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)*10-speed*.1)<1e-10);
});

test('actual Float32 water triangles and full footprint clipping cover ridges between nine hull probes',async()=>{
 const {createRaftWaterSurfaceSampler}=await import('data:text/javascript;base64,'+Buffer.from(bundle('src/scene/raftRideWaterSurface.ts')).toString('base64'));
 const positions=new Float32Array([-1,5,-1,1,5,-1,1,5,1,-1,5,1,.06,5.035,.13]),indices=new Uint32Array([0,1,4,1,2,4,2,3,4,3,0,4]),mesh=createRaftWaterSurfaceSampler(positions,indices,.5);
 assert.ok(Math.abs(mesh.sample(.06,.13)-positions[13])<1e-8);assert.equal(mesh.sample(2,2),null);
 const polygon=[{x:-.11,z:-.29},{x:.11,z:-.29},{x:.11,z:.29},{x:-.11,z:.29}],patch=mesh.footprint(polygon);assert.ok(patch.some(p=>Math.hypot(p.x-.06,p.z-.13)<1e-7));
 const route=createRaftRideRoute([{x:0,y:5,z:-1},{x:0,y:5,z:1}],[0,20],10,20,{surfaceAt:(x,z)=>mesh.sample(x,z)??5,surfaceFootprint:p=>mesh.footprint(p)}),c=createRaftRideController(route),p=c.pose(),THREE=await import(new URL('node_modules/three/build/three.module.js',projectURL)),rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.boatPitch,p.heading,p.roll,'YXZ'));
 let minimum=Infinity;for(let x=-.11;x<=.110001;x+=.01)for(let z=-.29;z<=.290001;z+=.01){const q=new THREE.Vector3(x,.017,z).applyMatrix4(rotation).add(new THREE.Vector3(p.x,p.hullCenterY+p.heave,p.z));minimum=Math.min(minimum,(q.y-mesh.sample(q.x,q.z))*10);}
 assert.ok(minimum>=.105-1e-10);assert.ok(p.minimumDeckClearanceMeters>=.105-1e-10);assert.ok(Math.abs((p.eye.y-mesh.sample(p.eye.x,p.eye.z))*10-1.2)<1e-10);mesh.dispose();
});
