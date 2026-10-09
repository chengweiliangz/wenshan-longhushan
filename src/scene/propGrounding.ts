import * as THREE from 'three';
export type GroundingBounds={minX:number;minZ:number;maxX:number;maxZ:number};
type Triangle={ax:number;az:number;ay:number;bx:number;bz:number;by:number;cx:number;cz:number;cy:number;den:number};
export type PropGroundSampler={sample:(x:number,z:number)=>number|null;dispose:()=>void;getStats:()=>{triangles:number;cells:number;samples:number;misses:number}};
/** Temporary build-time XZ triangle index. It never edits visible surfaces or attaches resources to them. */
export function createPropGroundSampler(surfaces:readonly THREE.Object3D[],bounds:GroundingBounds,cellSize=.08):PropGroundSampler{
 if(![bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ,cellSize].every(Number.isFinite)||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ||cellSize<=0)throw new Error('Invalid prop grounding bounds');
 const triangles:Triangle[]=[],cells=new Map<string,number[]>(),stats={triangles:0,cells:0,samples:0,misses:0};let disposed=false;
 const key=(i:number,j:number)=>i+','+j,seen=new Set<THREE.Mesh>();
 for(const root of surfaces){root.updateWorldMatrix(true,true);root.traverse(object=>{
  const mesh=object as THREE.Mesh;if(!mesh.isMesh||(mesh as THREE.InstancedMesh).isInstancedMesh||seen.has(mesh))return;seen.add(mesh);
  for(let o:THREE.Object3D|null=mesh;o;o=o.parent)if(!o.visible)return;
  const g=mesh.geometry,p=g.getAttribute('position');if(!p)return;
  const box=new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
  if(box.max.x<bounds.minX||box.min.x>bounds.maxX||box.max.z<bounds.minZ||box.min.z>bounds.maxZ)return;
  const transformed=new Float64Array(p.count*3),point=new THREE.Vector3();
  for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);transformed[i*3]=point.x;transformed[i*3+1]=point.y;transformed[i*3+2]=point.z;}
  const count=g.index?.count??p.count,start=Math.max(0,g.drawRange.start),end=Math.min(count,start+g.drawRange.count);
  for(let i=start;i+2<end;i+=3){
   const a=(g.index?.getX(i)??i)*3,b=(g.index?.getX(i+1)??i+1)*3,c=(g.index?.getX(i+2)??i+2)*3;
   const t:Triangle={ax:transformed[a],ay:transformed[a+1],az:transformed[a+2],bx:transformed[b],by:transformed[b+1],bz:transformed[b+2],cx:transformed[c],cy:transformed[c+1],cz:transformed[c+2],den:0};
   t.den=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);if(Math.abs(t.den)<1e-14)continue;
   const material=Array.isArray(mesh.material)?mesh.material[g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex??0]:mesh.material;
   if(material&&!material.visible)continue;
   // A downward ray sees upward front faces, downward back faces, and both sides of DoubleSide.
   const normalY=(t.bz-t.az)*(t.cx-t.ax)-(t.bx-t.ax)*(t.cz-t.az);
   if(material?.side===THREE.FrontSide&&normalY<0||material?.side===THREE.BackSide&&normalY>0)continue;
   const minX=Math.max(bounds.minX,Math.min(t.ax,t.bx,t.cx)),maxX=Math.min(bounds.maxX,Math.max(t.ax,t.bx,t.cx)),minZ=Math.max(bounds.minZ,Math.min(t.az,t.bz,t.cz)),maxZ=Math.min(bounds.maxZ,Math.max(t.az,t.bz,t.cz));
   if(minX>maxX||minZ>maxZ)continue;
   const index=triangles.push(t)-1;
   for(let z=Math.floor((minZ-bounds.minZ)/cellSize);z<=Math.floor((maxZ-bounds.minZ)/cellSize);z++)for(let x=Math.floor((minX-bounds.minX)/cellSize);x<=Math.floor((maxX-bounds.minX)/cellSize);x++){const k=key(x,z),bucket=cells.get(k);if(bucket)bucket.push(index);else cells.set(k,[index]);}
  }
 });}
 stats.triangles=triangles.length;stats.cells=cells.size;
 return{sample(x,z){
  if(disposed)throw new Error('Prop ground sampler already disposed');stats.samples++;
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<bounds.minX||x>bounds.maxX||z<bounds.minZ||z>bounds.maxZ){stats.misses++;return null;}
  const bucket=cells.get(key(Math.floor((x-bounds.minX)/cellSize),Math.floor((z-bounds.minZ)/cellSize)));let height:number|null=null;
  for(const index of bucket??[]){const t=triangles[index],a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/t.den,b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/t.den,c=1-a-b;if(a>=-1e-9&&b>=-1e-9&&c>=-1e-9){const y=a*t.ay+b*t.by+c*t.cy;if(height===null||y>height)height=y;}}
  if(height===null)stats.misses++;return height;
 },getStats:()=>({...stats}),dispose(){if(disposed)return;disposed=true;triangles.length=0;cells.clear();seen.clear();}};
}
export type PropGroundingOptions={baseFraction?:number;embedScene?:number;sampleSpacingScene?:number};
export type PropGroundingResult={translationY:number;baseMinY:number;baseCutoffY:number;sampleCount:number;missingSamples:number;maximumBaseGapScene:number;minimumBaseGapScene:number;embedScene:number};
/** Clips actual downward faces to the lower body band, then samples their full area.
 * Fit changes world Y only; caller retains its exact XZ, rotation and scale.
 * Rounded upper overhangs remain visible; the supporting lower body is embedded.
 */
