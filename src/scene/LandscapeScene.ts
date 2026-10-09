import {createRiverMist,RIVER_MIST_FALLBACK_DENSITY} from './riverMist';
import {repairShangqingEntryStructure} from './shangqingStructure';
import {createWorldPalace,type WorldPalaces} from './worldPalace';
import {subtractBox,connectionRamp} from './worldPalaceGeometry';
import {palaceExploreAsset} from '../palaceExploreNavigation';
import {createDisplayLayouts,displayGroundOverride,getDisplayGround,displayIsBlocked,type DisplayLayout,type DisplayId} from './displayLayout';
import {createDisplayEnvironment,clipDisplayTerrainRegions} from './displayEnvironment';
import {createFreeExplorer} from './freeExplorer';
import {createRaftTour,RIVER_STATION_REACHES} from './raftTour';
import type {TourRequest,TourStationId} from '../experience/tourSession';
import {createTerrainContactSampler} from './terrainContact';
import {terrainElevation,terrainRenderGrid,loadNativeTerrain,type Terrain as DEM} from './nativeTerrain';
import {createRaftRideRoute,createRaftRideController,measureRaftRidePath,RAFT_RIDE,type RaftRideController,type RaftRideSnapshot} from './raftRide';
import {createNearBankTourPath} from './raftRideNearBank';
import {createRaftWaterSurfaceSampler} from './raftRideWaterSurface';
import {createRiverBankEnvironment} from './riverBankEnvironment';
import {attachRiverSlopeDetail} from './riverSlopeDetail';
import * as THREE from 'three';
import {createObject3DDisposer} from './disposeObject3D';
import {createSceneSun} from './sceneSun';
import {type RiverLandcover} from './riverLandscape';
import {createRiverCanopy} from './riverCanopy';
import type {VegetationGroup} from './siteVegetation';
import {siteGroundHeight} from '../../shared/site-ground.mjs';
import {createWaterDomain} from '../../shared/water-domain.mjs';
import {createRiverReflection} from './riverReflection';
import { createRiverTerrain } from './riverTerrain';
import { geoToWorld, worldToGeo, worldToModelLocal } from '../../shared/geography.mjs';
import { placeAssets } from '../../shared/catalog.mjs';
import { createFlowWater, DEFAULT_WATER, type WaterSettings } from './riverFlow';
export type Tier='high'|'low';
export type AnchorId='river'|'danxia'|'elephant'|'zhengyi'|'tianshi'|'shangqing';
export type SnapshotId='river'|'danxia'|'elephant'|'zhengyi'|'sunset';
export type FrameState={progress:number;pointerX:number;pointerY:number;time:number;motion:boolean;deltaSeconds?:number};
type Terrain=DEM;
type WaterSource={source:{outer:number[][];holes:number[][][]}[];mesh:{vertexCount:number;indexCount:number}};
type Region={rivers:{id:string;coordinates:number[][]}[];buildings:{id:string;coordinates:number[][]}[]};
const scale=10;
const toPoint=(c:number[],height=0)=>{const [x,z]=geoToWorld(c);return new THREE.Vector3(x/scale,height/scale,z/scale);};
export class LandscapeScene {
  readonly renderer:THREE.WebGLRenderer;readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(48,1,RAFT_RIDE.nearScene,3500);disposed=false;
  private releaseObject=createObject3DDisposer();
  private width=1;private height=1;private currentProgress=0;private ground:THREE.Object3D|null=null;private picker=new THREE.Raycaster();private terrain!:Terrain;private waters:ReturnType<typeof createFlowWater>[]=[];
  private waterDomain!:ReturnType<typeof createWaterDomain>;private reflection:ReturnType<typeof createRiverReflection>|null=null;private raftRide:RaftRideController|null=null;
  private displayEnvironments:ReturnType<typeof createDisplayEnvironment>[]=[];
  private displayLayouts:Partial<Record<DisplayId,DisplayLayout>>={};
  private worldPalaces:WorldPalaces={};
  private explorer:ReturnType<typeof createFreeExplorer>|null=null;private exploring=false;private exploreSuspended=true;
  private explorerSite='';private returning:{elapsed:number;position:THREE.Vector3;quaternion:THREE.Quaternion}|null=null;
  private pendingTourRequest:TourRequest|null=null;
  private savedBoatView:{position:THREE.Vector3;quaternion:THREE.Quaternion}|null=null;private arrivalReady=true;private arrivalAimKey='';
  private raftTour:ReturnType<typeof createRaftTour>|null=null;private speedAtmosphere=0;
  private raftWaterSurface:ReturnType<typeof createRaftWaterSurfaceSampler>|null=null;
  // The independent bank environment can attach here through scene.add and our shared disposer.
  private raftEnvironment:(THREE.Group&{updateView?:(camera:THREE.Camera)=>void;disposeInstances?:()=>void})|null=null;
  private sun:ReturnType<typeof createSceneSun>|null=null;
  private mist:ReturnType<typeof createRiverMist>|null=null;
  private forests:VegetationGroup[]=[];private riverForest:VegetationGroup|null=null;private landcover:RiverLandcover|null=null;
  private siteModels=new Map<string,THREE.Object3D>();private siteLoading=new Set<string>();private siteAttemptAt=new Map<string,number>();private siteAbort=new AbortController();
  private anchors={} as Record<AnchorId,THREE.Vector3>;
  private raft=new THREE.Group();private waterSettings={...DEFAULT_WATER};private lastFrame=0;private lastTime=0;private travel=0;private frames:number[]=[];
  private constructor(canvas:HTMLCanvasElement,readonly tier:Tier){this.renderer=new THREE.WebGLRenderer({canvas,antialias:tier==='high',powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,tier==='high'?1.5:1));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NeutralToneMapping;this.scene.background=new THREE.Color('#c4d6d2');this.scene.fog=new THREE.FogExp2('#c4d6d2',RIVER_MIST_FALLBACK_DENSITY);}
  static async create(canvas:HTMLCanvasElement,tier:Tier,onProgress:(v:number,s:string)=>void,cancelled:()=>boolean){
    const self=new LandscapeScene(canvas,tier);
    try{onProgress(.1,'读取真实高程与河道');const responses=await Promise.all(['/assets/geo/terrain.json','/assets/geo/region.json','/assets/geo/water-surfaces.json','/assets/geo/water-surface.bin','/assets/geo/luxi-landcover.json'].map(p=>fetch(p,{signal:AbortSignal.timeout(20000)})));
      if(responses.some(r=>!r.ok))throw new Error('地形数据加载失败');const [terrain,region,waterSource,waterData,coverData]=await Promise.all([responses[0].json(),responses[1].json(),responses[2].json(),responses[3].arrayBuffer(),responses[4].json()]);
      const maskResponse=await fetch(coverData.mask,{signal:AbortSignal.any([self.siteAbort.signal,AbortSignal.timeout(20000)])});if(!maskResponse.ok)throw new Error('河岸地表分区加载失败');const coverTexture=new THREE.Texture(await createImageBitmap(await maskResponse.blob()));coverTexture.needsUpdate=true;coverTexture.colorSpace=THREE.NoColorSpace;coverTexture.flipY=false;coverTexture.anisotropy=Math.min(4,self.renderer.capabilities.getMaxAnisotropy());self.landcover={data:coverData,texture:coverTexture};
      if(cancelled())throw new DOMException('cancelled','AbortError');self.terrain=await loadNativeTerrain(terrain,"/assets/geo/native/mapzen-z13-native-3x3.json",AbortSignal.any([self.siteAbort.signal,AbortSignal.timeout(20000)]));onProgress(.35,'构建区域地形');self.build(region,waterSource,waterData);self.mist=createRiverMist({low:tier==='low'});self.mist.attach(self.scene);self.mist.update({deltaSeconds:0,motion:false,waterLevel:self.waterDomain.flow(self.camera.position.x,self.camera.position.z).level});onProgress(.85,'准备自然日光');await self.renderer.compileAsync(self.scene,self.camera);if(cancelled())throw new DOMException('cancelled','AbortError');onProgress(1,'区域地形已就绪');return self;
    }catch(e){self.dispose();throw e;}
  }
  private elevation(lon:number,lat:number){return terrainElevation(this.terrain,lon,lat);}
  private point(c:number[]){let height=this.elevation(c[0],c[1]);for(const id of ['shangqing','zhengyi','tianshi'] as const){if(id==='tianshi'&&this.displayLayouts.tianshi?.artistic)continue;const geo=placeAssets[id].geo;
    if(Math.abs(c[0]-geo.coordinates[0])<.0015&&Math.abs(c[1]-geo.coordinates[1])<.0018){const [x,z]=geoToWorld(c),local=worldToModelLocal([x,height,z],geo);height=geo.elevation.meters+siteGroundHeight(local[0],local[2],height-geo.elevation.meters,id);}}
    const p=toPoint(c,height);p.y=displayGroundOverride(Object.values(this.displayLayouts),p.x,p.z,p.y,(x,z)=>this.waterDomain?.sample(x,z).inside??false);return p;
  }
  private async loadSite(id:'shangqing'|'zhengyi'|'tianshi'){
    if(this.siteModels.has(id)||this.siteLoading.has(id)||performance.now()-(this.siteAttemptAt.get(id)??-Infinity)<15000)return;this.siteLoading.add(id);this.siteAttemptAt.set(id,performance.now());const statusKey=id==='shangqing'?'siteStatus':id+'Status',asset=placeAssets[id];this.renderer.domElement.dataset[statusKey]='loading';const pendingObjects:THREE.Object3D[]=[];
    try{const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');const response=await fetch(asset.model.src,{signal:AbortSignal.any([this.siteAbort.signal,AbortSignal.timeout(30000)])});if(!response.ok)throw new Error(`GLB HTTP ${response.status}`);const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
      const model=gltf.scene;pendingObjects.push(model);if(this.disposed){this.releaseObject(model);return;}
      const geo=asset.geo,layout=this.displayLayouts[id as DisplayId];
      if(layout){model.position.fromArray(layout.model.position);model.rotation.y=layout.model.rotationY;model.scale.setScalar(layout.model.scale);model.name=`${id} artistic riverside display / original source architecture`;model.userData.displayLayout=layout.id;}
      else{model.position.copy(toPoint(geo.coordinates,geo.elevation.meters));model.rotation.y=-THREE.MathUtils.degToRad(geo.bearing);model.scale.setScalar(geo.alignment.modelScale/scale);model.name=`${id} imagery-aligned exterior`;}
      model.userData.trueGeo=geo;
      model.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)v.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());}));}});
      if(layout){
        // Load into the existing world and camera before opening the walkable footprint.
        const signal=AbortSignal.any([this.siteAbort.signal,AbortSignal.timeout(30000)]);
        const navResponse=await fetch(palaceExploreAsset(id),{signal});if(!navResponse.ok)throw new Error('宫观步行数据加载失败');
        const world=createWorldPalace(layout,await navResponse.json());
        const insideResponse=await fetch(world.nav.document.modelSrc,{signal});if(!insideResponse.ok)throw new Error('宫观内部模型加载失败');
        const inside=(await new GLTFLoader().parseAsync(await insideResponse.arrayBuffer(),'')).scene;pendingObjects.push(inside);
        if(this.disposed){this.releaseObject(model);this.releaseObject(inside);return;}
        const compound=new THREE.Group();compound.name=id+' · continuous world interior · artistic';compound.position.copy(model.position);compound.rotation.copy(model.rotation);compound.scale.copy(model.scale);
        inside.position.fromArray(world.offset);compound.add(inside);
        const b=world.bounds,off=world.offset,half=world.def.halfWidth;
        model.updateWorldMatrix(true,true);compound.updateWorldMatrix(true,true);const reference=model.matrixWorld.clone();
        // Replacement stays within the artistic compound. The source asset used in references is intact.
        subtractBox(model,reference,[b[0]-.02,-30,b[1]-.02],[b[2]+.02,40,b[3]+.02]);
        subtractBox(model,reference,[off[0]-half,-30,b[3]],[off[0]+half,Math.max(off[1],world.outerHeight)+.03,world.def.approachZ]);
        // Open the existing central gateway; keep its pillars, sides and upper structure.
        const gate=id==='zhengyi'?[71.9,74.0]:id==='tianshi'?[128,134]:[81,83];
        subtractBox(model,reference,[off[0]-1.15,Math.min(off[1],world.outerHeight)-.1,gate[0]],[off[0]+1.15,world.linkHeight((gate[0]+gate[1])/2)+2.5,gate[1]]);
        if(id==='shangqing'){const repaired=repairShangqingEntryStructure(model,reference,b);if(repaired)this.renderer.domElement.dataset.shangqingStructureRepair=JSON.stringify(repaired);}
        for(const ground of [this.ground,...this.displayEnvironments.filter(e=>e.userData.displayId===id)])if(ground){
          // Terrain only: props/rails lie outside these central footprints and are left alone.
          const surfaces=ground===this.ground?[ground]:ground.children.filter(o=>o.name.startsWith('continuous '));
          for(const surface of surfaces){subtractBox(surface,reference,[b[0],-10000,b[1]],[b[2],10000,b[3]]);subtractBox(surface,reference,[off[0]-half,-10000,b[3]],[off[0]+half,10000,world.def.approachZ]);}
        }
        compound.add(connectionRamp(off[0],b[3]-.02,world.def.approachZ,off[1],world.outerHeight,half));
        compound.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});
        this.scene.add(compound);this.mist?.attach(compound);this.worldPalaces[id]=world;
        this.renderer.domElement.dataset[id+'WorldInterior']='ready';
      }
      this.siteModels.set(id,model);this.scene.add(model);this.mist?.attach(model);this.sun?.invalidate();this.renderer.domElement.dataset[statusKey]='ready';this.renderer.domElement.dataset[id==='shangqing'?'sitePosition':id+'Position']=model.position.toArray().join(',');this.renderer.domElement.dataset[id==='shangqing'?'siteBearing':id+'Bearing']=String(layout?-THREE.MathUtils.radToDeg(layout.model.rotationY):geo.bearing);this.renderer.domElement.dataset[id+'SourceBearing']=String(geo.bearing);
      if(asset.model.vegetationSrc&&!layout)try{const vegetation=await fetch(asset.model.vegetationSrc,{signal:AbortSignal.any([this.siteAbort.signal,AbortSignal.timeout(10000)])});if(!vegetation.ok)throw new Error('Vegetation unavailable');const [{createSiteVegetation},data]=await Promise.all([import('./siteVegetation'),vegetation.json()]);if(!this.disposed){const siteOrigin=toPoint(geo.coordinates,geo.elevation.meters);const trees=(()=>{const contacts=createTerrainContactSampler(this.ground!);try{const result=createSiteVegetation(this.terrain,data,id,p=>{const world=new THREE.Vector3(siteOrigin.x+Math.fround(p.x)/scale,siteOrigin.y+p.y/scale,siteOrigin.z+Math.fround(p.z)/scale);contacts.place(world,scale,false);return (world.y-siteOrigin.y)*scale;});result.userData.terrainContact=contacts.getStats();return result;}finally{contacts.dispose();}})();trees.position.copy(siteOrigin);trees.scale.setScalar(1/scale);this.scene.add(trees);this.mist?.attach(trees);this.forests.push(trees);this.sun?.invalidate();this.renderer.domElement.dataset[id+'TreeSamples']=String(trees.userData.treeSamples);this.renderer.domElement.dataset.treeShape=trees.userData.treeShape;this.renderer.domElement.dataset.treeSamples=String(trees.userData.treeSamples);}}catch(e){if(!this.disposed)console.warn('周边林地暂未载入',e);}

    }catch(e){if(!this.siteModels.has(id))for(const object of pendingObjects){object.removeFromParent();this.releaseObject(object);}if(!this.disposed){this.renderer.domElement.dataset[statusKey]='retryable-error';console.warn('宫观模型暂未载入，可在地点介绍中重试',e);}}finally{this.siteLoading.delete(id);}
  }
  private build(region:Region,waterSource:WaterSource,waterData:ArrayBuffer){
    const d=this.terrain,b=d.bounds;this.scene.add(new THREE.HemisphereLight('#f2f7ff','#495b38',2.1));this.sun=createSceneSun(this.renderer,this.scene,this.tier==='low');
    const inBounds=(c:number[])=>c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];
    // The two source ways share an endpoint. Join before sampling so the height and UV
    // coordinates remain continuous across that administrative way boundary.
    const upstream=region.rivers.find(r=>r.id==='72051564')?.coordinates||[];
    const downstream=region.rivers.find(r=>r.id==='81192445')?.coordinates||[];
    const shared=upstream.at(-1),first=downstream[0];
    if(!shared||!first||shared[0]!==first[0]||shared[1]!==first[1])throw new Error('源河道接点不连续');
    const coords=[...upstream,...downstream.slice(1)].filter(inBounds),points:THREE.Vector3[]=[];
    let downstreamLevel=Infinity;
    for(let i=0;i<coords.length-1;i++){const a=coords[i],c=coords[i+1],length=this.point(a).distanceTo(this.point(c)),samples=Math.max(1,Math.ceil(length/2));
      for(let j=0;j<samples;j++){const t=j/samples,lon=THREE.MathUtils.lerp(a[0],c[0],t),lat=THREE.MathUtils.lerp(a[1],c[1],t);downstreamLevel=Math.min(downstreamLevel,this.elevation(lon,lat));points.push(toPoint([lon,lat],downstreamLevel+.2));}}
    const end=coords.at(-1)!;points.push(toPoint(end,Math.min(downstreamLevel,this.elevation(end[0],end[1]))+.2));
    this.waterDomain=createWaterDomain(waterSource.source,points.map(p=>p.toArray()));
    const flow=createFlowWater(points,this.waterDomain,waterData,waterSource.mesh.vertexCount,waterSource.mesh.indexCount);this.waters.push(flow);this.scene.add(flow.mesh);
    this.raftWaterSurface=createRaftWaterSurfaceSampler(flow.mesh.geometry.getAttribute('position').array,flow.mesh.geometry.index!.array);
    const allDisplayLayouts=createDisplayLayouts({waterAt:(x,z)=>this.raftWaterSurface!.sample(x,z)??this.waterDomain.flow(x,z).level,groundAt:(x,z)=>{const [lon,lat]=worldToGeo([x*scale,z*scale]);return this.elevation(lon,lat)/scale;},containsWater:(x,z)=>this.waterDomain.sample(x,z).inside});this.displayLayouts=allDisplayLayouts;
    this.ground=createRiverTerrain(b as [number,number,number,number],terrainRenderGrid(d).cols,terrainRenderGrid(d).rows,(u,v)=>this.point([THREE.MathUtils.lerp(b[0],b[2],u),THREE.MathUtils.lerp(b[3],b[1],v)]),this.waterDomain,this.tier==='low',[...(['shangqing','zhengyi','tianshi'] as const).map(id=>({center:toPoint(placeAssets[id].geo.coordinates),radius:17})),...Object.values(this.displayLayouts).map(l=>({center:new THREE.Vector3().fromArray(l.model.position),radius:23}))],this.landcover??undefined,this.terrain.samplingState?.mode==='native-loaded');if(this.displayLayouts.zhengyi)clipDisplayTerrainRegions(this.ground,[{layout:this.displayLayouts.zhengyi,localBoundsMeters:[30,60,42,84]}]);this.scene.add(this.ground);attachRiverSlopeDetail(this.ground,{cover:this.landcover??undefined});
    if(this.landcover){const contacts=createTerrainContactSampler(this.ground!);try{this.riverForest=createRiverCanopy({...this.landcover.data,trees:this.landcover.data.trees.filter(tree=>{const [x,z]=geoToWorld(tree.coordinates),n=this.waterDomain.sample(x/10,z/10);return !n.inside&&n.shoreDistance>.2&&!this.displayExcludes(x/10,z/10);})},c=>contacts.place(this.point(c)),{cover:this.landcover,waterDomain:this.waterDomain,renderer:this.renderer});this.scene.add(this.riverForest);this.renderer.domElement.dataset.riverTreeSamples=String(this.riverForest.userData.treeSamples);this.renderer.domElement.dataset.landcoverSource=this.landcover.data.source.captureDate;this.renderer.domElement.dataset.rockPatches=String(this.landcover.data.polygons.rock);this.riverForest.userData.terrainContact=contacts.getStats();}finally{contacts.dispose();}}
    for(const layout of Object.values(this.displayLayouts)){const environment=createDisplayEnvironment(layout,{sourceGround:this.ground,groundAt:(x,z)=>{const [lon,lat]=worldToGeo([x*scale,z*scale]);return this.elevation(lon,lat)/scale;},containsWater:(x,z)=>this.waterDomain.sample(x,z).inside,low:this.tier==='low'});this.displayEnvironments.push(environment);this.scene.add(environment);}
    if(this.tier==='high')this.reflection=createRiverReflection(this.renderer,this.scene,this.camera,flow);
    const hero=toPoint([116.9629831,28.0749637]),startS=this.waterDomain.flow(hero.x,hero.z).s;
    const nearTour=createNearBankTourPath(points,flow.distances,this.waterDomain,startS,startS+1000),ridePoints=nearTour.samples.map(sample=>sample.position),rideDistances=measureRaftRidePath(ridePoints);
    const rideRoute=createRaftRideRoute(ridePoints,rideDistances,0,rideDistances.at(-1)!,{headingWindowMeters:12,surfaceAt:(x,z)=>this.raftWaterSurface!.sample(x,z)??this.waterDomain.flow(x,z).level,surfaceFootprint:polygon=>this.raftWaterSurface!.footprint(polygon),observation:{startMeters:4,endMeters:115,target:{x:-374.2356910641,y:5.0788366712,z:-63.4386992385}}});
    this.raftRide=createRaftRideController(rideRoute);
    const routes={river:rideRoute} as Record<TourStationId,ReturnType<typeof createRaftRideRoute>>;
    for(const id of ['zhengyi','tianshi','shangqing'] as const){const [a,b]=RIVER_STATION_REACHES[id];routes[id]=createRaftRideRoute(points,flow.distances,a,b,{headingWindowMeters:12,surfaceAt:(x,z)=>{const y=this.raftWaterSurface!.sample(x,z);if(y===undefined||y===null)throw new Error('观览河段超出实际水面');return y;},surfaceFootprint:polygon=>this.raftWaterSurface!.footprint(polygon)});}
    this.raftTour=createRaftTour(routes,this.raftRide,this.tier==='low',id=>{if(id!=='river')void this.loadSite(id);});
    this.renderer.domElement.dataset.raftRouteKind='validated-near-bank-v3';this.renderer.domElement.dataset.raftSourceRouteStartMeters=String(startS);this.renderer.domElement.dataset.raftSourceRouteEndMeters=String(startS+1000);
    const contacts=createTerrainContactSampler(this.ground);try{this.attachRaftEnvironment(createRiverBankEnvironment({points,distances:flow.distances,domain:this.waterDomain,startS,endS:startS+1000,low:this.tier==='low',exclusions:(['shangqing','zhengyi','tianshi'] as const).map(id=>{const p=toPoint(placeAssets[id].geo.coordinates);return{x:p.x,z:p.z,radius:17};}),groundAt:(x,z)=>contacts.place(new THREE.Vector3(x,0,z),scale,false).y}));}finally{contacts.dispose();}
    this.renderer.domElement.dataset.shoreSource='OSM relation 17918405 + way 1306285176';this.renderer.domElement.dataset.waterVertices=String(waterSource.mesh.vertexCount);this.renderer.domElement.dataset.waterTriangles=String(waterSource.mesh.indexCount/3);
    for(const id of ['zhengyi','tianshi','elephant','shangqing'] as const){this.anchors[id]=this.point(placeAssets[id].geo.coordinates).add(new THREE.Vector3(0,4,0));}
    // Source OSM footprints remain in the geo data, but must not float across relocated displays.
    const sourceFootprintSites:Record<string,DisplayId>={'461704512':'zhengyi','461704514':'tianshi'};
    let hiddenDisplayFootprints=0;
    for(const building of region.buildings){const site=sourceFootprintSites[building.id];if(site&&this.displayLayouts[site]?.artistic){hiddenDisplayFootprints++;continue;}const pts=building.coordinates.map(c=>this.point(c).add(new THREE.Vector3(0,.4,0)));this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#e5c58a'})));}
    this.renderer.domElement.dataset.hiddenDisplayFootprints=String(hiddenDisplayFootprints);
    this.anchors.river=this.point([116.9629831,28.0749637]).add(new THREE.Vector3(0,2,0));this.anchors.danxia=this.anchors.elephant.clone();
    this.anchors.shangqing=toPoint(placeAssets.shangqing.geo.entrance.coordinates,placeAssets.shangqing.geo.elevation.meters+4);
    for(const layout of Object.values(this.displayLayouts))this.anchors[layout.id]=new THREE.Vector3().fromArray(layout.entrance).add(new THREE.Vector3(0,.25,0));
    this.renderer.domElement.dataset.displayLayout=JSON.stringify(this.displayLayouts);
    const bamboo=new THREE.MeshStandardMaterial({color:'#a79a64',roughness:.86}),binding=new THREE.MeshStandardMaterial({color:'#4c4b34',roughness:1});
    const logGeometry=new THREE.CylinderGeometry(.01,.009,RAFT_RIDE.lengthMeters/scale,8);
    const jointMaterial=new THREE.MeshStandardMaterial({color:'#7c784e',roughness:1}),jointGeometry=new THREE.TorusGeometry(.0101,.0005,4,8);
    for(let i=0;i<11;i++){const log=new THREE.Mesh(logGeometry,bamboo);log.rotation.x=Math.PI/2;log.position.set((i-5)*.02,.007,0);this.raft.add(log);for(const z of [-.21,-.055,.11,.265]){const joint=new THREE.Mesh(jointGeometry,jointMaterial);joint.position.set((i-5)*.02,.007,z);this.raft.add(joint);}}
    for(const z of [-.2,.2]){const tie=new THREE.Mesh(new THREE.CylinderGeometry(.0018,.0018,.22,6),binding);tie.rotation.z=Math.PI/2;tie.position.set(0,.018,z);this.raft.add(tie);}
    this.raft.name='Seated bamboo raft · estimated 2.2m by 5.8m';this.scene.add(this.raft);this.applyRaftPose();
  }
  /** Historical callers remain compatible; seated river travel is now the default everywhere. */
  setWaterView(_value:boolean){}
  getRaftState():RaftRideSnapshot|null{return this.raftRide?.snapshot()??null;}
  setRaftSuspended(value:boolean){this.raftTour?.suspend(value);this.raftRide?.setSuspended(value);this.writeRaftTelemetry();}
  selectTourStation(request:TourRequest){
    // Finish the visible return to the saved raft before departing; retain only the newest request.
    if(this.exploring)this.setExploreActive(false);
    if(this.returning){
      if(request.resume)this.raftRide?.setPaused(false);
      this.pendingTourRequest={...request,resume:false};return;
    }
    this.pendingTourRequest=null;this.arrivalAimKey='';this.explorer?.clearInput();this.savedBoatView=null;
    this.raftTour?.select(request);this.raftRide=this.raftTour?.controller??this.raftRide;
  }
  getTourPresentation(){
    const value=this.raftTour?.presentation()??{phase:'loading',status:'正在准备河面',transition:0};
    if(this.returning){const t=this.returning.elapsed;return{phase:'returning',status:'回到已保存的竹筏位置',transition:t<.4?THREE.MathUtils.smoothstep(t,0,.4):1-THREE.MathUtils.smoothstep(t,.4,.8)};}
    if(this.exploring){const p=this.explorer?.pose(),w=this.worldPalaces[this.explorerSite as DisplayId];return{...value,phase:'arrived',status:'大地图探索 · '+(p&&w?w.zone(p.position.x,p.position.z):'沿岸步道')+' · 内部艺术化补全',transition:0};}
    const id=this.raftTour?.current;
    if(value.phase==='arrived'&&id&&this.displayLayouts[id as DisplayId])return{...value,phase:this.arrivalReady?'arrived':'approaching',status:this.arrivalReady?`${this.displayLayouts[id as DisplayId]!.label} · 已抵达观景位`:'正在准备宫观观景视角'};
    return value;
  }
  setRaftReducedMotion(value:boolean){this.raftRide?.setReducedMotion(value);}
  toggleRaftPaused(){this.raftRide?.togglePaused();this.writeRaftTelemetry();}
  lookRaft(yaw:number,pitch=0){if(!this.returning)this.raftRide?.look(yaw,pitch);}
  recenterRaft(){if(this.returning)return;if(this.raftTour?.phase==='arrived'&&this.displayLayouts[this.raftTour.current as DisplayId]){this.arrivalAimKey='';this.raftRide?.resumeAutomaticLook();}else this.raftRide?.recenter();}
  attachRaftEnvironment(group:THREE.Group&{updateView?:(camera:THREE.Camera)=>void}){this.raftEnvironment=group;this.scene.add(group);this.mist?.attach(group);this.sun?.invalidate();}
  setWaterSettings(settings:Partial<WaterSettings>){Object.assign(this.waterSettings,settings);}
  resetFrameClock(){this.lastFrame=0;}
  resize(w:number,h:number){this.width=Math.max(w,1);this.height=Math.max(h,1);this.renderer.setSize(this.width,this.height,false);this.camera.aspect=w/h;this.camera.fov=w<h?62:48;this.camera.updateProjectionMatrix();}
  update(state:FrameState){this.currentProgress=state.progress;const now=performance.now();if(this.lastFrame){this.frames.push(now-this.lastFrame);if(this.frames.length>120)this.frames.shift();}this.lastFrame=now;
    const dt=state.deltaSeconds??Math.max(0,Math.min(.1,state.time-this.lastTime));
    this.raftTour?.advance(dt,state.motion);this.raftRide=this.raftTour?.controller??this.raftRide;this.steerArrival(dt);const target=this.applyRaftPose(dt);
    for(const id of ['tianshi','shangqing','zhengyi'] as const)if(this.siteIsNearby(id))void this.loadSite(id);
    this.travel+=state.motion?Math.max(0,Math.min(.1,dt))*this.waterSettings.speed:0;this.lastTime=state.time;
    for(const water of this.waters){const u=water.uniforms;u.uTravel.value=this.travel;u.uTime.value=state.time;u.uSpeed.value=this.waterSettings.speed;u.uStrength.value=this.waterSettings.strength;u.uOpacity.value=this.waterSettings.opacity;u.uReflection.value=this.waterSettings.reflection;}
    const route=this.waters[0],ride=this.raftRide?.snapshot();if(route&&ride){const flow=this.waterDomain.flow(this.raft.position.x,this.raft.position.z);route.uniforms.uWakeS.value=flow.s;route.uniforms.uWakeX.value=flow.across;route.uniforms.uWakeSpeed.value=ride.speedMetersPerSecond;}
    const speed=Math.abs(ride?.speedMetersPerSecond??0);
    if(!ride?.suspended)this.speedAtmosphere+=(Math.min(1,speed/6)-this.speedAtmosphere)*(1-Math.exp(-dt*2.5));
    this.mist?.update({deltaSeconds:dt,motion:state.motion&&!ride?.suspended&&(!this.exploring||!this.exploreSuspended),reducedMotion:ride?.reducedMotion,waterLevel:this.waterDomain.flow(this.camera.position.x,this.camera.position.z).level,exploring:this.exploring,speedAtmosphere:this.speedAtmosphere});
    this.renderer.domElement.dataset.speedAtmosphere=String(this.speedAtmosphere);
    this.raftEnvironment?.updateView?.(this.camera);
    if(this.riverForest?.updateView(this.camera,this.tier==='low')){this.renderer.domElement.dataset.riverTreeLod=this.riverForest.userData.treeLOD.join(',');this.sun?.invalidate();}
    for(const forest of this.forests){if(forest.updateView(this.camera,this.tier==='low')){this.renderer.domElement.dataset.treeLod=forest.userData.treeLOD.join(',');this.sun?.invalidate();}}
    this.sun?.prepare(this.camera,target,now);
    const capture=this.tier==='high'&&this.waterSettings.reflection>.5;this.reflection?.update(now,this.waterDomain.flow(this.raft.position.x,this.raft.position.z).level,capture);this.renderer.domElement.dataset.reflectionMode=capture?'planar-1024x512':'environment';this.renderer.domElement.dataset.waterView='raft-seated';
    this.renderer.render(this.scene,this.camera);this.sun?.finishFrame();
    this.renderer.domElement.dataset.sceneTime=state.time.toFixed(4);this.renderer.domElement.dataset.riverTravel=this.travel.toFixed(4);this.renderer.domElement.dataset.camera=this.camera.position.toArray().join(',');
    this.renderer.domElement.dataset.frameTime=(this.frames.reduce((a,b)=>a+b,0)/Math.max(1,this.frames.length)).toFixed(2);this.renderer.domElement.dataset.triangles=String(this.renderer.info.render.triangles);
  }
  private applyRaftPose(dt=0){
    const p=this.raftRide!.pose();this.raft.position.set(p.x,p.hullCenterY+p.heave,p.z);this.raft.rotation.order='YXZ';this.raft.rotation.set(p.boatPitch,p.heading,p.roll);this.raft.visible=true;
    this.camera.position.set(p.eye.x,p.eye.y,p.eye.z);const target=this.camera.position.clone().add(new THREE.Vector3(p.direction.x,p.direction.y,p.direction.z).multiplyScalar(12));
    this.camera.up.set(0,1,0);this.camera.lookAt(target);
    if(this.exploring&&this.explorer){const pose=this.explorer.advance(dt);this.camera.position.set(pose.position.x,pose.position.y,pose.position.z);target.copy(this.camera.position).add(new THREE.Vector3(pose.direction.x,pose.direction.y,pose.direction.z).multiplyScalar(8));this.camera.lookAt(target);}
    if(this.returning){if(!this.exploreSuspended){const previous=this.returning.elapsed;this.returning.elapsed+=dt;if(previous<.4&&this.returning.elapsed>=.4)this.returning.elapsed=.4;}if(this.returning.elapsed<.4){this.camera.position.copy(this.returning.position);this.camera.quaternion.copy(this.returning.quaternion);}else if(this.savedBoatView){this.camera.position.copy(this.savedBoatView.position);this.camera.quaternion.copy(this.savedBoatView.quaternion);}if(this.returning.elapsed>=.8){this.returning=null;this.savedBoatView=null;const pending=this.pendingTourRequest;this.pendingTourRequest=null;if(pending)this.selectTourStation(pending);}}
    target.copy(this.camera.position).add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));this.writeRaftTelemetry();return target;
  }
  private writeRaftTelemetry(){
    if(!this.raftRide)return;const s=this.raftRide.snapshot(),p=this.raftRide.pose(),d=this.renderer.domElement.dataset,n=this.waterDomain.sample(p.eye.x,p.eye.z);
    d.cameraPhase=this.exploring?'free-explore':this.returning?'return-to-raft':'raft-seated';d.raftTravelMeters=s.travelMeters.toFixed(4);d.raftChainageMeters=this.waterDomain.flow(p.x,p.z).s.toFixed(4);d.raftRouteStartMeters=s.routeStartMeters.toFixed(4);d.raftRouteEndMeters=s.routeEndMeters.toFixed(4);
    d.raftPosition=this.raft.position.toArray().join(',');d.raftHeading=String(p.heading);d.raftRoll=String(p.roll);d.raftHeaveMeters=String(p.heave*scale);d.raftEyeHeightMeters=String((p.eye.y-p.eyeWaterY)*scale);d.raftBoatPitch=String(p.boatPitch);d.raftCenterLiftMeters=String((p.hullCenterY-p.y)*scale);d.raftManualLook=String(s.manualLook);d.raftMinimumDeckClearanceMeters=String(p.minimumDeckClearanceMeters);
    d.raftYaw=String(s.yaw);d.raftPitch=String(s.pitch);d.raftPaused=String(s.paused);d.raftUserPaused=String(s.userPaused);d.raftSpeedMetersPerSecond=s.speedMetersPerSecond.toFixed(4);d.raftDirection=[Math.sin(p.heading),0,Math.cos(p.heading)].join(',');
    d.raftPauseReason=s.suspended?'suspended':s.reducedMotion?'reduced-motion':s.userPaused?'user':s.atEnd?'route-end':'none';d.raftShoreDistanceMeters=String(n.shoreDistance*scale);d.raftInsideWater=String(n.inside);d.raftDeckHeightMeters=String(RAFT_RIDE.deckAboveWaterMeters);
    d.camera=this.camera.position.toArray().join(',');d.cameraDirection=this.camera.getWorldDirection(new THREE.Vector3()).toArray().join(',');d.cameraNear=String(this.camera.near);
    const tour=this.raftTour?.diagnostics();if(tour){d.raftRouteKind=tour.current==='river'?'validated-near-bank-v3':'verified-regional-water-reach';if(tour.current!=='river'){d.raftSourceRouteStartMeters=String(s.routeStartMeters);d.raftSourceRouteEndMeters=String(s.routeEndMeters);}else{d.raftSourceRouteStartMeters=String(RIVER_STATION_REACHES.river[0]);d.raftSourceRouteEndMeters=String(RIVER_STATION_REACHES.river[0]+1000);}
    d.tourCurrent=String(tour.current);d.tourTarget=String(tour.target);d.tourPhase=tour.phase;d.tourVeil=String(tour.alpha);d.tourSerial=String(tour.lastSerial);d.tourSuspended=String(tour.suspended);}
    d.raftTargetTravelMeters=String(s.targetTravelMeters);d.raftJourneyPhase=s.journeyPhase;d.raftJourneyElapsed=String(s.journeyElapsedSeconds);
    d.cameraTransitionAlpha=String(this.getTourPresentation().transition);d.exploreActive=String(this.exploring);d.exploreState=JSON.stringify(this.getExploreState());d.exploreMap=JSON.stringify(this.getExploreMap());
    d.raftWaterSurfaceMode='rendered-mesh-triangle';d.raftWaterSurfaceMisses=String(this.raftWaterSurface?.stats().misses??0);
  }
  private displayExcludes(x:number,z:number){return Object.values(this.displayLayouts).some(l=>{const b=l.mapBoundsXZ;return x>b[0]-1&&x<b[2]+1&&z>b[1]-1&&z<b[3]+1;});}
  private steerArrival(dt:number){
    this.arrivalReady=true;const id=this.raftTour?.current,layout=id?this.displayLayouts[id as DisplayId]:null,c=this.raftRide;
    if(!layout||!c)return;
    const s=c.snapshot(),phase=this.raftTour?.phase,key=layout.id+':'+this.raftTour?.diagnostics().lastSerial;this.arrivalReady=this.siteModels.has(layout.id)&&(s.manualLook||this.arrivalAimKey===key);if(this.arrivalAimKey===key)return;
    if(this.exploring||this.returning||s.suspended||s.userPaused||s.manualLook||!['approaching','arrived','revealing'].includes(phase??''))return;
    const p=c.pose(),target=new THREE.Vector3().fromArray(layout.arrivalLookAt),dx=target.x-p.eye.x,dz=target.z-p.eye.z;
    const desired=Math.atan2(dx,dz),pitch=Math.atan2(target.y-p.eye.y,Math.hypot(dx,dz));
    const base=p.cameraHeading-s.yaw,wrap=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
    const weight=THREE.MathUtils.smoothstep(s.travelMeters,8,19),wanted=wrap(desired-base)*weight,k=1-Math.exp(-dt*3);
    c.setAutomaticView(s.reducedMotion?wanted:s.yaw+wrap(wanted-s.yaw)*k,s.reducedMotion?pitch*weight:s.pitch+(pitch*weight-s.pitch)*k);
    if((phase==='arrived'||s.reducedMotion)&&weight===1&&Math.abs(wrap(desired-c.pose().cameraHeading))<.012&&Math.abs(pitch-c.pose().cameraPitch)<.008){c.setAutomaticView(wanted,pitch);this.arrivalAimKey=key;this.arrivalReady=this.siteModels.has(layout.id);}
  }
  setExploreActive(active:boolean){
    if(active===this.exploring||active&&(this.returning||this.pendingTourRequest))return;
    if(active){const id=this.raftTour?.current,layout=id?this.displayLayouts[id as DisplayId]:null;if(!layout||!this.raftRide||!this.siteModels.has(layout.id))return;
      this.savedBoatView={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone()};const direction=this.camera.getWorldDirection(new THREE.Vector3());
      this.explorer=createFreeExplorer({initialPosition:{x:this.camera.position.x,y:this.camera.position.y,z:this.camera.position.z},initialDirection:{x:direction.x,y:direction.y,z:direction.z},sampleGround:(x,z)=>this.worldPalaces[layout.id]?this.worldPalaces[layout.id]!.ground(x,z):getDisplayGround(layout,x,z),isBlocked:(x,z,r)=>this.worldPalaces[layout.id]?.blocked(x,z,r)??displayIsBlocked(layout,x,z,r),speed:.30,boost:.58});
      this.explorerSite=layout.id;this.exploring=true;this.returning=null;this.explorer.setSuspended(this.exploreSuspended);
    }else{this.explorer?.clearInput();this.exploring=false;this.returning={elapsed:0,position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone()};}
  }
  setExploreSuspended(value:boolean){this.exploreSuspended=value;this.explorer?.setSuspended(value);}
  setExploreInput(forward:number,right:number,fast=false){if(this.exploring&&!this.exploreSuspended)this.explorer?.setInput(forward,right,fast);else this.explorer?.clearInput();}
  lookExplore(yaw:number,pitch=0){if(this.exploring&&!this.exploreSuspended)this.explorer?.look(yaw,pitch);}
  getExploreState(){if(!this.explorer)return null;const p=this.explorer.pose();return{active:this.exploring,suspended:this.exploreSuspended,site:this.explorerSite,position:p.position,direction:p.direction,yaw:p.yaw,pitch:p.pitch,zone:this.worldPalaces[this.explorerSite as DisplayId]?.zone(p.position.x,p.position.z)??'沿岸',inside:this.worldPalaces[this.explorerSite as DisplayId]?.insideWorld(p.position.x,p.position.z)??false};}
  getExploreMap(){const id=this.exploring?this.explorerSite:this.raftTour?.current,l=id?this.displayLayouts[id as DisplayId]:null;if(!l)return null;const p=this.explorer?.pose();return{id:l.id,label:l.label+'沿岸展示',mapBoundsXZ:{minX:l.mapBoundsXZ[0],minZ:l.mapBoundsXZ[1],maxX:l.mapBoundsXZ[2],maxZ:l.mapBoundsXZ[3]},support:{polygonXZ:l.support.polygonXZ},entrance:this.worldPalaces[l.id]?.entry??l.entrance,landing:{landPath:l.landing.walkPath},position:p?.position,direction:p?.direction};}
  private siteIsNearby(id: string) {
    const anchor=this.anchors[id as AnchorId];return Boolean(anchor&&this.camera.position.distanceTo(anchor)<85);
  }
  /** Only actual loaded building triangles are selectable; terrain can occlude them. */
  pickSite(clientX: number, clientY: number): AnchorId | null {
    if (this.disposed) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    this.picker.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),this.camera);
    let picked: AnchorId | null = null, distance = Infinity;
    for (const [id,model] of this.siteModels) {
      if (!this.siteIsNearby(id) || !model.visible) continue;
      const hit = this.picker.intersectObject(model,true)[0];
      if (hit && hit.distance < distance) { distance=hit.distance; picked=id as AnchorId; }
    }
    if (picked && this.ground) {
      const blocker=this.picker.intersectObject(this.ground,true)[0];
      if (blocker && blocker.distance < distance-.01) return null;
    }
    return picked;
  }
  projectAnchors(_p:number,out:Record<AnchorId,{x:number;y:number;visible:boolean}>){
    for(const id of Object.keys(out) as AnchorId[]){
      const v=this.anchors[id].clone().project(this.camera);
      out[id].x=(v.x*.5+.5)*this.width;out[id].y=(-v.y*.5+.5)*this.height;
      const nearby=id==='zhengyi'||id==='shangqing'||id==='tianshi'?this.siteIsNearby(id)&&this.siteModels.has(id):id!=='danxia'&&this.camera.position.distanceTo(this.anchors[id])<120;
      out[id].visible=nearby&&v.z>-1&&v.z<1&&Math.abs(v.x)<.86&&Math.abs(v.y)<.72;
    }
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.mist?.dispose();this.explorer?.clearInput();this.displayEnvironments.forEach(e=>e.disposeInstances());this.raftWaterSurface?.dispose();this.raftEnvironment?.disposeInstances?.();this.riverForest?.userData.disposeCanopy?.();this.siteAbort.abort();this.reflection?.dispose();this.sun?.dispose();this.releaseObject(this.scene,this.landcover?[this.landcover.texture]:[]);this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();}
}
