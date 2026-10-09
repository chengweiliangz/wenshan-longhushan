import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Original representative broadleaf shapes, not identified tree species or scanned plants. */
const random = (seed: number) => () => {
  seed = (Math.imul(1664525, seed) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
};
const up = new THREE.Vector3(0, 1, 0);

// A leafy twig with transparent gaps, generated here so no third-party texture is required.
export function createTwigMap() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!, r = random(7483);
  c.lineCap = 'round';
  const leaves: {x:number;y:number;angle:number}[] = [];
  for (let branch=0;branch<7;branch++) {
    const angle=-Math.PI + branch/6*Math.PI, startX=128+(r()-.5)*30,startY=160+(r()-.5)*25;
    const endX=128+Math.cos(angle)*(70+r()*20),endY=125+Math.sin(angle)*(62+r()*18);
    c.strokeStyle='#6a6450';c.lineWidth=1.7;c.beginPath();c.moveTo(startX,startY);c.lineTo(endX,endY);c.stroke();
    for(let i=0;i<12;i++) {
      const t=.12+i/13,x=startX+(endX-startX)*t,y=startY+(endY-startY)*t;
      const side=i%2?1:-1,phi=angle+side*.7;
      const offset=12+r()*14;
      leaves.push({x:x+Math.cos(phi)*offset,y:y+Math.sin(phi)*offset,angle:phi});
      c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(leaves.at(-1)!.x,leaves.at(-1)!.y);c.stroke();
    }
  }
  for (const point of leaves) {
    c.save();c.translate(point.x,point.y);c.rotate(point.angle);
    const length=26+r()*17,width=8+r()*5;
    c.fillStyle=`hsl(${87+r()*17}, ${25+r()*9}%, ${36+r()*10}%)`;
    c.beginPath();c.moveTo(-length*.44,0);
    c.bezierCurveTo(-length*.3,-width,length*.25,-width,length*.56,0);
    c.bezierCurveTo(length*.25,width,-length*.3,width,-length*.44,0);c.fill();
    c.strokeStyle='rgba(183,192,137,.42)';c.lineWidth=.6;
    c.beginPath();c.moveTo(-length*.42,0);c.lineTo(length*.5,0);c.stroke();c.restore();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4; return map;
}

export function createTreeShapes(variant: number) {
  const r = random(431 + variant * 379), wood: THREE.BufferGeometry[] = [], coarseWood: THREE.BufferGeometry[] = [];
  const branches: THREE.Vector3[] = [], tips: THREE.Vector3[] = [];
  const tube = (a: THREE.Vector3, b: THREE.Vector3, radius: number, endRadius: number, coarse = false) => {
    const g = new THREE.CylinderGeometry(endRadius, radius, a.distanceTo(b), coarse ? 5 : 6, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const p = g.getAttribute('position'), colors = [], color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      color.setHSL(.085, .16, .17 + .035 * Math.sin(p.getY(i) * 11 + p.getX(i) * 29));
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    (coarse ? coarseWood : wood).push(g);
  };
  const spine = [new THREE.Vector3(), new THREE.Vector3(.09, 2.8, -.05), new THREE.Vector3(-.1, 5.4, .13), new THREE.Vector3(.1, 8.9, -.05)];
  for (let i = 0; i < spine.length - 1; i++) {
    tube(spine[i], spine[i + 1], .21 - i * .055, .15 - i * .045);
    tube(spine[i], spine[i + 1], .21 - i * .055, .15 - i * .045, true);
  }
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.399 + variant * .7, height = 3.0 + i * .43;
    const reach = (3.25 - i * .085) * (.83 + r() * .27);
    const a = new THREE.Vector3(0, height, 0), b = new THREE.Vector3(Math.sin(angle) * reach * .46, height + 1.3, Math.cos(angle) * reach * .46);
    const end = new THREE.Vector3(Math.sin(angle) * reach, height + 2.0 + r() * .55, Math.cos(angle) * reach);
    tube(a, b, .095 - i * .004, .057); tube(b, end, .057, .02); tube(a, end, .073, .018, true);
    branches.push(end);
    for (let j = 0; j < 3; j++) {
      const phi = angle + (j - 1) * .8;
      const tip = end.clone().add(new THREE.Vector3(Math.sin(phi) * (.45 + r() * .45), .24 + r() * .48, Math.cos(phi) * (.45 + r() * .45)));
      tube(end, tip, .021, .006); tips.push(tip);
    }
  }
  tips.push(spine[3].clone().add(new THREE.Vector3(0,.5,0)));
  const merge = (parts: THREE.BufferGeometry[]) => { const result = mergeGeometries(parts); parts.forEach(g => g.dispose()); return result; };
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const color = new THREE.Color(), rotation = new THREE.Quaternion(), euler = new THREE.Euler();
  for (const tip of tips) for (let i = 0; i < 34; i++) {
    const angle = r() * Math.PI * 2, level = r() * 2 - 1, radius = Math.cbrt(r());
    const center = tip.clone().add(new THREE.Vector3(Math.cos(angle) * radius * 1.02, level * .75, Math.sin(angle) * radius * 1.02));
    const length = .38 + r() * .26, width = length * (.27 + r() * .1);
    euler.set((r() - .5) * 2.3, angle, (r() - .5) * 1.2); rotation.setFromEuler(euler);
    const base = positions.length / 3;
    for (const point of [[0,.025,0],[0,0,-.5],[.72,0,-.22],[1,0,.11],[0,-.015,.5],[-1,0,.11],[-.72,0,-.22]]) {
      const v = new THREE.Vector3(point[0] * width, point[1], point[2] * length).applyQuaternion(rotation).add(center);
      positions.push(v.x, v.y, v.z);
      const light = .36 + r() * .07 + (center.y - 5) * .005;
      color.setHSL(.235 + r() * .038, .25 + r() * .12, light).convertSRGBToLinear(); colors.push(color.r, color.g, color.b);
    }
    for(let j=1;j<=6;j++)indices.push(base,base+j,base+(j%6)+1);
  }
  const leaves = new THREE.BufferGeometry(); leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors,3)); leaves.setIndex(indices); leaves.computeVertexNormals();
  const cards = (centers: THREE.Vector3[], count: number, size: number) => {
    const parts: THREE.BufferGeometry[] = [];
    for (const tip of centers) for (let i = 0; i < count; i++) {
      const g = new THREE.PlaneGeometry(size * (.8 + r() * .3), size);
      g.rotateX(i===0?Math.PI/2:(r()-.5)*.6); g.rotateY(i/count*Math.PI+r()*.5);
      g.translate(tip.x + (r() - .5) * .55, tip.y + (r()-.5)*.7, tip.z + (r() - .5) * .55);
      const normals = g.getAttribute('normal'), p = g.getAttribute('position'), col = [];
      for (let j = 0; j < p.count; j++) {
        const normal = new THREE.Vector3(p.getX(j) * .12, .75, p.getZ(j) * .12).normalize(); normals.setXYZ(j,normal.x,normal.y,normal.z);
        const shade = .77 + r() * .2; col.push(shade, shade, shade);
      }
      g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); parts.push(g);
    }
    return merge(parts);
  };
  return {near:{wood:merge(wood),leaves},mid:{wood:merge(coarseWood),leaves:cards(tips,3,2.05)},far:{leaves:cards(branches.concat([spine[3]]),4,2.8)}};
}

export function createTwigMaterial(map:THREE.Texture) {
 const material=new THREE.MeshStandardMaterial({map,vertexColors:true,alphaTest:.4,side:THREE.DoubleSide,roughness:.95});
 // The card normals represent the crown volume. Keep them outward on both sides of a card.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= faceDirection;');};
 material.customProgramCacheKey=()=> 'outward-canopy-normal-v1';
 return material;
}
