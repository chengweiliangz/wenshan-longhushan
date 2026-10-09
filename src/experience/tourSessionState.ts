
export const TOUR_STATIONS = ['river','zhengyi','tianshi','shangqing'] as const;
export type TourStationId = typeof TOUR_STATIONS[number];
export const TOUR_NAMES:Record<TourStationId,string>={river:'泸溪河',zhengyi:'正一观',tianshi:'嗣汉天师府',shangqing:'大上清宫'};
export type TourRequest={serial:number;id:TourStationId;source:'click'|'scroll'|'restart';resume:boolean};
export type TourSession={mode:'home'|'tour'|'reading';station:TourStationId;targetStation:TourStationId;phase:string;ready:boolean;fallback:boolean;exploring:boolean;cardsCollapsed:boolean;hasProgress:boolean;request:TourRequest|null;status:string;transition:number;blocked:boolean};
let state:TourSession={mode:'home',station:'river',targetStation:'river',phase:'drifting',ready:false,fallback:false,exploring:false,cardsCollapsed:false,hasProgress:false,request:null,status:'沿泸溪河缓行',transition:0,blocked:false};
const listeners=new Set<()=>void>();
let serial=0,ignoreScrollUntil=0,lastTourY=0,returnY=0;
let pendingWorldExplore:TourStationId|null=null;
let readingAnchor:{id:TourStationId;fraction:number;top:number;height:number;width:number;viewport:number;y:number}|null=null;
function captureReadingPosition(y:number){const el=document.getElementById('tour-'+state.station);if(!el)return;const r=el.getBoundingClientRect(),top=r.top+window.scrollY,height=el.offsetHeight||r.height||window.innerHeight;readingAnchor={id:state.station,fraction:(y-top)/height,top,height,width:window.innerWidth,viewport:window.innerHeight,y};}
function resolvedReadingPosition(){
 const a=readingAnchor,el=a?document.getElementById('tour-'+a.id):null;if(!a||!el)return returnY||chapterY(state.station);
 const r=el.getBoundingClientRect(),top=r.top+window.scrollY,height=el.offsetHeight||r.height||window.innerHeight;
 if(a.width===window.innerWidth&&a.viewport===window.innerHeight&&Math.abs(top-a.top)<.5&&Math.abs(height-a.height)<.5)return a.y;
 return Math.max(0,top+a.fraction*height);
}
const emit=(patch:Partial<TourSession>)=>{if(Object.entries(patch).every(([k,v])=>state[k as keyof TourSession]===v))return;state={...state,...patch};document.documentElement.dataset.tourMode=state.mode;listeners.forEach(fn=>fn());};
export const subscribeTour=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const getTourSession=()=>state;
export const isTourStation=(id:string):id is TourStationId=>TOUR_STATIONS.includes(id as TourStationId);
function chapterY(id:TourStationId){const el=document.getElementById('tour-'+id);return Math.max(0,(el?.getBoundingClientRect().top??0)+window.scrollY-112);}
function scrollPage(y:number){ignoreScrollUntil=performance.now()+180;window.scrollTo({top:y,behavior:'instant'});}
export function setTourReady(ready:boolean,fallback=false){emit({ready,fallback,...(fallback?{exploring:false,cardsCollapsed:false}:{})});}
export function setTourBlocked(blocked:boolean){if(blocked&&!state.blocked&&state.mode==='tour')captureReadingPosition(window.scrollY);const restore=!blocked&&state.blocked&&state.mode==='tour';emit({blocked});if(restore){const y=resolvedReadingPosition();if(Math.abs(y-window.scrollY)>.5)scrollPage(y);}}
export function publishTourScene(patch:Pick<TourSession,'phase'|'status'|'transition'>){emit(patch);if(pendingWorldExplore&&state.mode==='tour'&&!state.blocked&&state.ready&&state.phase==='arrived'&&state.station===pendingWorldExplore&&state.targetStation===pendingWorldExplore){pendingWorldExplore=null;setTourExploring(true);}}
/** All explicit and scroll selections converge here; there is only one latest request. */
export function selectTourStation(id:TourStationId,source:'click'|'scroll'='click'){
 if(state.blocked)return;pendingWorldExplore=null;
 const same=state.targetStation===id;
 const request=same&&source==='scroll'&&state.hasProgress?state.request:{serial:++serial,id,source,resume:source==='click'};
 emit({mode:'tour',station:id,targetStation:id,hasProgress:true,request,exploring:false,cardsCollapsed:false,...(request!==state.request?{phase:'departing',status:'正在前往'+TOUR_NAMES[id]}:{})});
 if(source==='click'){lastTourY=returnY=chapterY(id);scrollPage(lastTourY);captureReadingPosition(lastTourY);}
}
export function returnTourHome(){
 if(state.blocked)return;pendingWorldExplore=null;
 if(state.mode==='tour')returnY=lastTourY||window.scrollY;
 emit({mode:'home'});scrollPage(0);
}
export function continueTour(){
 if(state.blocked)return;
 if(!state.hasProgress){selectTourStation('river','click');return;}
 emit({mode:'tour'});lastTourY=returnY=resolvedReadingPosition();scrollPage(lastTourY);captureReadingPosition(lastTourY);
}
export function restartTour(){
 if(state.blocked)return;
 emit({mode:'tour',station:'river',targetStation:'river',phase:'transferring',exploring:false,cardsCollapsed:false,hasProgress:true,request:{serial:++serial,id:'river',source:'restart',resume:true}});
 lastTourY=returnY=chapterY('river');scrollPage(lastTourY);captureReadingPosition(lastTourY);
}
/** Hysteresis prevents a small boundary scroll from repeatedly toggling home and WebGL. */
export function synchronizeTourScroll(){
 if(state.blocked||state.exploring||performance.now()<ignoreScrollUntil)return;
 const y=window.scrollY,vh=window.innerHeight,hero=document.getElementById('top'),journey=document.getElementById('journey');
 if(!hero||!journey)return;
 const heroEnd=hero.offsetTop+hero.offsetHeight;
 if(y<heroEnd*.42){if(state.mode!=='home'){if(state.mode==='tour')returnY=lastTourY;emit({mode:'home'});}return;}
 if(state.mode==='home'&&y<heroEnd*.78)return;
 const end=journey.getBoundingClientRect().bottom+y;
 if(y+vh*.4>end){if(state.mode==='tour')returnY=lastTourY;emit({mode:'reading'});return;}
 let id:TourStationId='river';
 for(const candidate of TOUR_STATIONS){const el=document.getElementById('tour-'+candidate);if(el&&el.getBoundingClientRect().top<vh*.55)id=candidate;}
 if(state.mode!=='tour'||state.targetStation!==id){
   // Re-entering the same chapter resumes the held journey without a second request.
   if(state.hasProgress&&id===state.targetStation)emit({mode:'tour'});else selectTourStation(id,'scroll');
 }
 lastTourY=returnY=y;captureReadingPosition(y);
}

