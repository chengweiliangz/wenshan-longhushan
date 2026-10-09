import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {geoToWorld,worldToGeo,modelLocalToWorld,worldToModelLocal} from '../shared/geography.mjs';
import {placeAssets,spots} from '../shared/catalog.mjs';
test('all catalog entries have independent evidence records and only own photos',async()=>{
  for(const spot of spots){const a=placeAssets[spot.id];assert.ok(a);for(const p of a.photos){assert.equal(p.spotId,spot.id);assert.ok(p.author&&p.source&&p.license);await access(new URL('../public'+p.src,import.meta.url));}
    for(const n of [...a.interior.nodes,...a.gallery.nodes])assert.ok(a.photos.some(p=>p.id===n.photoId));
    if(a.model)await access(new URL('../public'+a.model.src,import.meta.url));
  }
  assert.equal(placeAssets.shangqing.interior.mode,'photo-guide');assert.equal(placeAssets.shangqing.model.georeferenced,true);assert.ok(placeAssets.zhengyi.geo.entrance);assert.ok(placeAssets.tianshi.geo.entrance);
});
test('geographic frame preserves real distance, axis direction and round trips',()=>{
  const z=placeAssets.zhengyi.geo.coordinates,t=placeAssets.tianshi.geo.coordinates;
  const a=geoToWorld(z),b=geoToWorld(t),distance=Math.hypot(a[0]-b[0],a[1]-b[1]);assert.ok(distance>5000&&distance<6000,`distance ${distance}`);
  const restored=worldToGeo(a);assert.ok(Math.abs(restored[0]-z[0])<1e-9&&Math.abs(restored[1]-z[1])<1e-9);
  assert.ok(geoToWorld([117.01,28.08])[0]>0&&geoToWorld([117.01,28.08])[1]<0);assert.throws(()=>geoToWorld(z,undefined,'GCJ-02'));
});
test('terrain and river source grids are complete and use geographic source data',async()=>{
  const d=JSON.parse(await readFile(new URL('../public/assets/geo/terrain.json',import.meta.url)));assert.equal(d.heights.length,d.cols*d.rows);assert.ok(d.heights.every(Number.isFinite));assert.ok(Math.max(...d.heights)>300);assert.equal(d.crs,'EPSG:4326');
  const r=JSON.parse(await readFile(new URL('../public/assets/geo/region.json',import.meta.url)));assert.equal(r.rivers.find(a=>a.id==='72051564').coordinates.at(-1)[0],r.rivers.find(a=>a.id==='81192445').coordinates[0][0]);
});

test('Shangqing model fits imagery controls and keeps the old POI distinct from its entry',async()=>{
 const a=JSON.parse(await readFile(new URL('../public/assets/geo/shangqing-alignment.json',import.meta.url))),geo=placeAssets.shangqing.geo;
 for(const p of a.controlPoints){const w=modelLocalToWorld([p.planLocalMeters[0],0,-p.planLocalMeters[1]],geo),[x,z]=geoToWorld(p.coordinates);assert.ok(Math.hypot(w[0]-x,w[2]-z)<1.5);const v=worldToModelLocal(w,geo);assert.ok(Math.abs(v[0]-p.planLocalMeters[0])<1e-8&&Math.abs(v[2]+p.planLocalMeters[1])<1e-8);}
 const entry=geoToWorld(geo.entrance.coordinates),fumo=geoToWorld(geo.landmarks[0].coordinates);assert.ok(Math.hypot(entry[0]-fumo[0],entry[1]-fumo[1])>100);
 const local=worldToModelLocal([entry[0],geo.elevation.meters,entry[1]],geo);assert.ok(Math.abs(local[0])<5&&local[2]>45&&local[2]<65);
 assert.equal(geo.elevation.surveyed,false);assert.equal(geo.alignment.surveyed,false);assert.equal(a.imageMetadata.captureDate,'2023-10-30');
});

test('forecourt grade stays below the modern platform and preserves distant DEM',async()=>{
 const {siteGroundHeight}=await import('../shared/site-ground.mjs');
 assert.ok(siteGroundHeight(0,68,4)<siteGroundHeight(0,0,4)-1.5);
 assert.ok(siteGroundHeight(0,68,4)<-2.1,'paving is not buried');
 assert.equal(siteGroundHeight(130,0,8),8);
 const vegetation=JSON.parse(await readFile(new URL('../public/assets/geo/shangqing-vegetation.json',import.meta.url)));
 assert.equal(vegetation.surveyed,false);assert.equal(vegetation.imageDate,'2023-10-30');assert.ok(vegetation.trees.length>500);
 assert.ok(vegetation.trees.every(t=>t.coordinates[0]>117.04&&t.coordinates[0]<117.05&&t.coordinates[1]>28.04&&t.coordinates[1]<28.06));
});

