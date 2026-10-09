import * as THREE from 'three';
/** Exact triangle/attribute clipping of a rectangular replacement volume. Source files are never mutated. */
export function subtractBox(root:THREE.Object3D,reference:THREE.Matrix4,min:readonly number[],max:readonly number[]){
 const inverse=reference.clone().invert();root.updateWorldMatrix(true,true);let removed=0;
 root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;const old=mesh.geometry,pos=old.getAttribute('position');if(!pos)return;
 const toLocal=inverse.clone().multiply(mesh.matrixWorld);old.computeBoundingBox();const box=old.boundingBox!.clone().applyMatrix4(toLocal);
 if(box.max.x<min[0]||box.min.x>max[0]||box.max.y<min[1]||box.min.y>max[1]||box.max.z<min[2]||box.min.z>max[2])return;
 const names=Object.keys(old.attributes),attrs=names.map(n=>old.getAttribute(n)),sizes=attrs.map(a=>a.itemSize),offsets:number[]=[];let stride=0;for(const n of sizes){offsets.push(stride);stride+=n;}
 type V={p:THREE.Vector3;a:number[]};const vertex=(i:number):V=>({p:new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(toLocal),a:attrs.flatMap(a=>Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j)))});
 const mix=(a:V,b:V,t:number):V=>({p:a.p.clone().lerp(b.p,t),a:a.a.map((v,i)=>v+(b.a[i]-v)*t)}),area=(vs:V[])=>{let a=0;for(let i=1;i+1<vs.length;i++)a+=vs[i].p.clone().sub(vs[0].p).cross(vs[i+1].p.clone().sub(vs[0].p)).length();return a;};
 const out=names.map(()=>[] as number[]),groups:{start:number;count:number;materialIndex:number}[]=[];let count=0,changed=false;
 const distances=(v:V)=>[v.p.x-min[0],max[0]-v.p.x,v.p.y-min[1],max[1]-v.p.y,v.p.z-min[2],max[2]-v.p.z];
 const total=old.index?.count??pos.count;
 for(let i=0;i<total;i+=3){const tri=[0,1,2].map(j=>vertex(old.index?.getX(i+j)??i+j));let keep:V[][]=[tri];
 if(![0,1,2,3,4,5].some(e=>tri.every(v=>distances(v)[e]<-1e-8))){let left=tri;const outside:V[][]=[];
  for(let e=0;e<6&&left.length;e++){const inner:V[]=[],outer:V[]=[];for(let j=0;j<left.length;j++){const a=left[j],b=left[(j+1)%left.length],da=distances(a)[e],db=distances(b)[e],ai=da>=0,bi=db>=0;(ai?inner:outer).push(a);if(ai!==bi){const c=mix(a,b,da/(da-db));inner.push(c);outer.push(c);}}if(outer.length>=3)outside.push(outer);left=inner;}
  if(left.length>=3&&area(left)>1e-10){changed=true;removed++;keep=outside;}
 }
 const mat=old.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0;
 for(const poly of keep)for(let j=1;j+1<poly.length;j++){const t=[poly[0],poly[j],poly[j+1]];if(area(t)<1e-10)continue;
  if(groups.at(-1)?.materialIndex===mat)groups.at(-1)!.count+=3;else groups.push({start:count,count:3,materialIndex:mat});count+=3;
  for(const v of t)for(let k=0;k<attrs.length;k++)for(let c=0;c<sizes[k];c++)out[k].push(v.a[offsets[k]+c]);}
 }
 if(!changed)return;const g=new THREE.BufferGeometry();for(let k=0;k<names.length;k++)g.setAttribute(names[k],new THREE.Float32BufferAttribute(out[k],sizes[k]));for(const group of groups)g.addGroup(group.start,group.count,group.materialIndex);g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;old.dispose();if(!count)mesh.visible=false;
 });return removed;
}
export function connectionRamp(x:number,z0:number,z1:number,y0:number,y1:number,halfWidth:number){
 const g=new THREE.BufferGeometry(),p=[x-halfWidth,y0,z0,x+halfWidth,y0,z0,x-halfWidth,y1,z1,x+halfWidth,y1,z1,x-halfWidth,Math.min(y0,y1)-.8,z0,x+halfWidth,Math.min(y0,y1)-.8,z0,x-halfWidth,Math.min(y0,y1)-.8,z1,x+halfWidth,Math.min(y0,y1)-.8,z1];
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex([0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5]);g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#98998b',roughness:.96}));mesh.name='continuous artistic entry paving';mesh.receiveShadow=mesh.castShadow=true;return mesh;
}
