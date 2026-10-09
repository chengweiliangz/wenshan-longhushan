import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, Camera, Check, ChevronDown, Download, Headphones, Landmark, Leaf, LoaderCircle, MapPin, Menu, Mountain, Route, Send, Settings2, Sparkles, Square, RotateCcw, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { spots, sources, interests } from '../shared/catalog.mjs';
import './styles.css';
import { ApiSettings } from './ApiSettings';
import { SpotDialog } from './SpotDialog';
import { PlacePhoto } from './PlacePhoto';
import { TourChapters } from './experience/TourChapters';
import './upgrade.css';
import './guideChat.css';
import './contentUpgrade.css';
import { CreativeStudio } from './CreativeStudio';
import { buildBookingLinks } from '../shared/bookingLinks.mjs';
import { GUIDE_COPY } from '../shared/guidePersona.mjs';
import { completedGuideHistory, GuideStreamError, requestGuideStream, type GuideRequest, type GuideSource } from './guideStream';
import { Experience } from './experience/Experience';
import { scrollToId, tilt, useReveal } from './experience/interaction';
import { continueTour, leaveTourForReading, restartTour, returnTourHome, selectTourStation, requestWorldExplore, useTourSession } from './experience/tourSession';

type Prefs = { days: number; budget: number; interests: string[]; pace: string; wishes?: string[]; departureDate?: string };
type Plan = { id: string; title: string; intro: string; preferences: Prefs; modeLabel: string; notice?: string; itinerary: { day: number; title: string; zone: string; date?: string; stops: { spotId: string; time: string; duration: number; reason: string; activities?: string[] }[]; freeTime: string }[]; costs: { lodging: number; meals: number; transport: number; tickets: number; total: number }; budgetStatus: string; budgetNote: string; disclaimer: string };
type Chat = { id: string; role: 'user' | 'guide'; text: string; sources?: GuideSource[]; label?: string; status?: 'greeting' | 'pending' | 'streaming' | 'complete' | 'cancelled' | 'error'; replyTo?: string; request?: GuideRequest; error?: string; retryable?: boolean };
const greeting = (): Chat => ({ id: 'greeting', role: 'guide', text: GUIDE_COPY.greeting, status: 'greeting' });
type Spot = (typeof spots)[number];
const icons: Record<string, typeof Leaf> = { relax: Leaf, culture: Landmark, photo: Camera, explore: Mountain };
const initial: Prefs = { days: 2, budget: 1000, interests: ['relax', 'culture'], pace: 'slow', wishes: ['scenery'] };
const spotById = (id: string) => spots.find(s => s.id === id)!;
const CHAPTERS = [
  { id: 'top', label: '山水' }, { id: 'journey', label: '漫游' }, { id: 'guide', label: '问道' },
  { id: 'plan', label: '行程' }, { id: 'journal', label: '手记' }, { id: 'saved', label: '收藏' },
];
const CHAPTER_IDS = CHAPTERS.map(c => c.id);
const pad = (n: number) => String(n).padStart(2, '0');
async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(135000)]) : AbortSignal.timeout(135000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '服务暂不可用，请稍后再试。');
  return data;
}
function download(name: string, text: string) {
  const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function readSaved(): Plan[] {
  try { const data = JSON.parse(localStorage.getItem('wenshan-plans-v1') || '[]'); return Array.isArray(data) ? data.filter(p => typeof p?.id === 'string' && typeof p.title === 'string' && p.preferences && [1, 2, 3].includes(p.preferences.days) && Number.isFinite(p.preferences.budget) && p.preferences.budget >= 200 && p.preferences.budget <= 3000 && ['slow', 'balanced', 'full'].includes(p.preferences.pace) && Array.isArray(p.preferences.interests) && p.preferences.interests.length > 0 && p.preferences.interests.every((id: unknown) => interests.some(i => i.id === id)) && (p.preferences.wishes === undefined || (Array.isArray(p.preferences.wishes) && p.preferences.wishes.every((id: unknown) => ['wealth', 'romance', 'scenery'].includes(String(id))))) && (p.preferences.departureDate === undefined || (typeof p.preferences.departureDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.preferences.departureDate))) && Array.isArray(p.itinerary) && p.itinerary.every((d: Plan['itinerary'][number]) => Array.isArray(d.stops) && d.stops.every(s => spots.some(p => p.id === s.spotId))) && p.costs).slice(0, 20) : []; } catch { return []; }
}

