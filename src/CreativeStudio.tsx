import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Copy, Download, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Square, Trash2, Video } from 'lucide-react';
import { spots } from '../shared/catalog.mjs';
import { CREATIVE_DISCLOSURE } from '../shared/creativeContract.mjs';
import { buildCreativeRequest, createPhotoVideo, createPoster, getVideoSupport, loadLocalPhoto, requestCreativeDraft, validateCreativeParameters,
  type CreativeDraft, type CreativeParameters, type LocalPhoto } from './creativeMedia';
import './creativeStudio.css';

type Asset = { url: string; extension: string };
type Action = 'all' | 'media' | 'video';
type Phase = 'idle' | 'writing' | 'poster' | 'recording';
type ActiveJob = { id: number; action: Action; controller: AbortController };
const themeNames = { mist: '山间流云', moon: '月下清游', ink: '墨意留白' };
const motionNames = { drift: '缓缓漂移', rise: '轻轻上升', pan: '横向漫游' };
const filename = (title: string) => (title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 45) || '问山-山水手记');

export function CreativeStudio({ notify }: { notify: (message: string) => void }) {
  const [selectedSpots, setSelectedSpots] = useState(['river', 'elephant']);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [draft, setDraft] = useState<CreativeDraft | null>(null);
  const [poster, setPoster] = useState<Asset | null>(null);
  const [video, setVideo] = useState<Asset | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [retryAction, setRetryAction] = useState<Action | null>(null);
  const [tab, setTab] = useState<'photo' | 'poster' | 'video'>('photo');
  const [mediaDirty, setMediaDirty] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = useRef<ActiveJob | null>(null);
  const activeUpload = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const mounted = useRef(true);
  const photoRef = useRef(photo); photoRef.current = photo;
  const temporaryDownloads = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const support = useMemo(() => getVideoSupport(), []);
  const busy = phase !== 'idle';
  const journalText = draft ? [draft.title, draft.content, draft.tags.map(tag => '#' + tag).join(' ')].join('\n\n') : '';

  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; ++sequence.current; active.current?.controller.abort(); activeUpload.current?.abort();
    videoRef.current?.pause();
    for (const [url, timer] of temporaryDownloads.current) { clearTimeout(timer); URL.revokeObjectURL(url); }
    temporaryDownloads.current.clear();
  }; }, []);
  useEffect(() => () => photo?.release(), [photo]);
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster.url); }, [poster]);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  function cancel(message = '已取消共创。已完成的文案和海报可继续使用。') {
    const previous = active.current;
    ++sequence.current; active.current = null; previous?.controller.abort(); videoRef.current?.pause();
    if (!mounted.current) return;
    setPhase('idle'); setProgress(0);
    if (previous) { setAnnouncement(message); setRetryAction(previous.action); setError(''); }
  }
  function clearMedia() { videoRef.current?.pause(); setPoster(null); setVideo(null); setMediaDirty(false); }
  async function choosePhoto(file?: File) {
    if (!file) return;
    cancel('照片已更换，上一轮共创已取消。');
    activeUpload.current?.abort();
    const controller = new AbortController(); activeUpload.current = controller;
    setReadingPhoto(true); setError(''); setRetryAction(null);
    try {
      const next = await loadLocalPhoto(file, controller.signal);
      if (!mounted.current || activeUpload.current !== controller) { next.release(); return; }
      clearMedia(); setPhoto(next); setDraft(null); setTab('photo');
      setAnnouncement('原照片已准备好，只在当前浏览器处理。');
    } catch (problem) {
      if (!mounted.current || activeUpload.current !== controller || controller.signal.aborted) return;
      setError(problem instanceof Error ? problem.message : '照片未能读取，请重试。');
    } finally {
      if (activeUpload.current === controller) { activeUpload.current = null; if (mounted.current) setReadingPhoto(false); }
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }
  function removePhoto() {
    cancel(); activeUpload.current?.abort(); activeUpload.current = null; setReadingPhoto(false);
    clearMedia(); setPhoto(null); setDraft(null); setTab('photo'); setError(''); setRetryAction(null);
    setAnnouncement('照片已移除，仍可独立生成山水手记。');
  }
  function updateCreative(key: 'headline' | 'subtitle', value: string) {
    if (!draft?.creative) return;
    setDraft({ ...draft, creative: { ...draft.creative, [key]: value } }); setMediaDirty(true);
  }
  function updateCaption(index: number, value: string) {
    if (!draft?.creative) return;
    const captions = [...draft.creative.shotCaptions] as CreativeParameters['shotCaptions']; captions[index] = value;
    setDraft({ ...draft, creative: { ...draft.creative, shotCaptions: captions } }); setMediaDirty(true);
  }
  async function run(action: Action = 'all') {
    if (active.current || readingPhoto) return;
    if (!selectedSpots.length) { setError('至少选择一个想记录的地点。'); return; }
    if (action !== 'all' && (!photo || !draft?.creative)) { setError('先选择照片并生成创意，再导出作品。'); return; }
    const currentPhoto = photo;
    const job: ActiveJob = { id: ++sequence.current, action, controller: new AbortController() };
    active.current = job;
    const isCurrent = () => mounted.current && active.current === job && sequence.current === job.id && photoRef.current === currentPhoto && !job.controller.signal.aborted;
    setError(''); setRetryAction(null); setAnnouncement(''); setProgress(0);
    if (action !== 'video') { clearMedia(); if (action === 'all') setDraft(null); }
    else { videoRef.current?.pause(); setVideo(null); }
    setPhase(action === 'all' ? 'writing' : action === 'media' ? 'poster' : 'recording');
    try {
      let result = draft;
      if (action === 'all') {
        result = await requestCreativeDraft(buildCreativeRequest(selectedSpots, notes, currentPhoto || undefined), job.controller.signal);
        if (!isCurrent()) return;
        setDraft(result); setProgress(26);
        if (result.notice) notify(result.notice);
      }
      if (!result) throw new Error('未获得文案，请重试。');
      if (!currentPhoto) { setAnnouncement('山水手记已生成。选择自己的照片，还能共创海报和 12 秒短片。'); return; }
      if (!result.creative || !validateCreativeParameters(result.creative))
        throw new Error('文案已保留，但画面创意参数不完整，请重新共创。');
      if (action !== 'video') {
        setPhase('poster'); setProgress(30);
        const blob = await createPoster(currentPhoto, result, job.controller.signal);
        if (!isCurrent()) return;
        setPoster({ url: URL.createObjectURL(blob), extension: 'png' }); setTab('poster'); setProgress(38); setMediaDirty(false);
      }
      if (!support.supported) { setAnnouncement('海报与文案已完成。' + support.reason); return; }
      setPhase('recording'); setTab('video');
      let lastPercent = -1;
      const generated = await createPhotoVideo(currentPhoto, result, {
        signal: job.controller.signal,
        onProgress: value => {
          if (!isCurrent()) return;
          const percent = Math.round(38 + value * 61);
          if (percent !== lastPercent) { lastPercent = percent; setProgress(percent); }
        },
        onPreview: canvas => {
          const preview = previewRef.current;
          if (!isCurrent() || !preview) return;
          preview.getContext('2d')?.drawImage(canvas, 0, 0, preview.width, preview.height);
        },
      });
      if (!isCurrent()) return;
      setVideo({ url: URL.createObjectURL(generated.blob), extension: generated.extension }); setProgress(100); setMediaDirty(false);
      setAnnouncement('共创完成：文案、海报与 12 秒照片动效短片已准备好。');
    } catch (problem) {
      if (!isCurrent()) return;
      setError(problem instanceof Error ? problem.message : '共创未完成，请重试。');
      setRetryAction(action === 'all' && !currentPhoto ? 'all' : action === 'all' && !draft ? 'all' : action);
      // Keep completed items, but never present a partially recorded video as an export.
      if (action === 'video' || action === 'media') setRetryAction(action);
    } finally {
      if (active.current === job) { active.current = null; if (mounted.current) setPhase('idle'); }
    }
  }
  async function copyText() {
    if (!journalText) return;
    try { await navigator.clipboard.writeText(journalText); notify('手记文案已复制。'); }
    catch {
      const area = document.createElement('textarea'); area.value = journalText; area.className = 'creative-copy-buffer'; document.body.appendChild(area); area.select();
      let copied = false; try { copied = typeof document.execCommand === 'function' && document.execCommand('copy'); } catch { copied = false; } finally { area.remove(); }
      notify(copied ? '手记文案已复制。' : '浏览器未允许复制，请选中文案后手动复制。');
    }
  }
  function downloadText() {
    if (!draft) return;
    const text = journalText + '\n\n生成内容 · ' + draft.modeLabel + '\n' + (draft.disclosure || CREATIVE_DISCLOSURE);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename(draft.title) + '.txt'; link.click();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); temporaryDownloads.current.delete(url); }, 1200);
    temporaryDownloads.current.set(url, timer);
  }
  const phaseLabel = phase === 'writing' ? '正在编排文案与画面创意…' : phase === 'poster' ? '正在绘制你的山水海报…' : '正在导出 12 秒短片，请保持页面在前台…';

  return <div className="creative-studio">
    <div className="creative-intro"><span className="creative-eyebrow"><Sparkles size={15} />照片共创工坊</span><p>把自己的照片，留成一页山水、一段流云。</p></div>
    <div className="creative-layout">
      <div className="creative-input">
        <div className="creative-step"><span>01</span><div><h3>带一张自己的照片</h3><p>JPG / PNG / WebP · 20 MB 以内</p></div></div>
        <input ref={uploadRef} className="creative-file" id="creative-photo-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={readingPhoto}
          onChange={event => void choosePhoto(event.target.files?.[0])} />
        <label className={'creative-upload ' + (photo ? 'has-photo' : '')} htmlFor="creative-photo-file" aria-busy={readingPhoto}>
          {readingPhoto ? <LoaderCircle size={26} className="spin" /> : <ImagePlus size={28} strokeWidth={1.3} />}
          <strong>{readingPhoto ? '正在读取原片…' : photo ? '换一张照片' : '选择本地照片'}</strong>
          <small>{photo ? photo.name : '原照片只留在此页面，不会上传'}</small>
        </label>
        {photo && <div className="creative-photo-meta"><span>{photo.width} × {photo.height} · 原片</span><button type="button" onClick={removePhoto}><Trash2 size={13} />移除照片</button></div>}

        <fieldset className="creative-spots" disabled={busy}>
          <legend><span>02</span>这一程，在哪里</legend>
          <div>{spots.map(spot => <label key={spot.id} className={selectedSpots.includes(spot.id) ? 'selected' : ''}>
            <input type="checkbox" checked={selectedSpots.includes(spot.id)} onChange={() => setSelectedSpots(current => current.includes(spot.id) ? current.filter(id => id !== spot.id) : [...current, spot.id])} />
            {selectedSpots.includes(spot.id) && <Check size={12} />}<span>{spot.name}</span>
          </label>)}</div>
        </fieldset>
        <label className="creative-notes"><span><b>03</b>留一点此刻的感受</span><textarea value={notes} disabled={busy} maxLength={600} rows={4}
          onChange={event => setNotes(event.target.value)} placeholder="今天看见的风景、想留住的心情，或希望画面呈现的气质…" /><small>{notes.length}/600 · 仅文字和照片尺寸参与创意编排</small></label>
        <button type="button" className="creative-generate" disabled={busy || readingPhoto || !selectedSpots.length} onClick={() => void run('all')}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}{busy ? '正在共创…' : photo ? '一键共创文案、海报与短片' : '生成我的山水手记'}
        </button>
        {!photo && <p className="creative-small-note">没有照片，也可以先生成并编辑文案。</p>}
        <p className="creative-privacy">{CREATIVE_DISCLOSURE}</p>
      </div>

      <div className="creative-output">
        <div className="creative-preview-heading"><div><span className="creative-eyebrow">YOUR STORY, YOUR PHOTO</span><h3>{photo ? '这一刻，是你的山水。' : '作品，从你的原片开始。'}</h3></div>{draft && <span className={'creative-mode ' + draft.mode}>{draft.modeLabel}</span>}</div>
        <div className="creative-tabs" role="tablist" aria-label="作品预览">
          <button type="button" role="tab" aria-selected={tab === 'photo'} aria-controls="creative-preview" id="creative-tab-photo" onClick={() => setTab('photo')}><Camera size={14} />原照片</button>
          <button type="button" role="tab" aria-selected={tab === 'poster'} aria-controls="creative-preview" id="creative-tab-poster" disabled={!poster} onClick={() => setTab('poster')}><ImagePlus size={14} />海报</button>
          <button type="button" role="tab" aria-selected={tab === 'video'} aria-controls="creative-preview" id="creative-tab-video" disabled={!video && phase !== 'recording'} onClick={() => setTab('video')}><Video size={14} />12 秒短片</button>
        </div>
        <div className="creative-preview" id="creative-preview" role="tabpanel" aria-labelledby={'creative-tab-' + tab}>
          {tab === 'photo' && photo ? <img src={photo.url} alt="你选择的原照片，仅在此浏览器使用" className="creative-original" /> :
           tab === 'poster' && poster ? <img src={poster.url} alt={'生成海报：' + (draft?.creative?.headline || '你的山水')} /> :
           tab === 'video' && video ? <video ref={videoRef} src={video.url} controls playsInline preload="metadata" poster={poster?.url} aria-label="生成的12秒照片动效短片" onError={() => setError('当前浏览器未能播放此视频，可下载后使用本机播放器打开。')} /> :
           tab === 'video' && phase === 'recording' ? <canvas ref={previewRef} width={720} height={960} aria-label="短片实时绘制预览" /> :
           <div className="creative-empty"><span className="creative-empty-seal">山</span><h4>一张原片，一段余韵。</h4><p>选择自己的照片，流云、题字与缓慢动效将围绕这张原片展开。</p><span>原片 · 海报 PNG · 12 秒短片</span></div>}
          {(poster || video) && tab !== 'photo' && <span className="creative-preview-label">生成内容 · {draft?.mode === 'ai' ? 'AI' : '本地'}创意编排 · 照片动效{mediaDirty ? ' · 待更新' : ''}</span>}
        </div>
        {busy && <div className="creative-progress" role="status" aria-live="polite"><div><span>{phaseLabel}</span><button type="button" onClick={() => cancel()}><Square size={11} fill="currentColor" />取消</button></div><progress max={100} value={phase === 'writing' ? undefined : progress} aria-label={phaseLabel} /><small>{phase === 'writing' ? '画面参数由文字与所选地点编排，原照片不发送给模型。' : Math.round(progress) + '% · 实际照片合成'}</small></div>}
        {error && <div className="creative-feedback error" role="alert"><p>{error}</p>{retryAction && !busy && <button type="button" onClick={() => void run(retryAction)}><RotateCcw size={14} />重试{retryAction === 'video' ? '短片导出' : retryAction === 'media' ? '作品导出' : '共创'}</button>}</div>}
        {announcement && !busy && <div className="creative-feedback" role="status"><p>{announcement}</p>{retryAction && !error && <button type="button" onClick={() => void run(retryAction)}><RotateCcw size={14} />继续共创</button>}</div>}
        {!support.supported && <p className="creative-support-note">{support.reason}</p>}
        {(poster || video) && <div className="creative-downloads">
          {poster && <a href={mediaDirty ? undefined : poster.url} download={filename(draft?.creative?.headline || '问山-海报') + '.png'} aria-disabled={mediaDirty}><Download size={15} />海报 PNG<small>1080 × 1440</small></a>}
          {video && <a href={mediaDirty ? undefined : video.url} download={filename(draft?.creative?.headline || '问山-短片') + '.' + video.extension} aria-disabled={mediaDirty}><Download size={15} />12 秒短片<small>{video.extension.toUpperCase()} · 无声</small></a>}
        </div>}
        {draft?.creative && photo && !busy && <button className="creative-refresh" type="button" onClick={() => void run(mediaDirty || !poster ? 'media' : 'video')}><RotateCcw size={14} />{mediaDirty ? '按修改后的题字重新导出' : video ? '重新导出短片' : '导出 / 重试短片'}</button>}
      </div>
    </div>

    {draft && <div className="creative-journal">
      <div className="creative-journal-heading"><div><span className="creative-eyebrow">WORDS TO KEEP</span><h3>故事，由你落笔。</h3></div><span className="creative-mode">{draft.modeLabel} · 可编辑</span></div>
      {draft.notice && <p className="creative-model-notice">{draft.notice}</p>}
      <label className="creative-edit-title">手记标题<input value={draft.title} maxLength={160} disabled={busy} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="creative-edit-content">手记正文<textarea value={draft.content} rows={6} maxLength={6000} disabled={busy} onChange={event => setDraft({ ...draft, content: event.target.value })} /></label>
      <label className="creative-edit-tags">话题标签<input value={draft.tags.map(tag => '#' + tag).join(' ')} maxLength={210} disabled={busy}
        onChange={event => { setDraft({ ...draft, tags: event.target.value.split(/[\s,，]+/).map(tag => tag.replace(/^#/, '')).filter(Boolean).slice(0, 8) }); setMediaDirty(true); }} /></label>
      {draft.creative && <details className="creative-caption-editor"><summary>编辑画面题字与三段字幕{mediaDirty && <span>待重新导出</span>}</summary>
        <div className="creative-recipe"><span>{themeNames[draft.creative.theme]}</span><span>{motionNames[draft.creative.motion]}</span><span>12 秒 · 原片动效</span></div>
        <label>画面主标题<input value={draft.creative.headline} disabled={busy} maxLength={40} onChange={event => updateCreative('headline', event.target.value)} /></label>
        <label>画面副标题<input value={draft.creative.subtitle} disabled={busy} maxLength={80} onChange={event => updateCreative('subtitle', event.target.value)} /></label>
        <div className="creative-captions">{draft.creative.shotCaptions.map((caption, index) => <label key={index}>{index * 4}–{(index + 1) * 4} 秒字幕<input value={caption} disabled={busy} maxLength={24} onChange={event => updateCaption(index, event.target.value)} /></label>)}</div>
        <small>修改题字、字幕或标签后，重新导出可更新海报和短片。</small>
      </details>}
      <div className="creative-text-actions"><button type="button" onClick={() => void copyText()}><Copy size={15} />复制文案</button><button type="button" onClick={downloadText}><Download size={15} />下载手记 TXT</button></div>
      <p className="creative-small-note">生成内容请按自己的经历核对后分享。{draft.mode === 'local' ? '当前使用本地创意规则与模板。' : 'AI 根据你提供的文字编排创意，未读取照片内容。'}</p>
    </div>}
  </div>;
}
