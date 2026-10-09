import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.WORLD_PALACE_TEST_PROJECT?pathToFileURL(process.env.WORLD_PALACE_TEST_PROJECT+'/'):new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const source=buildSync({stdin:{contents:`export {repairShangqingEntryStructure} from './scene/shangqingStructure';export {subtractBox} from './scene/worldPalaceGeometry';export * from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';`,loader:'ts',resolveDir:fileURLToPath(new URL('src/',root))},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'}).outputFiles[0].text;
const T=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const asset=new URL('public/assets/models/shangqing-study.glb',root),original=readFileSync(asset),hash=b=>createHash('sha256').update(b).digest('hex');
function model(){
 let json,bin;for(let p=12;p<original.length;){const length=original.readUInt32LE(p),kind=original.readUInt32LE(p+4),chunk=original.subarray(p+8,p+8+length);if(kind===0x4e4f534a)json=JSON.parse(chunk.toString());if(kind===0x004e4942)bin=chunk;p+=8+length;}
 function attribute(i){const a=json.accessors[i],v=json.bufferViews[a.bufferView],size={5121:1,5123:2,5125:4,5126:4}[a.componentType],read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],values=[];for(let j=0;j<a.count;j++)for(let k=0;k<width;k++)values.push(bin[read]((v.byteOffset??0)+(a.byteOffset??0)+j*(v.byteStride??size*width)+k*size));return {values,width};}
 const materials=json.materials.map(m=>new T.MeshStandardMaterial({name:m.name,side:m.doubleSided?T.DoubleSide:T.FrontSide}));
 const nodes=json.nodes.map(n=>{const o=new T.Group();o.name=n.name??'';if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const g=new T.BufferGeometry();for(const [key,name]of Object.entries({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}))if(p.attributes[key]!==undefined){const a=attribute(p.attributes[key]);g.setAttribute(name,new T.Float32BufferAttribute(a.values,a.width));}if(p.indices!==undefined)g.setIndex(attribute(p.indices).values);const m=new T.Mesh(g,materials[p.material]);m.name=n.name;o.add(m);}if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});json.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>nodes[i].add(nodes[j])));const r=new T.Group();json.scenes[json.scene??0].nodes.forEach(i=>r.add(nodes[i]));return r;
}
const namedMeshes=r=>{const a=[];r.traverse(o=>{if(o.isMesh)a.push(o);});return a;};
const geometryHash=g=>hash(Buffer.concat([Buffer.from(g.attributes.position.array.buffer),g.index?Buffer.from(g.index.array.buffer):Buffer.alloc(0)]));
const roof=m=>m.name.replaceAll('_',' ').startsWith('south entry gallery roof');
function beforeRepair(transformed=false){const r=model();if(transformed){r.position.set(413.2815959162625,7.406349754333496,285.24866334287384);r.rotation.y=-.8624165904978749;r.scale.setScalar(.10107690446935078);}r.updateWorldMatrix(true,true);const ref=r.matrixWorld.clone();T.subtractBox(r,ref,[-13.02,-30,45.98],[13.02,40,79.02]);T.subtractBox(r,ref,[-1.9,-30,79],[1.9,-2.045,105.5]);return {r,ref};}
function roofHit(r,ref,x,z){r.updateWorldMatrix(true,true);const a=new T.Vector3(x,20,z).applyMatrix4(ref),b=new T.Vector3(x,19,z).applyMatrix4(ref);return new T.Raycaster(a,b.sub(a).normalize()).intersectObjects(namedMeshes(r).filter(roof),false).length>0;}

