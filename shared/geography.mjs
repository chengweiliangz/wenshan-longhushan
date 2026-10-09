export const GEO_ORIGIN = [117.0, 28.07];
const R = 6378137, D = Math.PI / 180;
export function geoToWorld(coordinates, origin = GEO_ORIGIN, crs = 'EPSG:4326') {
  if (crs !== 'EPSG:4326') throw new Error('Convert source coordinates to WGS84 before use');
  const [lon, lat] = coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('Invalid coordinates');
  return [(lon-origin[0])*D*R*Math.cos(origin[1]*D), -(lat-origin[1])*D*R];
}
export function worldToGeo([x,z], origin=GEO_ORIGIN) {
  return [origin[0]+x/(D*R*Math.cos(origin[1]*D)), origin[1]-z/(D*R)];
}

/** glTF local metres: +X east in the design plan, -Z plan north. Bearing is clockwise
 * from geographic north. This helper is shared by model placement and evidence tests. */
export function modelLocalToWorld([x,y,z], geo) {
  const [east,northZ]=geoToWorld(geo.coordinates),scale=geo.alignment?.modelScale??1;
  const angle=-geo.bearing*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  return [east+scale*(c*x+s*z),geo.elevation.meters+scale*y,northZ+scale*(-s*x+c*z)];
}
export function worldToModelLocal([x,y,z],geo) {
  const [east,northZ]=geoToWorld(geo.coordinates),scale=geo.alignment?.modelScale??1;
  const angle=-geo.bearing*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dx=x-east,dz=z-northZ;
  return [(c*dx-s*dz)/scale,(y-geo.elevation.meters)/scale,(s*dx+c*dz)/scale];
}
