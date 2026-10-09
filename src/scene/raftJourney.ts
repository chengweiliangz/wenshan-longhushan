/** Serializable, physical arc-length motion. Scene water animation has its own clock. */
export const RAFT_JOURNEY = Object.freeze({
  durationSeconds: 3.4, maxSpeedMetersPerSecond: 6,
  longDistanceMeters: 60, longSpeedMetersPerSecond: 2.4,
  maxAccelerationMetersPerSecondSquared: 4,
  maxJerkMetersPerSecondCubed: 18,
});
export type RaftTravelOptions = {
  resume?: boolean;
  journeyId?: string;
  durationSeconds?: number;
  maxSpeedMetersPerSecond?: number;
};
export type RaftJourneyMotion = {
  kind: 'cosine' | 'quintic';
  startTravelMeters: number;
  targetTravelMeters: number;
  startVelocityMetersPerSecond: number;
  startAccelerationMetersPerSecondSquared: number;
  durationSeconds: number;
  maxSpeedMetersPerSecond: number;
  rampSeconds: number;
  peakVelocityMetersPerSecond: number;
  leadSeconds: number;
  coefficients: readonly number[];
};
const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));
export function sampleRaftJourney(m:RaftJourneyMotion,elapsed:number) {
  const t=clamp(elapsed,0,m.durationSeconds);
  if(t>=m.durationSeconds)return{travelMeters:m.targetTravelMeters,velocity:0,acceleration:0};
  if(m.kind==='cosine'){
    const r=m.rampSeconds,v=m.peakVelocityMetersPerSecond,cruise=m.durationSeconds-2*r;
    if(t<r){const u=Math.PI*t/r;return{travelMeters:m.startTravelMeters+v*.5*(t-r/Math.PI*Math.sin(u)),velocity:v*.5*(1-Math.cos(u)),acceleration:v*Math.PI/(2*r)*Math.sin(u)};}
    if(t<=r+cruise)return{travelMeters:m.startTravelMeters+v*(r*.5+t-r),velocity:v,acceleration:0};
    const d=t-r-cruise,u=Math.PI*d/r;
    return{travelMeters:m.startTravelMeters+v*(r*.5+cruise)+v*.5*(d+r/Math.PI*Math.sin(u)),velocity:v*.5*(1+Math.cos(u)),acceleration:-v*Math.PI/(2*r)*Math.sin(u)};
  }
  if(t<m.leadSeconds){
    const h=m.leadSeconds,v=m.startVelocityMetersPerSecond,a=m.startAccelerationMetersPerSecondSquared;
    return{travelMeters:m.startTravelMeters+v*t+a*(t*t/2-t*t*t/(6*h)),velocity:v+a*(t-t*t/(2*h)),acceleration:a*(1-t/h)};
  }
  const T=m.durationSeconds-m.leadSeconds,u=(t-m.leadSeconds)/T,[c0,c1,c2,c3,c4,c5]=m.coefficients;
  return{
    travelMeters:c0+u*(c1+u*(c2+u*(c3+u*(c4+u*c5)))),
    velocity:(c1+u*(2*c2+u*(3*c3+u*(4*c4+u*5*c5))))/T,
    acceleration:(2*c2+u*(6*c3+u*(12*c4+u*20*c5)))/(T*T),
  };
}
function polynomial(start:number,target:number,v:number,a:number,T:number):RaftJourneyMotion {
  const d=target-start,vt=v*T,at=a*T*T;
  return{kind:'quintic',startTravelMeters:start,targetTravelMeters:target,startVelocityMetersPerSecond:v,startAccelerationMetersPerSecondSquared:a,durationSeconds:T,maxSpeedMetersPerSecond:0,rampSeconds:0,peakVelocityMetersPerSecond:0,leadSeconds:0,
    coefficients:[start,vt,at/2,10*d-6*vt-1.5*at,-15*d+8*vt+1.5*at,6*d-3*vt-.5*at]};
}
/** Duration is a preference; bends, acceleration and speed are hard planning limits. */
export function planRaftJourney(start:number,target:number,velocity:number,acceleration:number,options:RaftTravelOptions,speedFactorAt:(travel:number)=>number) {
  const distance=Math.abs(target-start),direction=Math.sign(target-start)||1;
  const requestedDuration=Number.isFinite(options.durationSeconds)?clamp(options.durationSeconds!,.5,120):RAFT_JOURNEY.durationSeconds;
  const requestedSpeed=Number.isFinite(options.maxSpeedMetersPerSecond)?clamp(options.maxSpeedMetersPerSecond!,.1,RAFT_JOURNEY.maxSpeedMetersPerSecond):RAFT_JOURNEY.maxSpeedMetersPerSecond;
  let cap=distance>RAFT_JOURNEY.longDistanceMeters?Math.min(requestedSpeed,RAFT_JOURNEY.longSpeedMetersPerSecond):requestedSpeed;
  // Anticipate all bends on the leg, so the boat never reaches a corner at cruise speed.
  const samples=Math.max(32,Math.ceil(distance/2));
  for(let i=0;i<=samples;i++)cap=Math.min(cap,requestedSpeed*speedFactorAt(start+(target-start)*i/samples));
  const A=RAFT_JOURNEY.maxAccelerationMetersPerSecondSquared,J=RAFT_JOURNEY.maxJerkMetersPerSecondCubed;
  if(Math.abs(velocity)<1e-10&&Math.abs(acceleration)<1e-10&&distance>1e-10){
    const ramp=(v:number)=>Math.max(Math.PI*v/(2*A),Math.sqrt(Math.PI*Math.PI*v/(2*J)));
    let lo=0,hi=cap;
    // Select the largest peak that leaves room for a complete smooth braking ramp.
    for(let i=0;i<60;i++){const v=(lo+hi)/2;if(v*ramp(v)<=distance)lo=v;else hi=v;}
    let peak=lo,r=ramp(peak),duration=distance/peak+r;
    if(duration<requestedDuration){lo=0;hi=peak;for(let i=0;i<60;i++){const v=(lo+hi)/2;if(distance/v+ramp(v)>requestedDuration)lo=v;else hi=v;}peak=hi;r=ramp(peak);duration=distance/peak+r;}
    return{kind:'cosine' as const,startTravelMeters:start,targetTravelMeters:target,startVelocityMetersPerSecond:0,startAccelerationMetersPerSecondSquared:0,durationSeconds:duration,maxSpeedMetersPerSecond:cap,rampSeconds:r,peakVelocityMetersPerSecond:direction*peak,leadSeconds:0,coefficients:[]};
  }
  // Retargeting retains both derivatives: replacing a target cannot kick the boat.
  // Bring inherited acceleration to zero with bounded jerk. Extending a polynomial
  // that starts with nonzero acceleration would amplify its a*T^2 coefficient.
  const leadSeconds=Math.abs(acceleration)/J,mainStart=start+velocity*leadSeconds+acceleration*leadSeconds*leadSeconds/3,mainVelocity=velocity+acceleration*leadSeconds/2;
  let duration=Math.max(requestedDuration-leadSeconds,Math.abs(target-mainStart)*1.875/cap,.6),motion=polynomial(mainStart,target,mainVelocity,0,duration);
  for(let attempt=0;attempt<96;attempt++){
    motion=polynomial(mainStart,target,mainVelocity,0,duration);let scale=1;
    for(let i=0;i<=128;i++){
      const t=duration*i/128,p=sampleRaftJourney(motion,t),limit=Math.max(cap,Math.abs(mainVelocity));
      const [,,,c3,c4,c5]=motion.coefficients,u=t/duration;
      const jerk=(6*c3+24*c4*u+60*c5*u*u)/(duration**3);
      scale=Math.max(scale,Math.abs(p.velocity)/limit,Math.sqrt(Math.abs(p.acceleration)/Math.max(A,Math.abs(acceleration))),Math.cbrt(Math.abs(jerk)/J));
    }
    if(scale<=1.00001)break;
    duration*=Math.min(1.15,Math.max(1.025,scale));
  }
  motion.maxSpeedMetersPerSecond=cap;motion.leadSeconds=leadSeconds;motion.durationSeconds+=leadSeconds;
  motion.startTravelMeters=start;motion.startVelocityMetersPerSecond=velocity;motion.startAccelerationMetersPerSecondSquared=acceleration;
  return motion;
}
