import { createRiverFollowDirection } from './riverFollowDirection';
import { planRaftJourney, sampleRaftJourney, type RaftJourneyMotion, type RaftTravelOptions } from './raftJourney';
export { RAFT_JOURNEY, type RaftTravelOptions, type RaftJourneyMotion } from './raftJourney';

/** Display estimates in physical metres. Scene coordinates use 1 unit = 10 m. */
export const RAFT_RIDE = Object.freeze({
  sceneMeters: 10, cruiseMetersPerSecond: .65, eyeAboveWaterMeters: 1.2,
  deckAboveWaterMeters: .17, widthMeters: 2.2, lengthMeters: 5.8,
  nearScene: .015, seatBehindCenterMeters: .4, lookAheadMeters: 4,
  maxHeaveMeters: .006, maxRollRadians: .0015,
});
export type RaftPoint = { readonly x: number; readonly y: number; readonly z: number };
export type RaftRideSnapshot = {
  travelMeters: number; chainageMeters: number; routeStartMeters: number; routeEndMeters: number;
  yaw: number; pitch: number; userPaused: boolean; suspended: boolean; reducedMotion: boolean;
  atEnd: boolean; paused: boolean; speedMetersPerSecond: number; manualLook: boolean;
  targetTravelMeters: number | null; journeyPhase: 'cruising' | 'travelling' | 'arrived';
  journeyId: string | null; arrived: boolean; journeyElapsedSeconds: number; journeyDurationSeconds: number;
  velocityMetersPerSecond: number; accelerationMetersPerSecondSquared: number;
  swayTime: number; poseReducedMotion: boolean; journeySerial: number; journeyMotion: RaftJourneyMotion | null;
  routeFingerprint: string;
};
export type RaftRideRouteOptions = {
  headingWindowMeters?: number;
  surfaceAt?: (x:number,z:number)=>number;
  surfaceFootprint?: (polygon:readonly {x:number;z:number}[])=>readonly RaftPoint[];
  observation?: {startMeters:number;endMeters:number;target:RaftPoint};
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const shortest = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));

/** Positions stay on the sourced polyline. Only heading is smoothly anticipated. */
export function measureRaftRidePath(points:readonly RaftPoint[]) {
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)!+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z)*RAFT_RIDE.sceneMeters);return distances;
}
export function createRaftRideRoute(points: readonly RaftPoint[], distances: readonly number[], startMeters: number, endMeters: number, options:RaftRideRouteOptions={}) {
  const follow = createRiverFollowDirection(points, distances, 9);
  let hash=2166136261;
  const routeSource=JSON.stringify([points.map(p=>[p.x,p.y,p.z]),distances,startMeters,endMeters,options.headingWindowMeters,options.observation]);
  for(let i=0;i<routeSource.length;i++)hash=Math.imul(hash^routeSource.charCodeAt(i),16777619)>>>0;
  const fingerprint=hash.toString(16);
  if(points.some(p=>!Number.isFinite(p.y)))throw new Error('Invalid raft route height');
  if (!Number.isFinite(startMeters) || !Number.isFinite(endMeters) || startMeters < distances[0] || endMeters > distances.at(-1)! || endMeters <= startMeters) throw new Error('Invalid safe raft interval');
  function positionAt(chainage:number){
    if (!Number.isFinite(chainage)) throw new Error('Invalid raft chainage');
    const s = clamp(chainage, startMeters, endMeters);
    let lo = 0, hi = distances.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (distances[mid] <= s) lo = mid; else hi = mid; }
    const t = (s - distances[lo]) / (distances[hi] - distances[lo]), a = points[lo], b = points[hi];
    return{s,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
  }
  function headingAt(s:number){
    if(options.headingWindowMeters){const half=options.headingWindowMeters/2,a=positionAt(s-half),b=positionAt(s+half);return Math.atan2(b.x-a.x,b.z-a.z);}
    const d=follow.sample(s,{x:0,z:0});return Math.atan2(d.x,d.z);
  }
  function sample(chainage:number){
    const p=positionAt(chainage),lookHeading=headingAt(Math.min(endMeters,p.s+RAFT_RIDE.lookAheadMeters));let observationYaw=0;
    const o=options.observation;if(o&&p.s>o.startMeters&&p.s<o.endMeters){const u=(p.s-o.startMeters)/(o.endMeters-o.startMeters),weight=Math.sin(Math.PI*u)**2;
      observationYaw=clamp(shortest(Math.atan2(o.target.x-p.x,o.target.z-p.z)-lookHeading),-.4,.4)*weight;}
    return {...p,heading:headingAt(p.s),lookHeading,observationYaw};
  }
  function bendSpeedFactorAt(chainage: number) {
    let factor=1;
    for(const turn of follow.turns){
      const radius=Math.max(12,(turn.end-turn.start)*.5+6),gap=Math.abs(chainage-turn.at);
      if(gap<radius){const weight=.5+.5*Math.cos(Math.PI*gap/radius),severity=Math.min(1,Math.abs(turn.delta)/.9);factor=Math.min(factor,1-.48*severity*weight);}
    }
    return factor;
  }
  function speedAt(chainage: number) {
    let speed: number = RAFT_RIDE.cruiseMetersPerSecond;
    for (const turn of follow.turns) {
      // Begin slowing before a bend. A smooth cosine envelope has no speed step.
      const radius = Math.max(12, (turn.end - turn.start) * .5 + 6), gap = Math.abs(chainage - turn.at);
      if (gap < radius) {
        const weight = .5 + .5 * Math.cos(Math.PI * gap / radius), severity = Math.min(1, Math.abs(turn.delta) / .9);
        speed = Math.min(speed, RAFT_RIDE.cruiseMetersPerSecond * (1 - .48 * severity * weight));
      }
    }
    // Slow to a bounded stop; never wrap or teleport to the start.
    return speed * Math.min(1, Math.sqrt(Math.max(0, endMeters - chainage) / 3));
  }
  return { startMeters, endMeters, sample, speedAt, bendSpeedFactorAt, fingerprint, turns: follow.turns, surfaceAt:options.surfaceAt,surfaceFootprint:options.surfaceFootprint };
}
export type RaftRideRoute = ReturnType<typeof createRaftRideRoute>;

