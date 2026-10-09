import {terrainElevation,type Terrain as DEM} from './nativeTerrain';
import * as THREE from 'three';
import {siteGroundHeight} from '../../shared/site-ground.mjs';
import {geoToWorld,worldToGeo,worldToModelLocal} from '../../shared/geography.mjs';
import {placeAssets} from '../../shared/catalog.mjs';

/** A local view of the same source DEM and geographic frame as the regional scene.
 * Elevation is approximate; only the visible building platform is levelled. */
export function createSiteContext(d:DEM,geo:typeof placeAssets.shangqing.geo|typeof placeAssets.zhengyi.geo|typeof placeAssets.tianshi.geo=placeAssets.shangqing.geo,spotId="shangqing"){
 const [originX,originZ]=geoToWorld(geo.coordinates),originY=geo.elevation.meters;
 const sample=(lon:number,lat:number)=>terrainElevation(d,lon,lat);
 const group=new THREE.Group(),positions:number[]=[],colors:number[]=[],indices:number[]=[],n=spotId==='tianshi'?256:128,extent=spotId==='tianshi'?520:260;
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const wx=(x/n-.5)*extent*2,wz=(y/n-.5)*extent*2,[lon,lat]=worldToGeo([originX+wx,originZ+wz]);let elevation=sample(lon,lat);const local=worldToModelLocal([originX+wx,elevation,originZ+wz],geo),edge=Math.max(Math.abs(local[0])/45,Math.abs(local[2])/54);elevation=originY+siteGroundHeight(local[0],local[2],elevation-originY,spotId);positions.push(wx,elevation-originY,wz);
  const c=new THREE.Color('#637757');c.multiplyScalar(.95+.04*Math.sin(wx*.13)*Math.sin(wz*.1));if(edge<1.4)c.lerp(new THREE.Color('#b3ae93'),(1-THREE.MathUtils.smoothstep(edge,1,1.4))*.5);colors.push(c.r,c.g,c.b);
  if(x<n&&y<n){const i=y*(n+1)+x;indices.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;group.add(ground);group.name='Local source DEM; no surveyed micro-topography';return group;
}