test('production source demonstrates the partial roof remnant, and complete bay trim removes it at multiple samples',()=>{
 const {r,ref}=beforeRepair();for(const x of [-12,-6,0,6,12])for(const z of [40,42,45])assert.equal(roofHit(r,ref,x,z),true,`baseline remnant ${x},${z}`);
 const result=T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);assert.deepEqual(result.changedMeshes.sort(),['south entry gallery end','south entry gallery roof','south entry gallery roof eave','south entry gallery roof ridge'].sort());
 for(const x of [-12,-6,0,6,12])for(const z of [39.5,40,42,45,48,50.5])assert.equal(roofHit(r,ref,x,z),false,`roof remains in replacement bay ${x},${z}`);
 for(const x of [-25,-15,15,25])for(const z of [40,42,45,48,50.5])assert.equal(roofHit(r,ref,x,z),true,`retained wing missing ${x},${z}`);
 assert.equal(hash(readFileSync(asset)),hash(original),'reference GLB was modified');
});

test('only the original south gallery roof and matching rear screens change; main hall, towers, floor, other galleries remain exact',()=>{
 const {r,ref}=beforeRepair(),before=new Map(namedMeshes(r).map(m=>[m.name,geometryHash(m.geometry)]));T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);let preserved=0;
 for(const m of namedMeshes(r)){if(!before.has(m.name)||roof(m)||m.name==='south entry gallery end')continue;assert.equal(geometryHash(m.geometry),before.get(m.name),m.name);preserved++;}assert.equal(preserved,101);
});

test('four new column feet meet retained paving; frames and roofs stay outside the new walkable bay',()=>{
 const {r,ref}=beforeRepair();const result=T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);assert.equal(result.frameMembers,48);r.updateWorldMatrix(true,true);
 const columns=namedMeshes(r).filter(m=>m.name.endsWith('seam column'));assert.equal(columns.length,4);
 const floors=namedMeshes(r).filter(m=>m.name==='south entry gallery floor');for(const c of columns){const b=new T.Box3().setFromObject(c);assert.ok(Math.abs(b.min.y-.5)<1e-6);assert.ok(b.min.x>=13.02-1e-6||b.max.x<=-13.02+1e-6);const ray=new T.Raycaster(new T.Vector3(c.position.x,1,c.position.z),new T.Vector3(0,-1,0));const hits=ray.intersectObjects(floors,false);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-b.min.y)<1e-6);}
 assert.equal(T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]),null,'repeat must not duplicate frames');
});

test('repair shares the live riverside transform and rejects unrelated buildings',()=>{
 const {r,ref}=beforeRepair(true);const result=T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);assert.ok(result);for(const x of [-12,0,12])for(const z of [40,45,50])assert.equal(roofHit(r,ref,x,z),false);for(const x of [-20,20])assert.equal(roofHit(r,ref,x,45),true);
 const group=r.children.find(o=>o.name.startsWith('Shangqing south entry replacement'));assert.ok(group.userData.artistic);for(const c of group.children.filter(o=>o.name.endsWith('seam column'))){const p=c.getWorldPosition(new T.Vector3()).applyMatrix4(ref.clone().invert());assert.ok(Math.abs(Math.abs(p.x)-13.27)<1e-6);assert.ok(Math.abs(p.y-2.4)<1e-6);}
 assert.equal(T.repairShangqingEntryStructure(new T.Group(),new T.Matrix4(),[-13,46,13,79]),null);assert.equal(T.repairShangqingEntryStructure(model(),new T.Matrix4(),[-13,-40,13,-20]),null);
});

test('all 48 edge-frame members clear the current interior colliders and walking footprint',()=>{
 const {r,ref}=beforeRepair();T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);r.updateWorldMatrix(true,true);
 const doc=JSON.parse(readFileSync(new URL('public/assets/palace-explore/bz/shangqing.json',root),'utf8')),offset=[0,-2.075,64];
 const group=r.children.find(o=>o.name.startsWith('Shangqing south entry replacement'));assert.equal(group.children.length,48);
 for(const member of group.children){const b=new T.Box3().setFromObject(member);assert.ok(b.min.x>=13.15-1e-6||b.max.x<=-13.15+1e-6,member.name);for(const c of doc.colliders){const other=new T.Box3(new T.Vector3(...c.min).add(new T.Vector3(...offset)),new T.Vector3(...c.max).add(new T.Vector3(...offset)));assert.equal(b.intersectsBox(other),false,member.name+' touches '+c.id);}}
});