/** Sole owner of boat travel and manual observation. Water and page scroll never enter this state. */
export function createRaftRideController(route: RaftRideRoute) {
  let travelMeters = 0, yaw = 0, pitch = -.025, userPaused = false, suspended = false, reducedMotion = false, swayTime = 0;
  let speedMetersPerSecond = 0,manualLook=false;
  let targetTravelMeters:number|null=null,journeyId:string|null=null,journeySerial=0,journeyElapsedSeconds=0;
  let journeyMotion:RaftJourneyMotion|null=null,journeyPhase:RaftRideSnapshot['journeyPhase']='cruising';
  let velocityMetersPerSecond=0,accelerationMetersPerSecondSquared=0;
  let poseReducedMotion=false;
  let cached:ReturnType<typeof calculatePose>|null=null;
  const length=route.endMeters-route.startMeters;
  const atEnd = () => travelMeters >= route.endMeters - route.startMeters;
  const arrived=()=>journeyPhase==='arrived';
  const snapshot = (): RaftRideSnapshot => ({ travelMeters, chainageMeters: route.startMeters + travelMeters,
    routeStartMeters: route.startMeters, routeEndMeters: route.endMeters, yaw, pitch, userPaused, suspended, reducedMotion,
    atEnd: atEnd(), paused: userPaused || suspended || reducedMotion || arrived() || (targetTravelMeters===null&&atEnd()), speedMetersPerSecond,manualLook,
    targetTravelMeters,journeyPhase,journeyId,arrived:arrived(),journeyElapsedSeconds,journeyDurationSeconds:journeyMotion?.durationSeconds??0,
    velocityMetersPerSecond,accelerationMetersPerSecondSquared,swayTime,poseReducedMotion,journeySerial,routeFingerprint:route.fingerprint,journeyMotion:journeyMotion?{...journeyMotion,coefficients:[...journeyMotion.coefficients]}:null });
  function advance(deltaSeconds: number, motion: boolean) {
    reducedMotion=!motion;
    if(!userPaused&&!suspended&&poseReducedMotion!==reducedMotion){poseReducedMotion=reducedMotion;cached=null;}
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, .1);
    speedMetersPerSecond = 0;
    if (!userPaused && !suspended && motion && journeyPhase==='travelling'&&journeyMotion) {
      journeyElapsedSeconds=Math.min(journeyMotion.durationSeconds,journeyElapsedSeconds+dt);
      const next=sampleRaftJourney(journeyMotion,journeyElapsedSeconds);
      travelMeters=clamp(next.travelMeters,0,length);velocityMetersPerSecond=next.velocity;accelerationMetersPerSecondSquared=next.acceleration;
      if(journeyElapsedSeconds>=journeyMotion.durationSeconds){travelMeters=targetTravelMeters!;journeyPhase='arrived';velocityMetersPerSecond=0;accelerationMetersPerSecondSquared=0;}
      speedMetersPerSecond=Math.abs(velocityMetersPerSecond);swayTime+=dt;cached=null;
    } else if (!userPaused && !suspended && motion && targetTravelMeters===null && !atEnd()) {
      const s = route.startMeters + travelMeters, speed = route.speedAt(s);
      travelMeters = Math.min(route.endMeters - route.startMeters, travelMeters + speed * dt);
      if (route.endMeters - route.startMeters - travelMeters < .002) travelMeters = route.endMeters - route.startMeters;
      speedMetersPerSecond = atEnd() ? 0 : speed; velocityMetersPerSecond=speedMetersPerSecond;accelerationMetersPerSecondSquared=0;swayTime += dt;
      cached=null;
    }
    return pose();
  }
  function pose(){return cached??(cached=calculatePose());}
  function calculatePose() {
    const p = route.sample(route.startMeters + travelMeters), heading = p.lookHeading + yaw+(manualLook?0:p.observationYaw);
    // Pause holds the exact last pose. Reduced motion removes sway, but does not erase manual yaw/pitch.
    const heave = poseReducedMotion ? 0 : Math.sin(swayTime * .8) * RAFT_RIDE.maxHeaveMeters / RAFT_RIDE.sceneMeters;
    const roll = poseReducedMotion ? 0 : Math.sin(swayTime * .65) * RAFT_RIDE.maxRollRadians;
    const seat = RAFT_RIDE.seatBehindCenterMeters / RAFT_RIDE.sceneMeters;
    const dx=Math.sin(p.heading),dz=Math.cos(p.heading),half=RAFT_RIDE.lengthMeters/20,surface=route.surfaceAt;
    const front=surface?.(p.x+dx*half,p.z+dz*half)??p.y,back=surface?.(p.x-dx*half,p.z-dz*half)??p.y;
    const boatPitch=-Math.atan2(front-back,half*2),deck=RAFT_RIDE.deckAboveWaterMeters/10,width=RAFT_RIDE.widthMeters/20;let hullCenterY=p.y;
    const sp=Math.sin(boatPitch),cp=Math.cos(boatPitch),sr=Math.sin(roll),cr=Math.cos(roll);
    const corner=(x:number,z:number)=>{const rotatedX=cr*x-sr*deck,rotatedZ=sp*(sr*x+cr*deck)+cp*z;return{x:p.x+dz*rotatedX+dx*rotatedZ,z:p.z-dx*rotatedX+dz*rotatedZ};};
    const polygon=[corner(-width,-half),corner(width,-half),corner(width,half),corner(-width,half)];
    const probes=route.surfaceFootprint?.(polygon)??[-half,0,half].flatMap(fore=>[-width,0,width].map(side=>{const q=corner(side,fore);return{...q,y:surface?.(q.x,q.z)??p.y};}));
    let minimumDeckClearanceMeters=Infinity;
    // A rigid deck and each water triangle are affine. Checking every clipped polygon
    // vertex also covers mesh ridges that lie between the boat's nine ordinary probes.
    const deckAt=(x:number,z:number)=>deck/(cp*cr)+Math.tan(roll)/cp*((x-p.x)*dz-(z-p.z)*dx)-Math.tan(boatPitch)*((x-p.x)*dx+(z-p.z)*dz);
    for(const q of probes)hullCenterY=Math.max(hullCenterY,q.y+.0105-deckAt(q.x,q.z)-heave);
    for(const q of probes)minimumDeckClearanceMeters=Math.min(minimumDeckClearanceMeters,(hullCenterY+heave+deckAt(q.x,q.z)-q.y)*10);
    const eyeX=p.x-dx*seat,eyeZ=p.z-dz*seat,eyeWaterY=surface?.(eyeX,eyeZ)??p.y;
    const eye = { x: eyeX, y: eyeWaterY + RAFT_RIDE.eyeAboveWaterMeters / RAFT_RIDE.sceneMeters + heave, z: eyeZ };
    return { ...p, eye, heading: p.heading, cameraHeading: heading, cameraPitch: pitch,
      direction: { x: Math.sin(heading) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(heading) * Math.cos(pitch) }, heave, roll,boatPitch,hullCenterY,eyeWaterY,minimumDeckClearanceMeters };
  }
  function requestTravel(target:number,options:RaftTravelOptions={}){
    if(!Number.isFinite(target))throw new Error('Invalid raft travel target');
    const next=clamp(target,0,length);
    if(options.resume)userPaused=false;
    if(targetTravelMeters!==null&&Math.abs(next-targetTravelMeters)<1e-8)return snapshot();
    targetTravelMeters=next;journeyId=options.journeyId??`journey-${++journeySerial}`;journeyElapsedSeconds=0;
    if(Math.abs(next-travelMeters)<1e-8&&Math.abs(velocityMetersPerSecond)<1e-8){journeyMotion=null;journeyPhase='arrived';velocityMetersPerSecond=0;accelerationMetersPerSecondSquared=0;speedMetersPerSecond=0;return snapshot();}
    journeyMotion=planRaftJourney(travelMeters,next,velocityMetersPerSecond,accelerationMetersPerSecondSquared,options,t=>route.bendSpeedFactorAt(route.startMeters+clamp(t,0,length)));
    journeyPhase='travelling';return snapshot();
  }
  function reset(next=0,options:{keepUserPaused?:boolean}={}){
    if(!Number.isFinite(next))throw new Error('Invalid raft reset position');
    travelMeters=clamp(next,0,length);yaw=0;pitch=-.025;manualLook=false;swayTime=0;poseReducedMotion=reducedMotion;
    if(!options.keepUserPaused)userPaused=false;
    targetTravelMeters=travelMeters;journeyId=null;journeyMotion=null;journeyElapsedSeconds=0;journeyPhase='arrived';
    speedMetersPerSecond=0;velocityMetersPerSecond=0;accelerationMetersPerSecondSquared=0;cached=null;return pose();
  }
  function restore(saved:RaftRideSnapshot){
    if(saved.routeStartMeters!==route.startMeters||saved.routeEndMeters!==route.endMeters||saved.routeFingerprint!==route.fingerprint)throw new Error('Incompatible raft snapshot route');
    if(![saved.travelMeters,saved.yaw,saved.pitch,saved.swayTime,saved.journeyElapsedSeconds,saved.velocityMetersPerSecond,saved.accelerationMetersPerSecondSquared].every(Number.isFinite)||saved.travelMeters<0||saved.travelMeters>length||saved.targetTravelMeters!==null&&(!Number.isFinite(saved.targetTravelMeters)||saved.targetTravelMeters<0||saved.targetTravelMeters>length))throw new Error('Invalid raft snapshot');
    if(saved.journeyPhase==='travelling'&&(!saved.journeyMotion||saved.targetTravelMeters===null))throw new Error('Invalid raft journey snapshot');
    if(saved.journeyMotion&&(!Number.isFinite(saved.journeyMotion.durationSeconds)||saved.journeyMotion.durationSeconds<=0||!saved.journeyMotion.coefficients.every(Number.isFinite)||saved.journeyElapsedSeconds<0||saved.journeyElapsedSeconds>saved.journeyMotion.durationSeconds))throw new Error('Invalid raft motion snapshot');
    travelMeters=saved.travelMeters;yaw=saved.yaw;pitch=saved.pitch;manualLook=saved.manualLook;swayTime=saved.swayTime;poseReducedMotion=saved.poseReducedMotion;
    userPaused=saved.userPaused;suspended=saved.suspended;reducedMotion=saved.reducedMotion;speedMetersPerSecond=saved.speedMetersPerSecond;
    targetTravelMeters=saved.targetTravelMeters;journeyId=saved.journeyId;journeySerial=saved.journeySerial;journeyElapsedSeconds=saved.journeyElapsedSeconds;journeyPhase=saved.journeyPhase;
    velocityMetersPerSecond=saved.velocityMetersPerSecond;accelerationMetersPerSecondSquared=saved.accelerationMetersPerSecondSquared;
    journeyMotion=saved.journeyMotion?{...saved.journeyMotion,coefficients:[...saved.journeyMotion.coefficients]}:null;cached=null;return pose();
  }
  return { snapshot, pose, advance,requestTravel,reset,restore,
    setSuspended(value: boolean) { if(value&&!suspended)pose();suspended = value; speedMetersPerSecond = 0; },
    setReducedMotion(value: boolean) { reducedMotion=value;if(!userPaused&&!suspended&&poseReducedMotion!==value){poseReducedMotion=value;cached=null;}speedMetersPerSecond = 0; },
    setPaused(value:boolean){if(!suspended){userPaused=value;speedMetersPerSecond=0;}},
    togglePaused() { if (!suspended && (targetTravelMeters!==null||!atEnd())) { userPaused = !userPaused; speedMetersPerSecond = 0; } },
    look(deltaYaw: number, deltaPitch = 0) { if (suspended || !Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return;if(!manualLook){yaw+=route.sample(route.startMeters+travelMeters).observationYaw;manualLook=true;} yaw = shortest(yaw + deltaYaw); pitch = clamp(pitch + deltaPitch, -1.30, 1.30);cached=null; },
    setAutomaticView(nextYaw:number,nextPitch:number){if(suspended||manualLook||userPaused||!Number.isFinite(nextYaw)||!Number.isFinite(nextPitch))return;yaw=shortest(nextYaw);pitch=clamp(nextPitch,-1.30,1.30);cached=null;},
    resumeAutomaticLook(){if(!suspended){manualLook=false;cached=null;}},
    recenter() { if (!suspended) { yaw = 0; pitch = -.025;manualLook=true;cached=null; } },
  };
}
export type RaftRideController = ReturnType<typeof createRaftRideController>;
