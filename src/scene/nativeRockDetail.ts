/** Local tessellation only; every added height comes from the existing AF sampler.
 * R3 is a visible-rock material reference, NOT a surveyed crest/toe footprint.
 * Bounds select source-data recovery, not the physical cliff boundary.
 * Outside these touched source cells the original adaptive algorithm is unchanged.
 */
export const BI_NATIVE_ROCK_DETAIL={id:'R3-native-sampling',boundsSceneXZ:[-429.37808451477605,-128.054643234054,-412.8327381399998,-97.70680912623259],maxCellSceneUnits:1.1,sourceBinarySHA256:'03dec8e6faf7884f80629e8a059e2627308de8d5206c5ef0ca772b7ddd5b02ff'} as const;
export function refineNativeRockCell(a:{x:number;z:number},b:{x:number;z:number}){
 const box=BI_NATIVE_ROCK_DETAIL.boundsSceneXZ;
 if(Math.max(a.x,b.x)<box[0]||Math.min(a.x,b.x)>box[2]||Math.max(a.z,b.z)<box[1]||Math.min(a.z,b.z)>box[3])return false;
 return Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))>BI_NATIVE_ROCK_DETAIL.maxCellSceneUnits;
}
