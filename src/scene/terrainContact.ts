import * as THREE from 'three';

/** One-shot placement against the final indexed display mesh, including its
 * shoreline grading and triangulation. Never resamples or modifies the DEM.
 * Recreate the sampler if terrain geometry or its world transform changes. */
export function createTerrainContactSampler(terrain:THREE.Object3D){
 terrain.updateWorldMatrix(true,true);
 const entries:{mesh:THREE.Mesh;box:THREE.Box3}[]=[],bounds=new THREE.Box3();
 terrain.traverse(object=>{
  const mesh=object as THREE.Mesh;
  if(!mesh.isMesh||!mesh.geometry.getAttribute('position'))return;
  // Keep bounds local to this temporary sampler; do not alter terrain buffers
  // or attach acceleration structures/resources to production geometry.
  const box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
  entries.push({mesh,box});bounds.union(box);
 });
 if(!entries.length)throw new Error('Tree contact requires a displayed terrain mesh');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),origin=new THREE.Vector3(),candidates:THREE.Object3D[]=[],hits:THREE.Intersection[]=[];
 const stats={samples:0,misses:0,minShiftMeters:Infinity,maxShiftMeters:-Infinity,maxAbsoluteShiftMeters:0};
 let disposed=false;
 return {
  /** The canopy stores metre-space matrices in Float32 and scales its group
   * by 0.1. Query the exact eventual instance XZ, but return original XZ.
   * For an origin-translated group, pass its already transformed Float32 local
   * XZ with quantizeInstanceXZ=false; do not round the global origin again. */
  place(point:THREE.Vector3,instanceUnitsPerSceneUnit=10,quantizeInstanceXZ=true){
   if(disposed)throw new Error('Tree contact sampler already disposed');
   const x=quantizeInstanceXZ?Math.fround(point.x*instanceUnitsPerSceneUnit)/instanceUnitsPerSceneUnit:point.x,z=quantizeInstanceXZ?Math.fround(point.z*instanceUnitsPerSceneUnit)/instanceUnitsPerSceneUnit:point.z;
   candidates.length=0;hits.length=0;
   for(const {mesh,box} of entries)if(x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z)candidates.push(mesh);
   ray.set(origin.set(x,bounds.max.y+1,z),down);ray.near=0;ray.far=bounds.max.y-bounds.min.y+2;
   ray.intersectObjects(candidates,false,hits);stats.samples++;
   const hit=hits[0];
   if(!hit){stats.misses++;throw new Error(`No displayed terrain below source tree at ${x},${z}`);}
   const shift=(hit.point.y-point.y)*instanceUnitsPerSceneUnit;
   stats.minShiftMeters=Math.min(stats.minShiftMeters,shift);stats.maxShiftMeters=Math.max(stats.maxShiftMeters,shift);stats.maxAbsoluteShiftMeters=Math.max(stats.maxAbsoluteShiftMeters,Math.abs(shift));
   point.y=hit.point.y;return point;
  },
  getStats(){return {...stats};},
  dispose(){if(disposed)return;disposed=true;entries.length=0;candidates.length=0;hits.length=0;},
 };
}
