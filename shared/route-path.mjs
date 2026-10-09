/** Piecewise linear path: never shortcut a source-plan corner between observation nodes. */
export function measurePath(points) {
  if(points.length<2||points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw new Error('Invalid route points');
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(...points[i].map((v,j)=>v-points[i-1][j])));
  if(distances.at(-1)<=0)throw new Error('Empty route');return distances;
}
export function pointOnPath(points,distances,distance){
  const d=Math.max(0,Math.min(distances.at(-1),distance));let i=1;while(i<distances.length-1&&distances[i]<d)i++;
  const t=(d-distances[i-1])/(distances[i]-distances[i-1]||1);return points[i-1].map((v,j)=>v+(points[i][j]-v)*t);
}
export function advancePath(current,target,deltaSeconds,speed=2.2){
  return current+Math.sign(target-current)*Math.min(Math.abs(target-current),Math.max(0,deltaSeconds)*speed);
}
