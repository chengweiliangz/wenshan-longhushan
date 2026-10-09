// Presentation grading only: THAD photographs show the forecourt below the
// modern platform. This does not alter the raw DEM or claim a surveyed level.
export function siteGroundHeight(x,z,sourceRelativeHeight,spotId="shangqing") {
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
  if(spotId==='zhengyi') {
    // Platform grading inferred from photographs, not surveyed ground.
    const outside=Math.max(Math.abs(x)-32,-42-z,z-110);
    const grade=-.65-.5*smooth(63,71,z)-.8*smooth(74,79,z);
    return grade+(sourceRelativeHeight-grade)*smooth(0,15,outside);
  }
  if(spotId==='tianshi') {
    // Display grading follows the southern approach; DEM heights are not a survey.
    const outside=Math.min(Math.max(Math.abs(x)-65,-108-z,z-145),Math.max(-28-x,x-42,136-z,z-179));
    const grade=-.4-3*smooth(50,130,z);
    return grade+(sourceRelativeHeight-grade)*smooth(0,15,outside);
  }
  const width=44-18*smooth(83,91,z);
  const outside=Math.max(Math.abs(x)-width,-52-z,z-110);
  const grade=-.35-2.25*smooth(46,49,z);
  return grade+(sourceRelativeHeight-grade)*smooth(0,15,outside);
}
