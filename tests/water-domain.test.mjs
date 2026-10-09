import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createWaterDomain} from '../shared/water-domain.mjs';import {geoToWorld} from '../shared/geography.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../public/assets/geo/'+p,import.meta.url)));
const toPoint=c=>{const [x,z]=geoToWorld(c);return[x/10,5,z/10]};
test('mapped water mesh preserves shore and both island holes without width substitution',async()=>{
 const m=await read('water-surfaces.json'),r=await read('region.json');const p=[...r.rivers.find(x=>x.id==='72051564').coordinates,...r.rivers.find(x=>x.id==='81192445').coordinates.slice(1)].map(toPoint);const domain=createWaterDomain(m.source,p);const raw=await readFile(new URL('../public'+m.mesh.src,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),m.mesh.sha256);assert.equal(raw.length,m.mesh.vertexCount*8+m.mesh.indexCount*4);
 const data=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),v=new Float32Array(data,0,m.mesh.vertexCount*2),idx=new Uint32Array(data,m.mesh.vertexCount*8,m.mesh.indexCount);let area=0;
 for(let i=0;i<idx.length;i+=3){const a=idx[i]*2,b=idx[i+1]*2,c=idx[i+2]*2;assert.ok(domain.contains((v[a]+v[b]+v[c])/30,(v[a+1]+v[b+1]+v[c+1])/30),`water triangle ${i/3} must stay inside source polygons and outside islands`);area+=Math.abs((v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]))/2;}
 assert.ok(Math.abs(area-m.mesh.areaSquareMeters)<5);assert.equal(m.source[0].holes.length,2);
 for(const c of [[116.96180,28.07690],[116.95858,28.08955]]){const[x,,z]=toPoint(c);assert.equal(domain.contains(x,z),false,'mapped island remains dry');}
 const[x,,z]=toPoint([116.9629831,28.0749637]);assert.equal(domain.contains(x,z),true,'hero raft remains within actual mapped river');assert.equal(m.mesh.gridMeters,8);
});
test('downstream flow frames turn with the sourced path and accumulate physical distance',()=>{
 const source=[{outer:[[116.99,28.06],[117.01,28.06],[117.01,28.08],[116.99,28.08],[116.99,28.06]],holes:[]}];const d=createWaterDomain(source,[[0,6,0],[0,5,-10],[-10,4,-10]]);const before=d.flow(0,-5),after=d.flow(-5,-10);assert.ok(before.tz<-.99&&Math.abs(before.tx)<.01);assert.ok(after.tx<-.99&&Math.abs(after.tz)<.01);assert.equal(before.s,50);assert.equal(after.s,150);assert.equal(d.length,200);assert.ok(before.level>after.level);
});