export function fitPropToGround(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4,sampleGround:(x:number,z:number)=>number|null,options:PropGroundingOptions={}):PropGroundingResult{
 const fraction=options.baseFraction??.32,embed=options.embedScene??.008,spacing=options.sampleSpacingScene??.04;
 if(![fraction,embed,spacing].every(Number.isFinite)||fraction<0||fraction>1||embed<0||spacing<=0)throw new Error('Invalid prop grounding dimensions');
 const attribute=geometry.getAttribute('position');if(!attribute?.count)throw new Error('Prop grounding needs position geometry');
 const vertices:THREE.Vector3[]=[],point=new THREE.Vector3();let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<attribute.count;i++){point.fromBufferAttribute(attribute,i).applyMatrix4(matrix);vertices.push(point.clone());minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
 const cutoff=minY+(maxY-minY)*fraction,samples:THREE.Vector3[]=[],unique=new Set<string>();
 const add=(p:THREE.Vector3)=>{const k=[p.x,p.y,p.z].map(v=>Math.round(v*1e7)).join(',');if(!unique.has(k)){unique.add(k);samples.push(p);}};
 for(const p of vertices)if(p.y<=cutoff+1e-9)add(p);
 const count=geometry.index?.count??attribute.count;
 for(let i=0;i+2<count;i+=3){
  const tri=[0,1,2].map(j=>vertices[geometry.index?.getX(i+j)??i+j]);
  const normal=new THREE.Vector3().subVectors(tri[1],tri[0]).cross(new THREE.Vector3().subVectors(tri[2],tri[0]));if(normal.y>=-1e-12)continue;
  const polygon:THREE.Vector3[]=[];
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],insideA=a.y<=cutoff+1e-10,insideB=b.y<=cutoff+1e-10;if(insideA)polygon.push(a);if(insideA!==insideB)polygon.push(a.clone().lerp(b,(cutoff-a.y)/(b.y-a.y)));}
  for(const p of polygon)add(p);
  for(let j=1;j+1<polygon.length;j++){
   const [a,b,c]=[polygon[0],polygon[j],polygon[j+1]],length=Math.max(Math.hypot(a.x-b.x,a.z-b.z),Math.hypot(a.x-c.x,a.z-c.z),Math.hypot(b.x-c.x,b.z-c.z)),n=Math.max(1,Math.min(12,Math.ceil(length/spacing)));
   for(let u=0;u<=n;u++)for(let v=0;v<=n-u;v++)add(a.clone().multiplyScalar(1-(u+v)/n).addScaledVector(b,u/n).addScaledVector(c,v/n));
   add(a.clone().add(b).add(c).multiplyScalar(1/3));
  }
 }
 let translation=Infinity,misses=0;const supported:{p:THREE.Vector3;ground:number}[]=[];
 for(const p of samples){const ground=sampleGround(p.x,p.z);if(ground===null||!Number.isFinite(ground)){misses++;continue;}supported.push({p,ground});translation=Math.min(translation,ground-p.y-embed);}
 if(!supported.length)throw new Error('No visible ground beneath prop footprint');
 let maximum=-Infinity,minimum=Infinity;for(const {p,ground} of supported){const gap=p.y+translation-ground;maximum=Math.max(maximum,gap);minimum=Math.min(minimum,gap);}
 return{translationY:translation,baseMinY:minY,baseCutoffY:cutoff,sampleCount:supported.length,missingSamples:misses,maximumBaseGapScene:maximum,minimumBaseGapScene:minimum,embedScene:embed};
}

export type PropExposure={sampleCount:number;missingSamples:number;visibleSamples:number;visibleFraction:number;maximumTopGapScene:number};
/** Build-time projected top-surface area check. Independent audits use their own grid/ray method. */
export function measurePropExposure(geometry:THREE.BufferGeometry,matrix:THREE.Matrix4,sampleGround:(x:number,z:number)=>number|null,spacingScene=.0125):PropExposure{
 const position=geometry.getAttribute('position'),vertices=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix)),box=new THREE.Box3().setFromPoints(vertices),faces:Triangle[]=[],count=geometry.index?.count??position.count;
 for(let i=0;i<count;i+=3){const [a,b,c]=[0,1,2].map(j=>vertices[geometry.index?.getX(i+j)??i+j]),normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.y<=1e-12)continue;const t:Triangle={ax:a.x,ay:a.y,az:a.z,bx:b.x,by:b.y,bz:b.z,cx:c.x,cy:c.y,cz:c.z,den:(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z)};if(Math.abs(t.den)>1e-14)faces.push(t);}
 let samples=0,missing=0,visible=0,maximum=-Infinity;
 for(let z=box.min.z+spacingScene*.5;z<box.max.z;z+=spacingScene)for(let x=box.min.x+spacingScene*.5;x<box.max.x;x+=spacingScene){
  let top:number|null=null;for(const t of faces){const a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/t.den,b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/t.den,c=1-a-b;if(a>=-1e-10&&b>=-1e-10&&c>=-1e-10){const y=a*t.ay+b*t.by+c*t.cy;if(top===null||y>top)top=y;}}
  if(top===null)continue;const ground=sampleGround(x,z);if(ground===null||!Number.isFinite(ground)){missing++;continue;}samples++;const gap=top-ground;maximum=Math.max(maximum,gap);if(gap>.002)visible++;
 }
 return{sampleCount:samples,missingSamples:missing,visibleSamples:visible,visibleFraction:samples?visible/samples:0,maximumTopGapScene:maximum};
}