test('Zhengyi uses its own southwest gate and source roof controls, not Shangqing placement',async()=>{
 const a=JSON.parse(await readFile(new URL('../public/assets/geo/zhengyi-alignment.json',import.meta.url))),geo=placeAssets.zhengyi.geo;
 assert.ok(geo.bearing>35&&geo.bearing<50);assert.equal(geo.alignment.surveyed,false);
 const entry=geoToWorld(geo.entrance.coordinates),center=geoToWorld(geo.coordinates);
 assert.ok(entry[0]<center[0]&&entry[1]>center[1]);assert.ok(Math.hypot(entry[0]-center[0],entry[1]-center[1])>60);
 for(const p of a.controlPoints){const w=modelLocalToWorld(p.modelLocalMeters,geo),expected=geoToWorld(p.coordinates);assert.ok(Math.hypot(w[0]-expected[0],w[2]-expected[1])<.02);}
 const {siteGroundHeight}=await import('../shared/site-ground.mjs');assert.ok(siteGroundHeight(0,72,10,'zhengyi')<-.85);assert.equal(siteGroundHeight(150,0,10,'zhengyi'),10);
 const interior=placeAssets.zhengyi.photos.find(p=>p.id==='zhengyi-hall-interior');assert.ok(interior.source.includes('42960')&&interior.captured.includes('2024-10-30'));
 assert.notEqual(placeAssets.zhengyi.model.src,placeAssets.shangqing.model.src);
});

 test('Tianshi keeps its own long courtyard axis, southern threshold and photo evidence',async()=>{
 const a=JSON.parse(await readFile(new URL('../public/assets/geo/tianshi-alignment.json',import.meta.url))),site=placeAssets.tianshi,geo=site.geo;
 assert.ok(geo.bearing>340&&geo.bearing<355);assert.equal(geo.alignment.surveyed,false);
 const gate=geoToWorld(geo.entrance.coordinates),center=geoToWorld(geo.coordinates);assert.ok(gate[1]>center[1]&&Math.hypot(gate[0]-center[0],gate[1]-center[1])>125);assert.ok(geo.entrance.elevationMeters<geo.elevation.meters-3);
 for(const p of a.controlPoints){const w=modelLocalToWorld(p.modelLocalMeters,geo),expected=geoToWorld(p.coordinates);assert.ok(Math.hypot(w[0]-expected[0],w[2]-expected[1])<.02);}
 assert.equal(new Set(['shangqing','zhengyi','tianshi'].map(id=>placeAssets[id].model.src)).size,3);assert.ok(site.photos.find(p=>p.id==='tianshi-private-hall').captured.includes('2024-10-29'));assert.equal(site.interior.nodes[0].photoId,'tianshi-head-gate');
 const {siteGroundHeight}=await import('../shared/site-ground.mjs');assert.ok(siteGroundHeight(0,133,7,'tianshi')< -3);assert.equal(siteGroundHeight(150,0,7,'tianshi'),7);
 });

test('Tianshi canopy samples belong to its own source and keep the mapped entry clear',async()=>{
 const d=JSON.parse(await readFile(new URL('../public/assets/geo/tianshi-vegetation.json',import.meta.url))),geo=placeAssets.tianshi.geo;assert.equal(d.siteId,'tianshi');assert.equal(d.surveyed,false);assert.equal(d.imageDate,'2023-10-30');assert.ok(d.trees.length>100&&d.trees.length<400);
 for(const t of d.trees){const [x,z]=geoToWorld(t.coordinates),l=worldToModelLocal([x,geo.elevation.meters,z],geo);assert.ok(Math.hypot(l[0]-t.modelLocalMeters[0],l[2]-t.modelLocalMeters[2])<.02);assert.ok(t.clearanceMeters>=t.radius*1.25+.99);assert.ok(Math.abs(l[0])<100&&Math.abs(l[2])<160);}
 assert.notEqual(placeAssets.tianshi.model.vegetationSrc,placeAssets.shangqing.model.vegetationSrc);const {siteGroundHeight}=await import('../shared/site-ground.mjs');assert.ok(siteGroundHeight(0,162,8,'tianshi')< -3.3);assert.equal(siteGroundHeight(150,162,8,'tianshi'),8);
});
