import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Headphones, Landmark, MapPin, Mountain, Route, Waves, X } from 'lucide-react';
import { spots } from '../../shared/catalog.mjs';
import { GeoMap } from '../GeoMap';
import { PlacePhoto } from '../PlacePhoto';
import { selectTourStation, setTourCardsCollapsed, TOUR_STATIONS, useTourSession } from './tourSession';
import type { TourStationId } from './tourSession';
import './tourChapters.css';

type Spot = (typeof spots)[number];
type Props = {
  onSpot: (id: string, trigger: HTMLElement) => void;
  onListen: (spot: Spot) => void;
};

const stationCopy: Record<TourStationId, { label: string; shortName: string; entry: string; summary: string }> = {
  river: { label: '山水开场', shortName: '泸溪河', entry: '', summary: '沿泸溪河看两岸丹霞，让山体与河谷慢慢展开。' },
  zhengyi: { label: '第一处宫观', shortName: '正一观', entry: '进入正一观', summary: '停在正一观，读一处宫观，也留一段安静的时光。' },
  tianshi: { label: '走进上清', shortName: '天师府', entry: '进入天师府', summary: '走进上清片区，在传统建筑之间认识道教文化。' },
  shangqing: { label: '遗址与保护', shortName: '大上清宫', entry: '进入大上清宫', summary: '从南部复建建筑，到考古遗址与现代保护设施。' },
};
const spotById = (id: string) => spots.find(spot => spot.id === id)!;
const extraSpots = spots.filter(spot => !TOUR_STATIONS.some(id => id === spot.id));
const pad = (value: number) => String(value).padStart(2, '0');

