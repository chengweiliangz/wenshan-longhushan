import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.WORLD_PALACE_TEST_PROJECT?pathToFileURL(process.env.WORLD_PALACE_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const source=buildSync({stdin:{contents:`export {createWorldPalace} from './scene/worldPalace';
export {createDisplayLayouts,displayToWorld,worldToDisplayLocal} from './scene/displayLayout';
export {createFreeExplorer} from './scene/freeExplorer';
export {subtractBox,connectionRamp} from './scene/worldPalaceGeometry';
export {BufferGeometry,Float32BufferAttribute,Mesh,Group,Matrix4,Vector3,MeshBasicMaterial} from 'three';`,loader:'ts',resolveDir:fileURLToPath(new URL('src/',root)),sourcefile:'world-palace-cpu-fixture.ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {createWorldPalace,createDisplayLayouts,displayToWorld,worldToDisplayLocal,createFreeExplorer,subtractBox,connectionRamp,BufferGeometry,Float32BufferAttribute,Mesh,Group,Matrix4,Vector3,MeshBasicMaterial}=api;
const {createWaterDomain}=await import(new URL('shared/water-domain.mjs',root));
const read=relative=>JSON.parse(readFileSync(new URL(relative,root),'utf8'));
// Production shore polygons/layouts/nav data; a constant water datum removes irrelevant DEM work.
const domain=createWaterDomain(read('public/assets/geo/water-surfaces.json').source,[[0,6,0],[1,6,1]]);
const layouts=createDisplayLayouts({waterAt:()=>6,groundAt:()=>6,containsWater:(x,z)=>domain.contains(x,z)});
const documents=Object.fromEntries(['zhengyi','tianshi','shangqing'].map(id=>[id,read('public/assets/palace-explore/bz/'+id+'.json')]));
const worlds=Object.fromEntries(Object.entries(layouts).map(([id,l])=>[id,createWorldPalace(l,documents[id])]));
const close=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<=epsilon,a+' != '+b);
const docPoint=(id,x,z)=>{const w=worlds[id];return displayToWorld(layouts[id],[x+w.offset[0],0,z+w.offset[2]]);};
const explorerAt=(id,point)=>createFreeExplorer({initialPosition:{x:point[0],y:0,z:point[2]},sampleGround:worlds[id].ground,isBlocked:worlds[id].blocked,speed:.30,boost:.58});
function walkTo(id,c,target){
 for(let frame=0;frame<2400;frame++){
  const p=c.pose(),dx=target[0]-p.position.x,dz=target[2]-p.position.z,distance=Math.hypot(dx,dz);
  if(distance<.003){c.clearInput();return;}
  c.look(Math.atan2(dx,dz)-p.yaw);c.setInput(Math.min(1,distance/(.30/60)),0);c.advance(1/60);
 }
 const p=c.pose();assert.fail(id+' could not reach '+worldToDisplayLocal(layouts[id],target).join(',')+'; stopped at '+worldToDisplayLocal(layouts[id],[p.position.x,p.position.y,p.position.z]).join(','));
}
for(const id of ['zhengyi','tianshi','shangqing']){
 test(id+' interior geometry and ground share the original world transform and both entry seams are continuous',()=>{
  const l=layouts[id],w=worlds[id],d=documents[id],outer=new Group(),inside=new Group();
  outer.position.fromArray(l.model.position);outer.rotation.y=l.model.rotationY;outer.scale.setScalar(l.model.scale);inside.position.fromArray(w.offset);outer.add(inside);outer.updateWorldMatrix(true,true);
  for(const point of [d.spawn.position,[2,0,5],[-2,0,3]]){
   const expected=new Vector3().fromArray(point).applyMatrix4(inside.matrixWorld),world=displayToWorld(l,point.map((v,i)=>v+w.offset[i])),local=worldToDisplayLocal(l,world);
   world.forEach((v,i)=>close(v,expected.getComponent(i)));local.forEach((v,i)=>close(v,point[i]+w.offset[i]));close(w.ground(world[0],world[2]),expected.y);
  }
  for(const z of [w.bounds[3],w.def.approachZ]){
   const a=displayToWorld(l,[w.offset[0],0,z-.00001]),b=displayToWorld(l,[w.offset[0],0,z+.00001]),ya=w.ground(a[0],a[2]),yb=w.ground(b[0],b[2]);
   assert.notEqual(ya,null);assert.notEqual(yb,null);close(ya,yb,1e-6);
  }
 });
 test(id+' uses the real walking controller from outer forecourt through the central entrance into its roofed hall',()=>{
  const w=worlds[id],start=displayToWorld(layouts[id],[w.offset[0],0,w.def.approachZ+.2]),c=explorerAt(id,start);
  const route=id==='zhengyi'?[[0,14.4],[0,8],[2.5,8],[2.5,-3.5],[0,-3.5],[0,-7],[0,-10]]
   :id==='tianshi'?[[0,13.3],[0,3],[0,-4.5],[0,-7],[0,-11]]
   :[[0,12.3],[0,5],[-6.4,5],[-6.4,-5.6],[-9.7,-5.6],[-10.4,-6]];
  for(const [x,z]of route)walkTo(id,c,docPoint(id,x,z));
  const p=c.pose();assert.equal(w.zone(p.position.x,p.position.z),documents[id].zones.find(z=>z.id==='hall').label);assert.equal(w.insideWorld(p.position.x,p.position.z),true);
  // Walls remain physical even though the original outer conservative mask is replaced here.
  const boundary=documents[id].colliders.find(c=>/site_boundary|compound_wall|site_limit/.test(c.id)&&c.min[1]<1.8&&c.max[1]>1.8);
  assert.ok(boundary);const point=docPoint(id,(boundary.min[0]+boundary.max[0])/2,(boundary.min[2]+boundary.max[2])/2);
  assert.equal(w.blocked(point[0],point[2],.035),true);assert.throws(()=>explorerAt(id,point),/outside walkable ground/);
 });
}
test('Shangqing protected remains have neither walkable floor nor an entry route; Zhengyi door jamb stays solid',()=>{
 const w=worlds.shangqing,pit=docPoint('shangqing',0,-5);assert.equal(w.ground(pit[0],pit[2]),null);assert.equal(w.blocked(pit[0],pit[2],.035),true);assert.throws(()=>explorerAt('shangqing',pit),/outside walkable ground/);
 const c=explorerAt('shangqing',docPoint('shangqing',0,5)),target=docPoint('shangqing',0,-5);c.look(Math.atan2(target[0]-c.pose().position.x,target[2]-c.pose().position.z)-c.pose().yaw);c.setInput(1,0,true);for(let i=0;i<600;i++)c.advance(1/60);
 const local=worldToDisplayLocal(layouts.shangqing,[c.pose().position.x,c.pose().position.y,c.pose().position.z]);assert.ok(local[2]-w.offset[2]>1.3);assert.ok(w.ground(c.pose().position.x,c.pose().position.z)!==null);
 const jamb=docPoint('zhengyi',2.5,-5);assert.equal(worlds.zhengyi.blocked(jamb[0],jamb[2],.035),true);
});
function triangleArea(g){const a=g.attributes.position;let area=0;for(let i=0;i<a.count;i+=3){const p=new Vector3().fromBufferAttribute(a,i),q=new Vector3().fromBufferAttribute(a,i+1),r=new Vector3().fromBufferAttribute(a,i+2);area+=q.sub(p).cross(r.sub(p)).length()/2;}return area;}
test('box subtraction opens an exact hole in the transformed source plane and preserves outside normals, UV and material groups',()=>{
 const rootObject=new Group();rootObject.position.set(4,3,-7);rootObject.rotation.y=.73;rootObject.scale.setScalar(.10107690446935078);
 const g=new BufferGeometry(),positions=[-2,0,-2,2,0,-2,-2,0,2,2,0,-2,2,0,2,-2,0,2],uv=positions.flatMap((v,i)=>i%3===0?[(v+2)/4,(positions[i+2]+2)/4]:[]);
 g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(Array.from({length:6},()=>[0,1,0]).flat(),3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.addGroup(0,3,0);g.addGroup(3,3,1);
 const materials=[new MeshBasicMaterial(),new MeshBasicMaterial()],mesh=new Mesh(g,materials);rootObject.add(mesh);rootObject.updateWorldMatrix(true,true);const reference=rootObject.matrixWorld.clone();let disposed=0;g.addEventListener('dispose',()=>disposed++);
 assert.equal(subtractBox(rootObject,reference,[-1,-.1,-1],[1,.1,1]),2);assert.equal(disposed,1);assert.equal(mesh.material,materials);close(triangleArea(mesh.geometry),12,1e-6);
 const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,t=mesh.geometry.attributes.uv;assert.equal(n.count,p.count);assert.equal(t.count,p.count);assert.deepEqual(new Set(mesh.geometry.groups.map(g=>g.materialIndex)),new Set([0,1]));assert.equal(mesh.geometry.groups.reduce((n,g)=>n+g.count,0),p.count);
 for(let i=0;i<p.count;i++){close(n.getX(i),0);close(n.getY(i),1);close(n.getZ(i),0);close(t.getX(i),(p.getX(i)+2)/4,1e-7);close(t.getY(i),(p.getZ(i)+2)/4,1e-7);assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getZ(i)));}
 for(let i=0;i<p.count;i+=3){const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;assert.ok(!(Math.abs(x)<1-1e-7&&Math.abs(z)<1-1e-7),'a retained triangle covers the replacement hole');}
 mesh.geometry.dispose();materials.forEach(m=>m.dispose());
});
test('visible connection paving matches both sampled entry heights in every palace transform',()=>{
 for(const id of ['zhengyi','tianshi','shangqing']){const l=layouts[id],w=worlds[id],ramp=connectionRamp(w.offset[0],w.bounds[3]-.02,w.def.approachZ,w.offset[1],w.outerHeight,w.def.halfWidth),p=ramp.geometry.attributes.position;
  for(const i of [0,1,2,3]){const local=[p.getX(i),p.getY(i),p.getZ(i)],world=displayToWorld(l,local);close(w.ground(world[0],world[2]),world[1],1e-6);}
  ramp.geometry.dispose();ramp.material.dispose();
 }
});