/** Navigation to the rest of the site must not fly through the tour's scroll targets. */
export function leaveTourForReading(id:string){
 if(state.blocked)return;
 if(state.mode==='tour')returnY=lastTourY||window.scrollY;
 emit({mode:'reading'});
 const el=document.getElementById(id);if(el)scrollPage(Math.max(0,el.getBoundingClientRect().top+window.scrollY-92));
}

/** Exploration owns position until an explicit return or destination selection. */
export function setTourExploring(exploring:boolean){
 if(state.blocked||state.mode!=='tour'||exploring&&(!state.ready||state.phase!=='arrived'||!['zhengyi','tianshi','shangqing'].includes(state.station)))return;
 if(state.exploring===exploring)return;
 if(exploring){lastTourY=returnY=window.scrollY;captureReadingPosition(window.scrollY);}
 emit({exploring,cardsCollapsed:exploring,...(!exploring?{phase:'returning',status:'回到已保存的竹筏位置'}:{})});
 if(!exploring){lastTourY=returnY=resolvedReadingPosition();scrollPage(lastTourY);}
}
export function setTourCardsCollapsed(cardsCollapsed:boolean){emit({cardsCollapsed});}

/** Materials, model reference and chapters share this single world-exploration intent. */
export function requestWorldExplore(id:Exclude<TourStationId,'river'>){
 if(state.blocked)return false;
 if(state.station===id&&state.targetStation===id&&state.phase==='arrived'&&state.ready){
  if(state.mode!=='tour')continueTour();setTourExploring(true);
 }else{selectTourStation(id,'click');pendingWorldExplore=id;}
 return true;
}
