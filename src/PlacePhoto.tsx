import { useState } from 'react';
import { placeAssets } from '../shared/catalog.mjs';
export const assetFor = (id: string) => placeAssets[id as keyof typeof placeAssets];
export function PlacePhoto({ spotId, className = '', credit = false }: { spotId: string; className?: string; credit?: boolean }) {
  const photo = assetFor(spotId)?.photos[0];
  const [failed, setFailed] = useState(false);
  return <span className={`scene-image place-photo ${className}`}>
    {photo && !failed ? <><img src={photo.src} srcSet={`${photo.thumbnail} ${Math.min(480,photo.width)}w, ${photo.src} ${Math.min(1280,photo.width)}w`} sizes="(max-width: 700px) 90vw, 40vw" width={photo.width} height={photo.height} alt={photo.title} loading="lazy" onError={() => setFailed(true)} />{credit && <small>{photo.author} · 实拍资料</small>}</> : <span className="photo-missing"><span>实拍资料待补充</span><small>{failed ? '图片载入失败' : '该地点暂无已核验照片'}</small>{failed && <button onClick={() => setFailed(false)}>重试</button>}</span>}
  </span>;
}
