/** AF's lossless pixel grid; rendering remains on the legacy logical grid.
 * Bilinear interpolation is this consumer's explicit policy, not a new survey.
 * Unknown vertical datum stays unknown. No height or horizontal correction. */
export type LegacyTerrain={bounds:number[];cols:number;rows:number;heights:number[]};
export type NativeMetadata={schema:string;dataFile:string;dataSha256:string;dataBytes:number;dtype:string;byteOrder:string;rowMajor:boolean;rowOrder:string;columnOrder:string;width:number;height:number;horizontalCRS:string;mercatorRadiusM:number;pixelSizeProjectedM:number[];outerEdgeExtentProjectedM:number[];outerEdgeExtentWGS84:number[];heightUnit:string;verticalCRS:null;noDataValue:null};
export type SamplingState={mode:'native-loaded'|'legacy';nativeSamples:number;legacySamples:number;sourceOutsideSamples:number;halfCellEdgeClamps:number;receivedBinarySHA256:string|null;receivedMetadataSHA256:string|null};
export type Terrain=LegacyTerrain&{samplingState?:SamplingState;renderGrid?:{cols:number;rows:number};nativeGrid?:{metadata:NativeMetadata;values:Float32Array}};
export const AF_BINARY_SHA256='03dec8e6faf7884f80629e8a059e2627308de8d5206c5ef0ca772b7ddd5b02ff';
// Pin the published, privacy-cleaned LF metadata; keep binary integrity checks unchanged.
export const AF_METADATA_SHA256='c68ec9c18577cd863008821a69792a4bf0b8d830a43a52f0e38cfccbd21f3f58';
const state=(mode:'native-loaded'|'legacy'):SamplingState=>({mode,nativeSamples:0,legacySamples:0,sourceOutsideSamples:0,halfCellEdgeClamps:0,receivedBinarySHA256:null,receivedMetadataSHA256:null});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const lerp=(a:number,b:number,t:number)=>(1-t)*a+t*b;
function bilinear(values:ArrayLike<number>,cols:number,rows:number,u:number,v:number){
 u=clamp(u,0,cols-1);v=clamp(v,0,rows-1);const x=Math.floor(u),y=Math.floor(v),x1=Math.min(x+1,cols-1),y1=Math.min(y+1,rows-1);
 return lerp(lerp(values[y*cols+x],values[y*cols+x1],u-x),lerp(values[y1*cols+x],values[y1*cols+x1],u-x),v-y);
}
export function legacyElevation(d:LegacyTerrain,lon:number,lat:number){const b=d.bounds;return bilinear(d.heights,d.cols,d.rows,(lon-b[0])/(b[2]-b[0])*(d.cols-1),(b[3]-lat)/(b[3]-b[1])*(d.rows-1));}
export function nativeCenterIndex(m:NativeMetadata,lon:number,lat:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>=90)throw new Error('Invalid terrain coordinate');
 const r=m.mercatorRadiusM,x=r*lon*Math.PI/180,y=r*Math.asinh(Math.tan(lat*Math.PI/180)),[west,south,east,north]=m.outerEdgeExtentProjectedM;
 return {column:(x-west)/m.pixelSizeProjectedM[0]-.5,row:(y-north)/m.pixelSizeProjectedM[1]-.5,inside:lon>=m.outerEdgeExtentWGS84[0]&&lon<=m.outerEdgeExtentWGS84[2]&&lat>=m.outerEdgeExtentWGS84[1]&&lat<=m.outerEdgeExtentWGS84[3]};
}
export function terrainElevation(d:Terrain,lon:number,lat:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>=90)throw new Error('Invalid terrain coordinate');
 const n=d.nativeGrid,s=d.samplingState??=(state(n?'native-loaded':'legacy'));if(n){const q=nativeCenterIndex(n.metadata,lon,lat);if(q.inside){s.nativeSamples++;if(q.column<0||q.row<0||q.column>n.metadata.width-1||q.row>n.metadata.height-1)s.halfCellEdgeClamps++;return bilinear(n.values,n.metadata.width,n.metadata.height,q.column,q.row);}s.sourceOutsideSamples++;}s.legacySamples++;
 // Explicit old-data fallback outside the source footprint or without an attached grid.
 return legacyElevation(d,lon,lat);
}
export function terrainRenderGrid(d:Terrain){return d.renderGrid??{cols:d.cols,rows:d.rows};}
export function attachNativeTerrain(d:LegacyTerrain,m:NativeMetadata,buffer:ArrayBuffer):Terrain{
 if(m.schema!=='AF_NATIVE_TERRARIUM_GRID_V1'||m.dtype!=='Float32'||m.byteOrder!=='little-endian'||!m.rowMajor||m.rowOrder!=='north-to-south'||m.columnOrder!=='west-to-east'||m.horizontalCRS!=='EPSG:3857'||m.heightUnit!=='metre'||m.verticalCRS!==null||m.noDataValue!==null)throw new Error('Unsupported AF native grid definition');
 if(m.width!==768||m.height!==768||m.mercatorRadiusM!==6378137||m.pixelSizeProjectedM.length!==2||m.pixelSizeProjectedM[0]<=0||m.pixelSizeProjectedM[1]!==-m.pixelSizeProjectedM[0]||m.dataSha256!==AF_BINARY_SHA256||m.outerEdgeExtentWGS84.length!==4||!m.outerEdgeExtentWGS84.every(Number.isFinite)||m.outerEdgeExtentProjectedM.length!==4||!m.outerEdgeExtentProjectedM.every(Number.isFinite)||buffer.byteLength!==m.dataBytes||buffer.byteLength!==m.width*m.height*4)throw new Error('Invalid AF grid dimensions');
 const view=new DataView(buffer),values=new Float32Array(m.width*m.height);for(let i=0;i<values.length;i++){const h=view.getFloat32(i*4,true);if(!Number.isFinite(h))throw new Error('Invalid AF elevation sample');values[i]=h;}
 return {...d,samplingState:state('native-loaded'),renderGrid:{cols:d.cols,rows:d.rows},nativeGrid:{metadata:m,values}};
}
export async function loadNativeTerrain(d:LegacyTerrain,metadataURL:string,signal?:AbortSignal){
 const digest=async(b:ArrayBuffer)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');const response=await fetch(metadataURL,{signal});if(!response.ok)throw new Error('Native terrain metadata HTTP '+response.status);const metadataBytes=await response.arrayBuffer(),metadataHash=await digest(metadataBytes);if(metadataHash!==AF_METADATA_SHA256)throw new Error('Native metadata SHA mismatch');const m:NativeMetadata=JSON.parse(new TextDecoder().decode(metadataBytes));
 if(!/^[a-zA-Z0-9._-]+\.f32le$/.test(m.dataFile))throw new Error('Invalid native data filename');const binary=await fetch(new URL(m.dataFile,new URL(metadataURL,location.href)),{signal});if(!binary.ok)throw new Error('Native terrain data HTTP '+binary.status);const buffer=await binary.arrayBuffer();const hash=await digest(buffer);if(hash!==m.dataSha256||hash!==AF_BINARY_SHA256)throw new Error('Native terrain SHA mismatch');const terrain=attachNativeTerrain(d,m,buffer);Object.assign(terrain.samplingState!,{receivedBinarySHA256:hash,receivedMetadataSHA256:metadataHash});return terrain;
}
