/** Static water height from the exact Float32 triangle mesh rendered by riverFlow.
 * A spatial index keeps the few hull probes independent of the total river mesh size.
 * Waves are handled separately as the controller's conservative crest clearance.
 */
export function createRaftWaterSurfaceSampler(positions:ArrayLike<number>,indices:ArrayLike<number>,cellScene=2) {
  if(positions.length%3||indices.length%3||!(cellScene>0)||!Number.isFinite(cellScene))throw new Error('Invalid raft water mesh');
  type Triangle={ax:number;az:number;ay:number;bx:number;bz:number;by:number;cx:number;cz:number;cy:number;den:number};
  const buckets=new Map<string,Triangle[]>();let triangleCount=0,probes=0,misses=0;
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const t:Triangle={ax:positions[a],ay:positions[a+1],az:positions[a+2],bx:positions[b],by:positions[b+1],bz:positions[b+2],cx:positions[c],cy:positions[c+1],cz:positions[c+2],den:0};
    if(!Object.values(t).every(Number.isFinite))throw new Error('Nonfinite raft water triangle');
    t.den=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);if(Math.abs(t.den)<1e-12)continue;triangleCount++;
    for(let x=Math.floor(Math.min(t.ax,t.bx,t.cx)/cellScene);x<=Math.floor(Math.max(t.ax,t.bx,t.cx)/cellScene);x++)for(let z=Math.floor(Math.min(t.az,t.bz,t.cz)/cellScene);z<=Math.floor(Math.max(t.az,t.bz,t.cz)/cellScene);z++){
      const key=x+':'+z,items=buckets.get(key);if(items)items.push(t);else buckets.set(key,[t]);
    }
  }
  return {
    footprint(polygon:readonly {x:number;z:number}[]):{x:number;y:number;z:number}[]{
      const found=new Set<Triangle>(),out:{x:number;y:number;z:number}[]=[];
      const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.z-q.x*p.z;},0),sign=area>=0?1:-1;
      for(let x=Math.floor(Math.min(...polygon.map(p=>p.x))/cellScene);x<=Math.floor(Math.max(...polygon.map(p=>p.x))/cellScene);x++)for(let z=Math.floor(Math.min(...polygon.map(p=>p.z))/cellScene);z<=Math.floor(Math.max(...polygon.map(p=>p.z))/cellScene);z++)for(const t of buckets.get(x+':'+z)??[])found.add(t);
      for(const t of found){let clipped=[{x:t.ax,y:t.ay,z:t.az},{x:t.bx,y:t.by,z:t.bz},{x:t.cx,y:t.cy,z:t.cz}];
        for(let i=0;i<polygon.length&&clipped.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],side=(p:{x:number;z:number})=>sign*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x)),next:typeof clipped=[];
          for(let j=0;j<clipped.length;j++){const p=clipped[j],q=clipped[(j+1)%clipped.length],dp=side(p),dq=side(q),pin=dp>=-1e-10,qin=dq>=-1e-10;if(pin)next.push(p);if(pin!==qin){const u=dp/(dp-dq);next.push({x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u,z:p.z+(q.z-p.z)*u});}}
          clipped=next;
        }out.push(...clipped);
      }return out;
    },
    sample(x:number,z:number):number|null {
      if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error('Invalid raft water probe');probes++;
      for(const t of buckets.get(Math.floor(x/cellScene)+':'+Math.floor(z/cellScene))??[]){
        const u=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/t.den,v=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/t.den,w=1-u-v;
        if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7&&u<=1+1e-7&&v<=1+1e-7&&w<=1+1e-7)return u*t.ay+v*t.by+w*t.cy;
      }
      misses++;return null;
    },
    stats(){return{triangles:triangleCount,buckets:buckets.size,probes,misses};},
    dispose(){buckets.clear();},
  };
}
