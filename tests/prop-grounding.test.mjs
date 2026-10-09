import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
const root=new URL('../',import.meta.url),require=createRequire(new URL('package.json',root)),{buildSync}=require('esbuild');
const code=buildSync({stdin:{contents:"export * from './propGrounding'; export {createDisplayEnvironment} from './displayEnvironment';",loader:'ts',resolveDir:fileURLToPath(new URL('src/scene/',root))},bundle:true,platform:'node',format:'esm',external:['three'],write:false,logLevel:'silent'}).outputFiles[0].text;
const output=code.replaceAll('from "three"','from '+JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href)).replaceAll('from "three/examples/jsm/utils/BufferGeometryUtils.js"','from '+JSON.stringify(new URL('../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',import.meta.url).href));
const {createPropGroundSampler,fitPropToGround,measurePropExposure,createDisplayEnvironment}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b);
function ground(bounds,height,cols=8,rows=8,omit=()=>false){
 const [x0,z0,x1,z1]=bounds,positions=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=x0+(x1-x0)*i/cols,z=z0+(z1-z0)*j/rows;positions.push(x,height(x,z),z);}
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;if(!omit(i,j))indices.push(a,b,a+1,a+1,b,b+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
}
function actualGround(surfaces,x,z){
 for(const root of surfaces)root.updateWorldMatrix(true,true);
 const ray=new THREE.Raycaster(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0),0,200),hit=ray.intersectObjects(surfaces,true)[0];return hit?.point.y??null;
}
function lowerBand(geometry,matrix,fraction){
 const position=geometry.getAttribute('position'),vertices=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix)),ys=vertices.map(v=>v.y),cutoff=Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*fraction,samples=[];
 vertices.filter(v=>v.y<=cutoff+1e-8).forEach(v=>samples.push(v));
 const count=geometry.index?.count??position.count;
 for(let i=0;i<count;i+=3){
  const tri=[0,1,2].map(j=>vertices[geometry.index?.getX(i+j)??i+j]),normal=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));if(normal.y>=-1e-12)continue;
  const polygon=[];
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(a.y<=cutoff)polygon.push(a);if((a.y<=cutoff)!==(b.y<=cutoff))polygon.push(a.clone().lerp(b,(cutoff-a.y)/(b.y-a.y)));}
  for(let j=1;j+1<polygon.length;j++){const a=polygon[0],b=polygon[j],c=polygon[j+1];samples.push(a.clone().add(b).add(c).multiplyScalar(1/3),a.clone().lerp(b,.5),b.clone().lerp(c,.5),c.clone().lerp(a,.5));}
 }
 return samples;
}
test('static sampler selects the actual highest triangle, respects holes/transforms, and never modifies terrain',()=>{
 const source=ground([-4,-4,4,4],(x,z)=>2+x*.12-z*.18,4,4),patch=ground([-2,-2,2,2],()=>3,2,2,(i,j)=>i===1&&j===1),parent=new THREE.Group();parent.position.set(3,.3,-2);parent.rotation.y=.2;parent.add(source,patch);parent.updateMatrixWorld(true);
 const before=Array.from(source.geometry.getAttribute('position').array),sampler=createPropGroundSampler([parent],{minX:-3,minZ:-8,maxX:9,maxZ:4});
 for(const local of [[-1,-1],[1,1],[-3,2],[.4,-1.4],[2.1,-2.1]]){const p=new THREE.Vector3(local[0],0,local[1]).applyMatrix4(parent.matrixWorld),actual=actualGround([parent],p.x,p.z);assert.ok(actual!==null);close(sampler.sample(p.x,p.z),actual,1e-7);}
 assert.equal(sampler.sample(50,50),null);assert.deepEqual(Array.from(source.geometry.getAttribute('position').array),before);const stats=sampler.getStats();assert.ok(stats.triangles>0);assert.ok(stats.cells>0);sampler.dispose();sampler.dispose();assert.throws(()=>sampler.sample(3,2),/disposed/);
});
test('a tilted anisotropic rock embeds its true lower area, keeps XZ/rotation/scale and follows actual slope',()=>{
 const source=ground([-4,-4,4,4],(x,z)=>1+.16*x-.09*z+.04*Math.sin(x*2),16,16),patch=ground([-1,-1,1,1],()=>1.13,4,4),surfaces=[source,patch],sampler=createPropGroundSampler(surfaces,{minX:-4,minZ:-4,maxX:4,maxZ:4});
 const geometry=new THREE.IcosahedronGeometry(1,1),matrix=new THREE.Matrix4().compose(new THREE.Vector3(.3,0,.2),new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.8,.12)),new THREE.Vector3(.5,.16,.3)),before=matrix.elements.slice(),fit=fitPropToGround(geometry,matrix,(x,z)=>sampler.sample(x,z),{baseFraction:.32,embedScene:.009,sampleSpacingScene:.025});
 matrix.elements[13]+=fit.translationY;for(const i of [0,1,2,3,4,5,6,7,8,9,10,11,12,14,15])assert.equal(matrix.elements[i],before[i]);
 const samples=lowerBand(geometry,matrix,.32);assert.ok(samples.length>40);for(const p of samples){const g=actualGround(surfaces,p.x,p.z);assert.ok(g!==null);assert.ok(p.y-g<=-.0088,'actual lower rock area remained unsupported: '+(p.y-g));}
 assert.equal(fit.missingSamples,0);assert.ok(fit.maximumBaseGapScene<=-.009+1e-10);assert.ok(fit.sampleCount>samples.length/2);sampler.dispose();
});
test('trunk root cap and grass root geometry are placed below an actual sloped mesh, not a center-height offset',()=>{
 const source=ground([-1,-1,1,1],(x,z)=>.4+.35*x-.2*z,4,4),sampler=createPropGroundSampler([source],{minX:-1,minZ:-1,maxX:1,maxZ:1});
 const trunk=new THREE.CylinderGeometry(.72,1,1,6),matrix=new THREE.Matrix4().compose(new THREE.Vector3(.2,0,.1),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,.4,0)),new THREE.Vector3(.018,.6,.018)),fit=fitPropToGround(trunk,matrix,(x,z)=>sampler.sample(x,z),{baseFraction:0,embedScene:.004});matrix.elements[13]+=fit.translationY;
 for(const p of lowerBand(trunk,matrix,0))assert.ok(p.y-actualGround([source],p.x,p.z)<=-.00399);
 const grass=new THREE.BufferGeometry();grass.setAttribute('position',new THREE.Float32BufferAttribute([-.03,0,0,.03,0,0,0,.1,.02],3));const grassMatrix=new THREE.Matrix4().makeTranslation(-.2,0,.1),grassFit=fitPropToGround(grass,grassMatrix,(x,z)=>sampler.sample(x,z),{baseFraction:0,embedScene:.0015});grassMatrix.elements[13]+=grassFit.translationY;
 for(const p of lowerBand(grass,grassMatrix,0))assert.ok(p.y-actualGround([source],p.x,p.z)<=-.00149);sampler.dispose();
});
function layout(){
 return{id:'zhengyi',label:'正一观',artistic:true,notice:'艺术化展示',model:{position:[0,5,0],rotationY:-.45,scale:.1},support:{localBoundsModelMeters:[-40,-44,42,123],blendMeters:40},walkable:[],viewCorridor:{localStartZ:20,localHalfWidthMeters:17},
 landing:{waterAnchor:[-8,5,13],widthScene:.36,walkPath:[[-8,5.022,13],[-6,5.065,12],[-4,5.135,11],[0,4.805,11]]}};
}
function environment(){
 const source=ground([-12,-10,12,25],(x,z)=>4.25+x*.04+z*.013,8,8),l=layout(),group=createDisplayEnvironment(l,{groundAt:(x,z)=>5+x*.08-z*.025,containsWater:(x,z)=>x<-4.8,sourceGround:source,low:true});
 const patch=group.children.find(o=>o.name.startsWith('continuous '));return{source,group,patch,surfaces:[source,patch],l};
}
test('actual generated display stones have area support at wet patch edges; all main roots are grounded and branches physically meet crowns',()=>{
 const {group,surfaces}=environment(),rocks=group.children.find(o=>o.name==='irregular weathered terrace stones'),trunks=group.children.find(o=>o.name==='varied branching trunks'),crowns=group.children.find(o=>o.name==='clustered crowns with open sightline'),matrix=new THREE.Matrix4();
 assert.ok(rocks.count>10);assert.equal(group.userData.propGrounding.fallbackSamples,0);assert.equal(group.userData.propGrounding.source,'final-source-and-support-mesh');
 for(let i=0;i<rocks.count;i++){rocks.getMatrixAt(i,matrix);for(const p of lowerBand(rocks.geometry,matrix,.32)){const g=actualGround(surfaces,p.x,p.z);assert.ok(g!==null);assert.ok(p.y-g<=-.0058,'rock '+i+' lower body floats by '+(p.y-g));}}
 for(let i=0;i<trunks.count/3;i++){
  const main=new THREE.Matrix4();trunks.getMatrixAt(i*3,main);for(const p of lowerBand(trunks.geometry,main,0))assert.ok(p.y-actualGround(surfaces,p.x,p.z)<=-.0038);
  const inverse=main.clone().invert();
  for(let j=1;j<3;j++){trunks.getMatrixAt(i*3+j,matrix);const start=new THREE.Vector3(0,-.5,0).applyMatrix4(matrix),end=new THREE.Vector3(0,.5,0).applyMatrix4(matrix),local=start.clone().applyMatrix4(inverse);assert.ok(Math.hypot(local.x,local.z)<.0001);assert.ok(local.y>-.5&&local.y<.5);
   const crownMatrix=new THREE.Matrix4();crowns.getMatrixAt(i*7+(j===1?2:5),crownMatrix);const localCrown=end.applyMatrix4(crownMatrix.clone().invert());assert.ok(localCrown.length()<.0001,'branch endpoint outside actual crown center');}
 }
 group.disposeInstances();
});
test('existing pier-post tops stay fixed while every lower cap extends into actual river bed',()=>{
 const {group,surfaces,l}=environment(),data=group.userData.pierGrounding;assert.ok(data.posts.length>12);assert.equal(data.legacyFallbacks,0);assert.equal(data.index.misses,0);
 for(const post of data.posts){assert.ok(post.topY>=5.022+.094-1e-10);assert.ok(post.topY<=5.135+.094+1e-10);assert.ok(post.bottomY<=post.surfaceMinimumY-.01+1e-10);
  for(let j=0;j<6;j++){const a=j*Math.PI/3,x=post.x+Math.sin(a)*.0075,z=post.z+Math.cos(a)*.0075,g=actualGround(surfaces,x,z);assert.ok(g!==null);assert.ok(post.bottomY-g<=-.0099,'pier base is suspended above actual bed');}
 }
 assert.deepEqual(l.landing.walkPath,[[-8,5.022,13],[-6,5.065,12],[-4,5.135,11],[0,4.805,11]]);group.disposeInstances();
});
test('missing actual bed fails explicitly instead of substituting water level or analytic DEM',()=>{
 const source=ground([-1,-1,1,1],()=>4),l=layout();assert.throws(()=>createDisplayEnvironment(l,{groundAt:()=>5,containsWater:(x,z)=>x<-4.8,sourceGround:source,low:true}),/No actual river bed/);
});

test('top-area exposure distinguishes a buried rock from a supported visible rock, using actual geometry',()=>{
 const source=ground([-1,-1,1,1],()=>0,2,2),sampler=createPropGroundSampler([source],{minX:-1,minZ:-1,maxX:1,maxZ:1}),g=new THREE.IcosahedronGeometry(1,1),matrix=new THREE.Matrix4().makeScale(.2,.1,.15);matrix.elements[13]=-.3;
 const buried=measurePropExposure(g,matrix,(x,z)=>sampler.sample(x,z));assert.ok(buried.sampleCount>50);assert.equal(buried.visibleFraction,0);assert.ok(buried.maximumTopGapScene<0);
 matrix.elements[13]=0;const fit=fitPropToGround(g,matrix,(x,z)=>sampler.sample(x,z));matrix.elements[13]=fit.translationY;const visible=measurePropExposure(g,matrix,(x,z)=>sampler.sample(x,z));assert.ok(visible.visibleFraction>.3);assert.ok(visible.maximumTopGapScene>.025);assert.equal(visible.missingSamples,0);
 for(const p of lowerBand(g,matrix,.32))assert.ok(p.y-actualGround([source],p.x,p.z)<=-.0079);sampler.dispose();
});