test('real GLTFLoader parses the original bytes, sanitizes node names and triggers the runtime bay repair',async()=>{
 // This is the production GLTFLoader pipeline. Only image pixels are substituted:
 // the CPU test has no DOM/image decoder, while nodes, names, geometry and materials
 // are built by parseAsync from the unmodified source GLB bytes.
 const loader=new T.GLTFLoader();let textureRequests=0;
 loader.register(()=>({name:'CC_CPU_TEXTURE_PIXELS',loadTexture(){textureRequests++;return Promise.resolve(new T.DataTexture(new Uint8Array([255,255,255,255]),1,1));}}));
 const parsed=await loader.parseAsync(original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength),'');
 const r=parsed.scene;assert.ok(textureRequests>0);assert.equal(namedMeshes(r).length,105);
 assert.ok(r.getObjectByName('south_entry_gallery_roof')?.isMesh);assert.equal(r.getObjectByName('south entry gallery roof'),undefined,'Fixture must exercise actual loader naming');
 r.position.set(413.2815959162625,7.406349754333496,285.24866334287384);r.rotation.y=-.8624165904978749;r.scale.setScalar(.10107690446935078);r.updateWorldMatrix(true,true);const ref=r.matrixWorld.clone();
 T.subtractBox(r,ref,[-13.02,-30,45.98],[13.02,40,79.02]);T.subtractBox(r,ref,[-1.9,-30,79],[1.9,-2.045,105.5]);T.subtractBox(r,ref,[-1.15,-2.700693179683063,81],[1.15,.3654875645641815,83]);
 const before=new Map(namedMeshes(r).map(m=>[m.name,geometryHash(m.geometry)]));
 for(const x of [-12,-6,0,6,12])for(const z of [40,42,45])assert.equal(roofHit(r,ref,x,z),true,`real-loader baseline remnant ${x},${z}`);
 const repaired=T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]);assert.ok(repaired,'The production loader names must trigger repair instead of returning null');
 assert.deepEqual(repaired.changedMeshes.sort(),['south_entry_gallery_roof','south_entry_gallery_roof_ridge','south_entry_gallery_roof_eave','south_entry_gallery_end'].sort());assert.ok(repaired.removedTriangles>0);assert.equal(repaired.frameMembers,48);
 for(const x of [-12,-6,0,6,12])for(const z of [39.5,40,42,45,48,50.5])assert.equal(roofHit(r,ref,x,z),false,`real-loader roof remains in replacement bay ${x},${z}`);
 for(const x of [-25,-15,15,25])for(const z of [40,42,45,48,50.5])assert.equal(roofHit(r,ref,x,z),true,`real-loader retained wing missing ${x},${z}`);
 let preserved=0;for(const m of namedMeshes(r)){if(!before.has(m.name)||repaired.changedMeshes.includes(m.name))continue;assert.equal(geometryHash(m.geometry),before.get(m.name),m.name);preserved++;}assert.equal(preserved,101);
 assert.equal(T.repairShangqingEntryStructure(r,ref,[-13,46,13,79]),null);assert.equal(hash(readFileSync(asset)),hash(original));
 r.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});
});

test('similarly named roofs outside the exact source whitelist are not repaired',()=>{
 for(const name of ['south_entry_gallery_roof_1','south-entry-gallery-roof','Existing_context_south_entry_gallery_roof','south_entry_gallery_roof_unrelated']){
  const r=new T.Group(),m=new T.Mesh(new T.BoxGeometry(12,1,8),new T.MeshBasicMaterial());m.name=name;m.position.set(0,5,45);r.add(m);const before=geometryHash(m.geometry);
  assert.equal(T.repairShangqingEntryStructure(r,new T.Matrix4(),[-13,46,13,79]),null,name);assert.equal(geometryHash(m.geometry),before);assert.equal(r.children.length,1);m.geometry.dispose();m.material.dispose();
 }
});