export function TourChapters({ onSpot, onListen }: Props) {
  const session = useTourSession();
  const [expandedStation, setExpandedStation] = useState<TourStationId | null>(null);
  useEffect(() => { setExpandedStation(null); }, [session.targetStation]);
  const selectFromMap = (id: string, trigger: HTMLElement) => {
    if (TOUR_STATIONS.some(station => station === id)) selectTourStation(id as TourStationId, 'click');
    else onSpot(id, trigger);
  };

  return <>
    <section id="journey" className={'chapter tour-journey' + (session.exploring ? ' is-exploring' : '')} aria-labelledby="journey-title">
      <h2 id="journey-title" className="tour-sr-only">四站山水漫游</h2>
      {TOUR_STATIONS.map((id, index) => {
        const spot = spotById(id);
        const copy = stationCopy[id];
        const selected = session.mode === 'tour' && session.targetStation === id;
        const visible = selected && !session.cardsCollapsed;
        const mobileExpanded = expandedStation === id;
        const arrived = session.ready && selected && session.station === id && (session.phase === 'arrived' || (id === 'river' && session.phase === 'drifting'));
        const photoOnly = selected && session.fallback;
        const canEnter = id !== 'river' && (arrived || photoOnly);
        const nextId = TOUR_STATIONS[index + 1];
        return <section
          key={id}
          id={'tour-' + id}
          className={'tour-station' + (selected ? ' is-selected' : '') + (visible ? ' is-card-visible' : '')}
          data-tour-station={id}
          aria-labelledby={'tour-' + id + '-title'}
        >
          <div className="tour-station-surface" inert={!visible} aria-hidden={!visible}>
            <article className={'tour-card' + (mobileExpanded ? ' is-mobile-expanded' : ' is-mobile-compact')}>
              <button type="button" className="tour-card-collapse" aria-label={'收起' + spot.name + '卡片'} onClick={() => setTourCardsCollapsed(true)}><X size={15} /></button>
              <button
                className="tour-card-photo"
                type="button"
                aria-label={'前往' + spot.name + '漫游站点'}
                onClick={() => selectTourStation(id, 'click')}
              >
                <PlacePhoto spotId={id} />
                <span className="tour-photo-label">{id === 'river' ? <Waves size={13} /> : <Landmark size={13} />}{spot.category}</span>
                <span className="tour-photo-link"><ArrowUpRight size={18} /></span>
              </button>
              <div className="tour-card-body">
                <div className="tour-card-reading" id={'tour-' + id + '-reading'}>
                  <div className="tour-card-kicker"><span>{pad(index + 1)} / 04 · {copy.label}</span><span className={'tour-stop-status' + (arrived ? ' is-arrived' : '')}>{photoOnly ? '实拍资料' : selected ? arrived ? '已抵达' : '正在前往' : spot.zone}</span></div>
                  <h2 id={'tour-' + id + '-title'}>{spot.name}</h2>
                  <p className="tour-card-subtitle">{spot.subtitle}</p>
                  <p className="tour-card-description">{copy.summary}</p>
                  <details className="tour-fact"><summary>展开介绍与山中小记<ChevronDown size={15} /></summary><div className="tour-full-description"><p>{spot.description}</p><p>{spot.fact}</p><small>{spot.note}</small></div></details>
                </div>
                <div className="tour-card-actions">
                  <button type="button" className="tour-select-button" onClick={() => selectTourStation(id, 'click')}>
                    <Route size={15} />{photoOnly ? '此站资料' : arrived ? '回到此站画面' : selected ? '正在前往此站' : '前往此站'}<ArrowRight size={15} />
                  </button>
                  {id !== 'river' && <button
                    type="button"
                    className="tour-enter-button"
                    disabled={!canEnter}
                    aria-describedby={'tour-' + id + '-entry-hint'}
                    onClick={event => { if (canEnter) onSpot(id, event.currentTarget); }}
                  ><Landmark size={15} />{photoOnly ? '查看本站资料' : selected && !arrived ? '正在前往…' : copy.entry}<ArrowUpRight size={15} /></button>}
                </div>
                {id !== 'river' && <p className="tour-entry-hint" id={'tour-' + id + '-entry-hint'}>{photoOnly ? '三维暂不可用，可先查看实拍与已有资料。' : canEnter ? '已到站，可打开宫观导览。' : '抵达后可进入宫观。'}</p>}
                <div className="tour-card-meta"><span><MapPin size={12} />{spot.zone} · 约 {spot.minutes} 分钟</span><button type="button" onClick={() => onListen(spot)} aria-label={'听小道士讲' + spot.name}><Headphones size={15} />听故事</button></div>
                <button
                  type="button"
                  className="tour-mobile-details-toggle"
                  data-tour-details={id}
                  aria-expanded={mobileExpanded}
                  aria-controls={'tour-' + id + '-reading'}
                  onClick={event => {
                    const next = !mobileExpanded;
                    setExpandedStation(next ? id : null);
                    const facts = event.currentTarget.closest('.tour-card')?.querySelector<HTMLDetailsElement>('.tour-fact');
                    if (next && facts) facts.open = true;
                  }}
                >{mobileExpanded ? '收回介绍' : '展开介绍与故事'}<ChevronDown size={15} /></button>
              </div>
            </article>
            <p className="tour-next-note">{nextId ? <><ArrowDown size={13} />向下滚动 · 下一站 {stationCopy[nextId].shortName}</> : <><ArrowDown size={13} />继续向下 · 听故事、计划行程</>}</p>
          </div>
        </section>;
      })}
    </section>
    <section className="chapter tour-extra-chapter" aria-label="主线之外的山水">
      <details className="tour-extras">
        <summary><span><Mountain size={17} /><strong>再看一眼山水</strong><small>象鼻山 · 丹霞观察 · 地点索引</small></span><ChevronDown size={18} /></summary>
        <div className="tour-extras-body">
          <p className="tour-extras-intro">四站之外，也有值得停留的风景。地图中的宫观点可切换漫游站点。</p>
          <GeoMap onSpot={selectFromMap} />
          <div className="tour-extra-list">{extraSpots.map(spot => <article className="tour-extra-card" key={spot.id}>
            <div><span>{spot.category} · {spot.zone}</span><h3>{spot.name}</h3><p>{spot.subtitle}</p></div>
            <div className="tour-extra-actions"><button type="button" onClick={event => onSpot(spot.id, event.currentTarget)} aria-label={'查看' + spot.name + '资料'}>查看资料<ArrowUpRight size={14} /></button><button type="button" onClick={() => onListen(spot)} aria-label={'听' + spot.name + '的故事'}><Headphones size={15} /></button></div>
          </article>)}</div>
        </div>
      </details>
    </section>
  </>;
}
