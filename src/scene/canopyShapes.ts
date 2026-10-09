import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createTreeShapes} from './treeGeometry';

// Authored representative foliage, not measured crowns. All shapes stay within
// the input radius and height after the existing radius/4, height/10 transform.
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
// Mirror only the existing authored branch-end RNG sequence. This attaches
// leaf sprays to real source branch tips instead of unrelated height layers.
const branchEnds=(variant:number)=>{
 const r=rng(431+variant*379),result:{x:number;y:number;z:number;angle:number}[]=[];
 for(let i=0;i<11;i++){
  const angle=i*2.399+variant*.7,reach=(3.25-i*.085)*(.83+r()*.27),y=3+i*.43+2+r()*.55;
  result.push({x:Math.sin(angle)*reach,y,z:Math.cos(angle)*reach,angle});
  for(let j=0;j<9;j++)r(); // Three existing twigs, each consumes x/y/z jitter.
 }
 return result;
};
function sourceShape(variant:number){
 const source=createTreeShapes(variant);let radius=0,height=0;
 for(const g of [source.near.wood,source.near.leaves]){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));height=Math.max(height,p.getY(i));}}
 return {source,sx:4/radius,sy:10/height};
}
const clusterLobes=(variant:number)=>{
 const r=rng(5107+variant*47),result=[{x:0,y:0,rx:.55,ry:.5}];
 for(let i=0;i<7;i++){const a=i*2.399+variant*.43;result.push({x:Math.cos(a)*(.32+r()*.17),y:Math.sin(a)*(.30+r()*.17),rx:.32+r()*.12,ry:.25+r()*.10});}
 return result;
};
const hash=(x:number,y:number,seed:number)=>{let n=Math.imul(x+seed,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};

/** A 512x256 atlas: four centered branch sprays below four whole crowns.
 * Small sprays use centered UV coverage; they no longer reuse a complete
 * tree silhouette concentrated in the upper half of a card. */
export function createCanopyAtlas(){
 const width=512,height=256,tile=128,pixels=new Uint8Array(width*height*4);
 for(let variant=0;variant<4;variant++){
  const {source,sx,sy}=sourceShape(variant),ends=branchEnds(variant);
  for(const parts of Object.values(source))for(const g of Object.values(parts))g.dispose();
  for(let kind=0;kind<2;kind++){
   const shapes=kind?ends.map(p=>({x:p.x*sx,y:p.y*sy,rx:1.48*sx,ry:1.2*sy})):clusterLobes(variant);
   for(let y=3;y<tile-3;y++)for(let x=3;x<tile-3;x++){
   const px=(x/(tile-1)-.5)*(kind?8:2),py=kind?y/(tile-1)*8+2:(y/(tile-1)-.5)*2;
   let density=-10;
   for(const l of shapes){const q=((px-l.x)/l.rx)**2+((py-l.y)/l.ry)**2;density=Math.max(density,1-q);}
   const coarse=hash(Math.floor(x/5),Math.floor(y/5),variant+47),fine=hash(x,y,variant+19);
   const alpha=density>.06+(coarse-.5)*.20&&(density>.40||fine>.15)?255:0;
   const shade=.84+.13*y/tile+(fine-.5)*.10,i=((kind*tile+y)*width+variant*tile+x)*4;
   pixels[i]=Math.round(117*shade);pixels[i+1]=Math.round(139*shade);pixels[i+2]=Math.round(91*shade);pixels[i+3]=alpha;
   }
  }
 }
 const map=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;map.anisotropy=4;
 return map;
}

function cards(variant:number,whole:boolean,sx:number,sy:number){
 const parts:THREE.BufferGeometry[]=[],r=rng(3851+variant*117);
 const centers=whole?[{x:0,y:6,z:0,angle:variant*.31}]:branchEnds(variant).map(p=>({...p,x:p.x*sx,y:p.y*sy,z:p.z*sx}));
 for(const center of centers){const count=whole?4:3;
  for(let i=0;i<count;i++){
   const w=whole?8:(3.1+r()*.3)*sx,h=whole?8:(2.5+r()*.25)*sy;
   const g=new THREE.PlaneGeometry(w,h,1,whole?1:2),position=g.getAttribute('position');
   // A shallow fold adds depth to small sprays. Every card stays upright or
   // oblique; the v1 level horizontal discs are removed entirely.
   for(let j=0;j<position.count;j++){
    const t=position.getY(j)/h*2;
    position.setZ(j,whole?position.getX(j)*t*.025:(1-t*t)*w*.075*(i%2?1:-1));
   }
   g.rotateX((i%2?-1:1)*(.16+r()*.28));
   g.rotateY(center.angle+i*2.399+(r()-.5)*.18);
   g.translate(center.x,center.y,center.z);
   const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv'),colors:number[]=[];
   for(let j=0;j<p.count;j++){
    const x=p.getX(j),z=p.getZ(j),scale=Math.min(1,4/Math.max(.001,Math.hypot(x,z)));
    p.setXYZ(j,x*scale,THREE.MathUtils.clamp(p.getY(j),2,10),z*scale);
    const normal=new THREE.Vector3(x*.16,.72,z*.16).normalize();n.setXYZ(j,normal.x,normal.y,normal.z);
    uv.setXY(j,(variant+.025+uv.getX(j)*.95)*.25,((whole?1:0)+.025+uv.getY(j)*.95)*.5);
    const shade=.86+r()*.16;colors.push(shade,shade,shade);
   }
   g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(g);
  }
 }
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function createCanopyShapes(variant:number){
 const {source,sx,sy}=sourceShape(variant);
 // Keep detailed authored branches and leaves close up. Unused source twig
 // cards are disposed; all retained branches/leaves share one normalization.
 // This preserves their spatial relationship instead of clamping leaf tips.
 source.mid.leaves.dispose();source.far.leaves.dispose();
 for(const g of [source.near.wood,source.near.leaves,source.mid.wood]){
  const p=g.getAttribute('position'),n=g.getAttribute('normal');for(let i=0;i<p.count;i++){
   p.setXYZ(i,p.getX(i)*sx,p.getY(i)*sy,p.getZ(i)*sx);
   if(n){const normal=new THREE.Vector3(n.getX(i)/sx,n.getY(i)/sy,n.getZ(i)/sx).normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}
  }g.computeBoundingSphere();
 }
 const farWood=new THREE.CylinderGeometry(.04,.19,5,3,1,true);farWood.translate(0,2.5,0);
 const count=farWood.getAttribute('position').count;
 farWood.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:count},()=>[.11,.095,.072]).flat(),3));
 return {near:{wood:source.near.wood,leaves:source.near.leaves,fill:cards(variant,false,sx,sy)},mid:{wood:source.mid.wood,fill:cards(variant,false,sx,sy)},far:{wood:farWood,fill:cards(variant,true,sx,sy)}};
}