function App() {
  const tourSession = useTourSession();
  const [chapter, setChapter] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prefs, setPrefs] = useState(initial);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const activePlan = useRef<AbortController | null>(null);
  const [saved, setSaved] = useState(readSaved);
  const [toast, setToast] = useState('');
  const [status, setStatus] = useState<'loading' | 'local' | 'ai' | 'offline'>('loading');
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<Chat[]>(() => [greeting()]);
  const chatState = useRef(chat);
  const chatSequence = useRef(0);
  const activeGuide = useRef<{ controller: AbortController; replyId: string } | null>(null);
  const [guideAnnouncement, setGuideAnnouncement] = useState('');
  const [asking, setAsking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [spotOpen, setSpotOpen] = useState<Spot | null>(null);
  const [worldExploreIntent,setWorldExploreIntent]=useState<'zhengyi'|'tianshi'|'shangqing'|null>(null);
  useEffect(()=>{if(!worldExploreIntent||spotOpen)return;let raf=0;const enter=()=>{if(requestWorldExplore(worldExploreIntent)){setWorldExploreIntent(null);}else raf=requestAnimationFrame(enter);};raf=requestAnimationFrame(()=>{raf=requestAnimationFrame(enter);});return()=>cancelAnimationFrame(raf);},[worldExploreIntent,spotOpen]);
  const spotTrigger = useRef<HTMLElement | null>(null);
  const chatBottom = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useReveal([plan, saved.length]);

  function notify(message: string) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  useEffect(() => { api<{ ai: boolean }>('health').then(r => setStatus(r.ai ? 'ai' : 'local')).catch(() => setStatus('offline')); return () => clearTimeout(toastTimer.current); }, []);
  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: asking ? 'instant' : 'smooth', block: 'nearest' }); }, [chat, asking]);
  useEffect(() => () => { activeGuide.current?.controller.abort(); activeGuide.current = null; window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { if (sourceOpen) modalRef.current?.showModal(); else modalRef.current?.close(); }, [sourceOpen]);
  useEffect(() => {
    if (!guideOpen) { cancelGuide(); window.speechSynthesis?.cancel(); setSpeaking(false); return; }
    const previous = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGuide();
      if (e.key === 'Tab') {
        const nodes = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, a[href]') || []);
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
        if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [guideOpen]);
  useEffect(() => () => activePlan.current?.abort(), []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const onChapter = useCallback((index: number) => setChapter(index), []);
  const openSpot = useCallback((id: string, trigger: HTMLElement) => { spotTrigger.current = trigger; setSpotOpen(spotById(id)); }, []);
  function closeSpot() { setSpotOpen(null); }
  function go(id: string) { setMenuOpen(false); if (id === 'top') returnTourHome(); else if (id === 'journey') continueTour(); else leaveTourForReading(id); }
  function goPlan() { setMenuOpen(false); leaveTourForReading('plan'); }
  function toggleInterest(id: string) { setPrefs(p => ({ ...p, interests: p.interests.includes(id) ? p.interests.filter(i => i !== id) : [...p.interests, id] })); }
  async function generatePlan() {
    if (activePlan.current) return;
    if (!prefs.interests.length) return notify('先选一种你喜欢的旅行方式吧。');
    const controller = new AbortController(); activePlan.current = controller; setPlanning(true);
    try {
      const result = await api<Plan>('plan', { ...prefs, departureDate: prefs.departureDate || undefined }, controller.signal);
      if (controller.signal.aborted || activePlan.current !== controller) return;
      setPlan(result); if (result.notice) notify(result.notice); setTimeout(() => scrollToId('itinerary'), 100);
    } catch (error) { if (!controller.signal.aborted) notify(error instanceof Error ? error.message : '生成失败，请重试。'); }
    finally { if (activePlan.current === controller) { activePlan.current = null; setPlanning(false); } }
  }
  function cancelPlan() { activePlan.current?.abort(); activePlan.current = null; setPlanning(false); notify('已停止等待这次攻略，可调整条件后重新生成。'); }
  function savePlan() {
    if (!plan) return;
    if (saved.some(p => p.id === plan.id)) return notify('这份行程已经在「我的漫游」里了。');
    const next = [plan, ...saved].slice(0, 20);
    try { localStorage.setItem('wenshan-plans-v1', JSON.stringify(next)); setSaved(next); notify('行程已收藏到这台设备。'); } catch { notify('设备存储空间不足，可以下载行程保存。'); }
  }
  function deletePlan(id: string) { const next = saved.filter(p => p.id !== id); try { localStorage.setItem('wenshan-plans-v1', JSON.stringify(next)); setSaved(next); } catch { notify('未能更新收藏，请稍后重试。'); } }
  function exportPlan() {
    if (!plan) return;
    download(`问山-${plan.preferences.days}日漫游.txt`, `${plan.title}\n${plan.intro}\n\n${plan.itinerary.map(d => `第 ${d.day} 天${d.date ? `（${d.date}）` : ''} · ${d.title}\n${d.stops.map(s => `${s.time} ${spotById(s.spotId).name}（约 ${s.duration} 分钟）\n${s.reason}\n${s.activities?.join('\n') || ''}\n${spotById(s.spotId).note}`).join('\n')}\n${d.freeTime}`).join('\n\n')}\n\n示例费用：¥${plan.costs.total}/人\n${plan.budgetNote}\n${plan.disclaimer}\n\n携程关联入口（在携程核对日期、价格后预订）\n${buildBookingLinks(plan).map(link => `${link.label} ${link.url}\n${link.description}`).join('\n')}\n\n资料来源\n${sources.map(s => `${s.title} ${s.url}`).join('\n')}`);
  }
  function updateChat(update: (current: Chat[]) => Chat[]) {
    const next = update(chatState.current);
    chatState.current = next;
    setChat(next);
  }
  function cancelGuide() {
    const active = activeGuide.current;
    if (!active) return;
    activeGuide.current = null;
    active.controller.abort();
    setAsking(false);
    setGuideAnnouncement(GUIDE_COPY.cancelled);
    updateChat(current => current.map(message => message.id === active.replyId ? { ...message, status: 'cancelled', retryable: true } : message));
  }
  function closeGuide() { cancelGuide(); setGuideOpen(false); }
  function clearChat() {
    cancelGuide();
    window.speechSynthesis?.cancel(); setSpeaking(false);
    updateChat(() => [greeting()]); setQuestion(''); setGuideAnnouncement(GUIDE_COPY.clearStatus);
  }
  async function ask(text = question, id = selectedSpot, retry?: Chat) {
    const trimmed = text.trim();
    if (!trimmed || activeGuide.current) return;
    const body: GuideRequest = retry?.request || { question: trimmed, ...(id ? { spotId: id } : {}), history: completedGuideHistory(chatState.current) };
    const replyId = retry?.id || `guide-${++chatSequence.current}`;
    const userId = retry?.replyTo || `user-${chatSequence.current}`;
    const controller = new AbortController();
    activeGuide.current = { controller, replyId };
    window.speechSynthesis?.cancel(); setSpeaking(false);
    setAsking(true); setGuideAnnouncement(GUIDE_COPY.loading);
    if (retry) updateChat(current => current.map(message => message.id === replyId ? { ...message, text: '', status: 'pending', sources: undefined, label: undefined, error: undefined, retryable: undefined } : message));
    else {
      setQuestion('');
      updateChat(current => [...current, { id: userId, role: 'user', text: trimmed }, { id: replyId, role: 'guide', text: '', status: 'pending', replyTo: userId, request: body }]);
    }
    try {
      await requestGuideStream(body, event => {
        if (activeGuide.current?.controller !== controller) return;
        if (event.type === 'meta') {
          const label = event.data.mode === 'local' ? GUIDE_COPY.localModeLabel : `${GUIDE_COPY.modelModeLabel}${event.data.model ? ` · ${event.data.model}` : ''}`;
          updateChat(current => current.map(message => message.id === replyId ? { ...message, label, sources: event.data.sources } : message));
        } else if (event.type === 'delta') {
          setGuideAnnouncement(GUIDE_COPY.sending);
          updateChat(current => current.map(message => message.id === replyId ? { ...message, text: message.text + event.data.text, status: 'streaming' } : message));
        } else if (event.type === 'done') {
          updateChat(current => current.map(message => message.id === replyId ? { ...message, text: event.data.answer ?? message.text, status: 'complete' } : message));
          activeGuide.current = null; setAsking(false); setGuideAnnouncement(GUIDE_COPY.complete);
        }
      }, controller.signal);
    } catch (error) {
      if (activeGuide.current?.controller !== controller || controller.signal.aborted) return;
      const hasPartial = Boolean(chatState.current.find(message => message.id === replyId)?.text);
      const detail = error instanceof GuideStreamError ? error.message : GUIDE_COPY.connectionError;
      updateChat(current => current.map(message => message.id === replyId ? { ...message, status: 'error', error: detail, retryable: !(error instanceof GuideStreamError) || error.retryable } : message));
      setGuideAnnouncement(hasPartial ? GUIDE_COPY.interrupted : GUIDE_COPY.error);
    } finally {
      if (activeGuide.current?.controller === controller) { activeGuide.current = null; setAsking(false); }
    }
  }
  function listenTo(spot: Spot) { setSpotOpen(null); setSelectedSpot(spot.id); setGuideOpen(true); void ask(`请介绍${spot.name}`, spot.id); }
  function planLike(spot: Spot) {
    setSpotOpen(null);
    setPrefs(p => ({ ...p, interests: spot.tags.filter(t => interests.some(i => i.id === t)) }));
    notify(`已按「${spot.name}」的气质预选偏好，可以直接生成行程。`);
    setTimeout(goPlan, 60);
  }
  function speak(text: string) {
    if (!('speechSynthesis' in window)) return notify('当前浏览器不支持语音朗读。');
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => { setSpeaking(false); notify('语音未能播放，请检查浏览器语音支持。'); };
    setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return <>
    <a className="skip-link" href="#plan">跳到行程规划</a>
    <Experience chapterIds={CHAPTER_IDS} onChapter={onChapter} paused={Boolean(spotOpen || guideOpen || apiSettingsOpen || sourceOpen)} onSpot={openSpot} />

    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={() => go('top')} aria-label="问山首页"><img src="/favicon.svg" alt="" /><span>问山<small>WENSHAN · 龙虎山</small></span></button>
      <nav aria-label="章节导航" className={menuOpen ? 'is-open' : ''} id="chapter-nav">
        {CHAPTERS.map((c, i) => <button key={c.id} aria-current={chapter === i ? 'true' : undefined} className={chapter === i ? 'active' : ''} onClick={() => go(c.id)}><small>{pad(i + 1)}</small>{c.label}{c.id === 'saved' && saved.length > 0 && <span className="count">{saved.length}</span>}</button>)}
        <button className="nav-api" onClick={() => { setMenuOpen(false); setApiSettingsOpen(true); }}><Settings2 size={16} />API 设置</button>
      </nav>
      <div className="header-tools">
        <button className="api-settings-trigger" onClick={() => setApiSettingsOpen(true)}><Settings2 size={16} /><span>API 设置</span></button>
        <button className="header-guide" onClick={() => setGuideOpen(true)}><Sparkles size={16} /><span>问问小道士</span></button>
        <button className="menu-toggle icon-button" aria-label={menuOpen ? '关闭章节菜单' : '打开章节菜单'} aria-expanded={menuOpen} aria-controls="chapter-nav" onClick={() => setMenuOpen(o => !o)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </div></header>

    <div className="chapter-rail" aria-hidden="true"><span className="rail-no">{pad(chapter + 1)}</span><span className="rail-line"><i /></span><span className="rail-total">{pad(CHAPTERS.length)}</span><span className="rail-label">{CHAPTERS[chapter].label}</span></div>

    <main>
      <section id="top" className="chapter hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow light"><span className="seal-dot" />江西 · 鹰潭 · 龙虎山<span className="eyebrow-line" /></div>
          <h1 id="hero-title">去山里，<br />找回<em>自己。</em></h1>
          <p>不必赶路，去感受路。<br />让小道士陪你，开启一场刚刚好的山水漫游。</p>
          <div className="hero-actions">
            <button className="cta" onClick={continueTour}>{tourSession.hasProgress ? '继续我的漫游' : '开启我的漫游'}<ArrowDown size={18} /></button>
            <button className="ghost-link" onClick={goPlan}>直接定制行程<ArrowUpRight size={16} /></button>
          </div>
          {tourSession.hasProgress && <button className="hero-restart" onClick={restartTour}>重新出发</button>}
          <ul className="hero-facts"><li><b>中国丹霞</b>世界自然遗产组成地</li><li><b>世界地质公园</b>UNESCO</li><li><b>道文化</b>天师府 · 上清宫</li></ul>
        </div>
        <button className="float-card float-a" onClick={() => selectTourStation('river', 'click')} aria-label="前往泸溪河漫游站点">
          <span className="float-inner" {...tilt}>
            <PlacePhoto spotId="river" />
            <span className="float-copy"><small>01 · 山水区</small><b>泸溪河 · 一筏碧水</b><span>半日清闲，顺流看丹霞</span></span>
            <ArrowUpRight className="float-arrow" size={18} />
          </span>
        </button>
        <button className="float-card float-b" onClick={() => selectTourStation('shangqing', 'click')} aria-label="前往大上清宫漫游站点">
          <span className="float-inner" {...tilt}>
            <PlacePhoto spotId="shangqing" />
            <span className="float-copy"><small>04 · 上清片区</small><b>大上清宫</b><span>走进遗址与保护建筑</span></span>
          </span>
        </button>
        <div className="hero-foot"><span className="scroll-cue"><i />向下 · 入山</span><span className="hero-index">01 <i /> 06</span></div>
      </section>

      <TourChapters onSpot={openSpot} onListen={listenTo} />

      <section id="guide" className="chapter guide-chapter" aria-labelledby="guide-title">
        <div className="guide-panel reveal">
          <div className="guide-portrait"><img src="/guide.svg" alt="小道士导游" /><span>小道士</span></div>
          <div className="guide-copy">
            <div className="chapter-mark dark"><span>03</span>问道 · ASK THE MOUNTAIN</div>
            <h2 id="guide-title">山水很大，<br />幸好有个懂你的搭子。</h2>
            <p>听一段丹霞故事，问一个小小的好奇。小道士陪你读懂眼前的风景，资料出处一并奉上。</p>
            <div className="ask-chips">{GUIDE_COPY.suggestions.map(q => <button key={q} disabled={asking} onClick={() => { setSelectedSpot(''); setGuideOpen(true); void ask(q, ''); }}>{q}</button>)}</div>
            <button className="primary" onClick={() => setGuideOpen(true)}><Sparkles size={16} />和小道士聊聊<ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <section id="plan" className="chapter plan-chapter" aria-labelledby="planner-title">
        <div className="chapter-heading reveal">
          <div className="chapter-mark"><span>04</span>行程 · MAKE ROOM FOR YOURSELF</div>
          <h2 id="planner-title" className="display">这一程，听你的。</h2>
          <p>道友请留步。说说预算、天数和此行心愿，让 AI 安排每日景点、停留与活动；路线范围和费用由规则核对。</p>
        </div>
        <div className="planner panel reveal">
          <div className="planner-heading"><div className="planner-icon"><Route size={22} /></div><div><div className="eyebrow">YOUR NEXT LITTLE ESCAPE</div><h3>定制我的漫游</h3></div><span className="status-badge" role="status"><span className={status === 'offline' ? 'dot offline' : status === 'loading' ? 'dot pending' : 'dot'} />{status === 'loading' ? '连接中' : status === 'ai' ? 'AI 已配置' : status === 'offline' ? '服务未连接' : '本地演示模式'}</span></div>
          <div className="planner-grid">
            <div className="field"><span className="field-label" id="days-label">留几天给山水 <span>01</span></span><div className="segments" role="group" aria-labelledby="days-label">{[1, 2, 3].map(d => <button key={d} aria-pressed={prefs.days === d} className={prefs.days === d ? 'selected' : ''} onClick={() => setPrefs(p => ({ ...p, days: d }))}>{d} 天{d === 2 && <small>刚刚好</small>}</button>)}</div></div>
            <div className="field budget-field"><label className="field-label" htmlFor="budget">每人预算 <span>02</span></label><div className="budget-number"><span>¥ <strong>{prefs.budget.toLocaleString()}</strong></span><span>不含往返大交通</span></div><input id="budget" type="range" min="200" max="3000" step="100" value={prefs.budget} onChange={e => setPrefs(p => ({ ...p, budget: Number(e.target.value) }))} /></div>
            <div className="field"><label className="field-label" htmlFor="pace">用什么节奏旅行 <span>03</span></label><div className="select-wrap"><Leaf size={17} /><select id="pace" value={prefs.pace} onChange={e => setPrefs(p => ({ ...p, pace: e.target.value }))}><option value="slow">慢慢来 · 留白多一点</option><option value="balanced">刚刚好 · 风景都照顾到</option><option value="full">充实些 · 多走多看看</option></select><ChevronDown size={14} /></div></div>
          </div>
          <div className="travel-intentions"><div><span className="field-label" id="wish-label">此行心愿 · 可多选</span><div className="interest-row" role="group" aria-labelledby="wish-label">{[{ id: 'wealth', label: '求财 · 愿事业顺遂' }, { id: 'romance', label: '求姻缘 · 愿相处从容' }, { id: 'scenery', label: '看风景 · 寄情山水' }].map(w => <button key={w.id} className={`chip ${prefs.wishes?.includes(w.id) ? 'chosen' : ''}`} aria-pressed={Boolean(prefs.wishes?.includes(w.id))} data-travel-wish={w.id} onClick={() => setPrefs(p => ({ ...p, wishes: p.wishes?.includes(w.id) ? p.wishes.filter(id => id !== w.id) : [...(p.wishes || []), w.id] }))}>{w.label}</button>)}</div><small className="muted">祈愿作为民俗与个人心意，不承诺功效；参观以现场开放和礼仪为准。</small></div><div><label className="field-label" htmlFor="departure-date">出发日期 <small>选填</small></label><input id="departure-date" type="date" value={prefs.departureDate || ''} onChange={e => setPrefs(p => ({ ...p, departureDate: e.target.value }))} /><small className="muted">用于每日日期与预订核对，收藏会一并保存。</small></div></div>
          <div className="planner-bottom"><div className="interest-row" role="group" aria-label="此刻想要"><span>此刻想要</span>{interests.map(i => { const Icon = icons[i.id]; return <button key={i.id} aria-pressed={prefs.interests.includes(i.id)} className={`chip ${prefs.interests.includes(i.id) ? 'chosen' : ''}`} onClick={() => toggleInterest(i.id)}><Icon size={15} />{i.label}{prefs.interests.includes(i.id) && <Check size={13} />}</button>; })}</div><button className="primary" data-generate-plan disabled={planning} aria-busy={planning} onClick={generatePlan}>{planning ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{planning ? '正在安排这一程…' : plan ? '重新生成行程' : '生成我的专属行程'}<ArrowRight size={17} /></button>{planning && <button className="text-button" onClick={cancelPlan}>取消生成</button>}</div>
        </div>

        {plan && <section id="itinerary" className="itinerary-section panel reveal" aria-labelledby="itinerary-title">
          <div className="section-heading"><div><div className="eyebrow">YOUR NEXT LITTLE ESCAPE</div><h2 id="itinerary-title">{plan.title}</h2></div><div className="inline-actions"><button className="text-button" onClick={savePlan}><Bookmark size={17} />{saved.some(p => p.id === plan.id) ? '已收藏' : '收藏行程'}</button><button className="text-button" onClick={exportPlan}><Download size={17} />下载</button></div></div>
          <div className="plan-intro"><img src="/guide.svg" alt="小道士" /><p>{plan.intro}</p><span className="mode-label">{plan.modeLabel}</span></div>
          {plan.notice && <p className="plan-fallback-notice" role="status">{plan.notice} 可继续使用并收藏，也可返回上方重新生成。</p>}
          <div className="plan-layout"><div className="day-list">{plan.itinerary.map(day => <article className="day-card" key={day.day}><div className="day-heading"><span>DAY <b>{pad(day.day)}</b></span><h3>{day.title}</h3><small>{day.date ? `${day.date} · ` : ''}{day.zone}</small></div><div className="timeline">{day.stops.map((stop, i) => <div className="stop" key={stop.spotId}><div className="stop-time">{stop.time}</div><div className="stop-dot">{i + 1}</div><div className="stop-content"><div><h4>{spotById(stop.spotId).name}</h4><span>约 {stop.duration} 分钟</span></div><p>{stop.reason}</p>{stop.activities?.length ? <ul className="stop-activities">{stop.activities.map((activity, ai) => <li key={ai}>{activity}</li>)}</ul> : null}<small>{spotById(stop.spotId).note}</small></div><button className="icon-button" title={`听${spotById(stop.spotId).name}讲解`} aria-label={`听${spotById(stop.spotId).name}讲解`} onClick={() => listenTo(spotById(stop.spotId))}><Headphones size={18} /></button></div>)}</div><p className="day-note">{day.freeTime}</p></article>)}</div>
            <aside className="cost-card"><div className="eyebrow">TRAVEL BUDGET</div><h3>留一点从容</h3><p className="total-price"><small>¥</small>{plan.costs.total}<span> / 人</span></p><p className="cost-caption">全程示例估算</p>{([['tickets', '游览费用预留'], ['lodging', '住宿预留'], ['meals', '餐饮预留'], ['transport', '当地交通预留']] as const).map(([key, label]) => <div className="cost-line" key={key}><span>{label}</span><strong>¥{plan.costs[key]}</strong></div>)}<div className={`budget-note ${plan.budgetStatus === 'over' ? 'over' : ''}`}>{plan.budgetNote}</div><small>{plan.disclaimer}</small><div className="plan-bookings" aria-label="关联携程预订"><h4>这一程，接着安排</h4>{buildBookingLinks(plan).map(link => <div key={link.id}><a className="booking-link" data-booking={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={16} /></a><small className="muted">{link.description}</small></div>)}<small className="booking-disclosure">跳转携程核对日期、票种与实时价格后预订。这里不展示库存，也不代下单。</small>{plan.preferences.departureDate && <p className="booking-date">出发 {plan.preferences.departureDate} · {plan.preferences.days} 天<br />请在携程再次核对游玩与入住日期。</p>}</div></aside>
          </div>
        </section>}
      </section>

      <section id="journal" className="chapter journal-chapter" aria-labelledby="journal-title">
        <div className="chapter-heading reveal">
          <div className="chapter-mark"><span>05</span>手记 · STORIES WORTH KEEPING</div>
          <h2 id="journal-title" className="display">把这一程，<br />写成自己的故事。</h2>
          <p>一张照片，一点感受。让旅途的余韵，留得久一点。<span className="status-badge inline">{status === 'ai' ? 'AI 共创模式' : '本地模板体验'}</span></p>
        </div>
        <CreativeStudio notify={notify} />
      </section>

      <section id="saved" className="chapter saved-chapter" aria-labelledby="saved-title">
        <div className="chapter-heading reveal">
          <div className="chapter-mark"><span>06</span>收藏 · YOUR PERSONAL COLLECTION</div>
          <h2 id="saved-title" className="display">下一次出发，<br />已经有了方向。</h2>
          <p>收藏在这台设备上的漫游计划，共 {saved.length} 份。</p>
        </div>
        {saved.length ? <div className="saved-grid">{saved.map(p => <article className="saved-card reveal" key={p.id} {...tilt}><div className="saved-illustration"><PlacePhoto spotId="shangqing" /><span>{p.preferences.days} 日漫游</span></div><div className="saved-body"><div className="eyebrow">LONGHUSHAN / WENSHAN</div><h3>{p.title}</h3><p>{p.itinerary.flatMap(d => d.stops.map(s => spotById(s.spotId).name)).join(' · ')}</p><div><button className="text-button" onClick={() => { activePlan.current?.abort(); activePlan.current = null; setPlanning(false); setPlan(p); setPrefs(p.preferences); setTimeout(() => scrollToId('itinerary'), 80); }}>打开行程<ArrowRight size={15} /></button><button className="icon-button" aria-label={`删除收藏：${p.title}`} onClick={() => deletePlan(p.id)}><Trash2 size={16} /></button></div></div></article>)}<button className="saved-new reveal" onClick={goPlan}><Route size={20} />再计划一程<ArrowRight size={16} /></button></div>
          : <div className="empty-saved panel reveal"><Bookmark size={34} strokeWidth={1.2} /><h3>把心动的行程，先收藏起来。</h3><p>生成一份专属行程，再点「收藏行程」，就能在这里找到它。</p><button className="primary" onClick={goPlan}>开始第一程<ArrowRight size={17} /></button></div>}
      </section>
    </main>

    <footer><div className="footer-brand"><img src="/favicon.svg" alt="" /><b>问山</b><span>山水有回响，漫游有方向。</span></div><div><button onClick={() => setSourceOpen(true)}>资料与说明<ArrowUpRight size={13} /></button><span>LONGHUSHAN · 2026</span></div></footer>
    {!guideOpen && <button className="floating-guide" data-content-controls={chapter === 3 || chapter === 4 || undefined} aria-label="打开小道士导游" onClick={() => setGuideOpen(true)}><img src="/guide.svg" alt="" /><span>道友，有何好奇？</span><Sparkles size={15} /></button>}
    {guideOpen && <div className="drawer-backdrop" onClick={closeGuide}>
      <div className="guide-drawer" role="dialog" aria-modal="true" aria-labelledby="guide-drawer-title" ref={drawerRef} onClick={e => e.stopPropagation()}>
        <div className="drawer-header"><img src="/guide.svg" alt="" /><div><h2 id="guide-drawer-title">{GUIDE_COPY.name}</h2><p>{GUIDE_COPY.subtitle}</p></div><button className="icon-button" aria-label={GUIDE_COPY.close} onClick={closeGuide}><X size={21} /></button></div>
        <div className="guide-context"><MapPin size={15} /><select aria-label={GUIDE_COPY.contextLabel} value={selectedSpot} onChange={e => setSelectedSpot(e.target.value)}><option value="">{GUIDE_COPY.generalContext}</option>{spots.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select><button className="guide-clear" onClick={clearChat} aria-label={GUIDE_COPY.clear}><Trash2 size={14} /><span>{GUIDE_COPY.clear}</span></button></div>
        <div className="chat-messages" role="log" aria-label="导游对话" aria-live="polite" aria-relevant="additions text" aria-busy={asking}>
          {chat.map((message, i) => <div className={`chat-message ${message.role} ${message.status || ''}`} key={message.id}>
            {message.role === 'guide' && <span className="chat-avatar" aria-hidden="true">山</span>}
            <div>
              {message.text && <div className="chat-bubble">{message.text}{message.status === 'streaming' && <span className="chat-stream-cursor" aria-hidden="true" />}</div>}
              {message.status === 'pending' && <div className="chat-loading"><LoaderCircle className="spin" size={15} /><span>{GUIDE_COPY.loading}</span></div>}
              {(message.status === 'cancelled' || message.status === 'error') && <div className={`chat-response-status ${message.status}`} role={message.status === 'error' ? 'alert' : 'status'}><span>{message.status === 'cancelled' ? GUIDE_COPY.cancelled : message.text ? GUIDE_COPY.interrupted : GUIDE_COPY.error}</span>{message.error && <small>{message.error}</small>}{message.retryable && message.request && <button disabled={asking} onClick={() => void ask(message.request!.question, message.request!.spotId || '', message)}><RotateCcw size={14} />{GUIDE_COPY.retry}</button>}</div>}
              {message.status === 'complete' && message.sources && message.sources.length > 0 && <details className="chat-source-details"><summary>{GUIDE_COPY.sourcesLabel} · {message.sources.length} 条</summary><div className="chat-sources">{message.sources.map(s => <a href={s.url} target="_blank" rel="noreferrer" key={s.id}>{s.title}<ArrowUpRight size={10} /></a>)}</div></details>}
              {message.role === 'guide' && (message.status === 'complete' || message.status === 'greeting') && <div className="chat-meta"><span>{message.label || GUIDE_COPY.name}</span><button aria-label={`朗读第${i + 1}条讲解`} onClick={() => speak(message.text)}>{speaking ? <VolumeX size={14} /> : <Volume2 size={14} />} {speaking ? GUIDE_COPY.stopListening : GUIDE_COPY.listen}</button></div>}
            </div>
          </div>)}
          <div ref={chatBottom} />
        </div>
        <div className="guide-suggestions">{GUIDE_COPY.suggestions.map(q => <button key={q} disabled={asking} onClick={() => void ask(q)}>{q}</button>)}</div>
        <div className="guide-status-row"><span role="status" aria-live="polite">{guideAnnouncement}</span>{asking && <button className="guide-stop" type="button" onClick={cancelGuide}><Square size={12} fill="currentColor" />{GUIDE_COPY.stop}</button>}</div>
        <form className="chat-form" onSubmit={e => { e.preventDefault(); void ask(); }}><input aria-label="向小道士提问" placeholder={GUIDE_COPY.placeholder} maxLength={500} value={question} onChange={e => setQuestion(e.target.value)} /><button aria-label={GUIDE_COPY.send} disabled={asking || !question.trim()} type="submit"><Send size={18} /><span>{GUIDE_COPY.send}</span></button></form>
        <p className="chat-disclaimer">讲解基于精选资料。实时票务与开放信息请向景区核验。</p>
      </div>
    </div>}
    <dialog ref={modalRef} onCancel={() => setSourceOpen(false)} onClick={e => { if (e.target === modalRef.current) setSourceOpen(false); }}><div className="sources-modal"><button className="icon-button modal-close" aria-label="关闭资料说明" onClick={() => setSourceOpen(false)}><X size={20} /></button><div className="eyebrow">MADE WITH CARE</div><h2>每一个故事，都有出处。</h2><p>问山是龙虎山主题的黑客松 MVP。当前覆盖六个景点或主题活动；照片、模型与地理数据分别标明来源。大上清宫提供实拍照片导览，尚非360°全景或完整内部重建；缺少实拍的地点不使用其他地点图片代替。</p>{sources.map(s => <a className="source-link" key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.title}<ArrowUpRight size={17} /><small>核验日期 {s.checked}</small></a>)}<p>行程时刻、游览时长与费用是规划示例，不代表实时交通、开放时间或实际报价。收藏仅存储在当前浏览器。</p><p>未配置模型时明确使用本地规则与模板。AI 攻略会根据偏好编排行程；照片共创将文字、所选地点和照片尺寸发给模型，原照片留在本机。海报与短片采用 AI 创意参数编排照片及动效，不是实景转绘或视频模型生成。携程入口关联具体景区和住宿页面，实时价格与下单在携程完成。</p></div></dialog>
    {spotOpen && <SpotDialog spot={spotOpen} returnFocusTo={spotTrigger.current} onClose={closeSpot} onExploreInScene={id=>{setSpotOpen(null);setWorldExploreIntent(id);}} onGuide={listenTo} onPlan={planLike} />}
    {apiSettingsOpen && <ApiSettings onClose={() => setApiSettingsOpen(false)} onSaved={configured => setStatus(configured ? 'ai' : 'local')} />}
    {toast && <div className="toast" role="status"><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><X size={15} /></button></div>}
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
