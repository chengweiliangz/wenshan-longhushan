import { placeAssets, spots } from '../shared/catalog.mjs';
import { geoToWorld } from '../shared/geography.mjs';
const ids = ['zhengyi', 'elephant', 'tianshi', 'shangqing'] as const;
const bounds = { left: -5200, top: -4500, width: 11500, height: 10000 };
export function GeoMap({ onSpot }: { onSpot: (id: string, trigger: HTMLElement) => void }) {
  return <section className="geo-map" aria-label="地点地理位置索引">
    <div><span className="eyebrow">两片山水 · 各归其处</span><h3>从龙虎山，到上清</h3><p>按公开地理数据等比例定位。选择地点，查看资料与来源。</p></div>
    <div className="geo-map-plane"><span className="map-north">北 ↑</span><span className="map-zone zone-west">龙虎山片区</span><span className="map-zone zone-east">上清片区</span>
    {ids.map(id => { const a = placeAssets[id], [x,z] = geoToWorld(a.geo.coordinates); return <button key={id} className={`map-pin pin-${id}`} style={{ left: `${(x-bounds.left)/bounds.width*100}%`, top: `${(z-bounds.top)/bounds.height*100}%` }} onClick={e => onSpot(id, e.currentTarget)} aria-label={`地图查看${spots.find(s => s.id === id)!.name}`}><i /><span>{spots.find(s => s.id === id)!.name}</span></button>; })}
    <span className="map-scale">1 km</span></div><small>WGS84 · © OpenStreetMap contributors；大上清宫保护设施依据 Esri / Vantor 2023年影像与THAD平面配准。地点索引非现场导航；象鼻山仍为观景台点。</small>
  </section>;
}
