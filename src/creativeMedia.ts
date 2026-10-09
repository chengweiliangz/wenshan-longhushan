export const POSTER_SIZE = { width: 1080, height: 1440 } as const;
export const VIDEO_SIZE = { width: 720, height: 960 } as const;
export const VIDEO_DURATION = 12;
export const VIDEO_FPS = 24;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const CREATIVE_MEDIA_LABEL = 'AI创意编排 · 照片动效';

export type CreativeParameters = {
  theme: 'mist' | 'moon' | 'ink'; headline: string; subtitle: string; palette: 'jade' | 'indigo' | 'ochre';
  fog: number; shotCaptions: [string, string, string]; motion: 'drift' | 'rise' | 'pan'; duration: 12;
};
export type CreativeDraft = {
  title: string; content: string; tags: string[]; mode: 'ai' | 'local'; modeLabel: string;
  notice?: string; disclosure?: string; creative?: CreativeParameters;
};
export type PhotoMeta = { width: number; height: number; type: string };
export type LocalPhoto = PhotoMeta & { image: HTMLImageElement; url: string; name: string; release: () => void };
export type CreativeRequest = { spotIds: string[]; mood: 'poetic'; notes: string; creative: true; photoMeta?: PhotoMeta };
export type VideoSupport = { supported: boolean; mimeType: string; extension: 'webm' | 'mp4'; reason: string };

function abortError() { return new DOMException('已取消生成。', 'AbortError'); }
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw abortError(); }
function textField(value: unknown, maximum: number): string | null {
  return typeof value === 'string' && value.trim() && value.trim().length <= maximum ? value.trim() : null;
}
export function validateCreativeParameters(value: unknown): CreativeParameters | null {
  if (!value || typeof value !== 'object') return null;
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).some(key => !['theme', 'headline', 'subtitle', 'palette', 'fog', 'shotCaptions', 'motion', 'duration'].includes(key))) return null;
  const headline = textField(fields.headline, 40), subtitle = textField(fields.subtitle, 80);
  if (!headline || !subtitle || !['mist', 'moon', 'ink'].includes(fields.theme as string) ||
      !['jade', 'indigo', 'ochre'].includes(fields.palette as string) || !['drift', 'rise', 'pan'].includes(fields.motion as string) ||
      typeof fields.fog !== 'number' || !Number.isFinite(fields.fog) || fields.fog < 0 || fields.fog > 0.5 || fields.duration !== VIDEO_DURATION ||
      !Array.isArray(fields.shotCaptions) || fields.shotCaptions.length !== 3) return null;
  const captions = fields.shotCaptions.map(caption => textField(caption, 24));
  if (captions.some(caption => !caption)) return null;
  return { theme: fields.theme as CreativeParameters['theme'], headline, subtitle, palette: fields.palette as CreativeParameters['palette'],
    fog: fields.fog, shotCaptions: captions as [string, string, string], motion: fields.motion as CreativeParameters['motion'], duration: 12 };
}
export function parseCreativeDraft(value: unknown): CreativeDraft {
  if (!value || typeof value !== 'object') throw new Error('创意回复格式有误，请重试。');
  const fields = value as Record<string, unknown>;
  const title = textField(fields.title, 160), content = textField(fields.content, 6000), modeLabel = textField(fields.modeLabel, 100);
  if (!title || !content || !modeLabel || (fields.mode !== 'ai' && fields.mode !== 'local') || !Array.isArray(fields.tags))
    throw new Error('创意回复不完整，请重试。');
  const tags = fields.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map(tag => tag.trim().replace(/^#/, '').slice(0, 24)).slice(0, 8);
  const creative = validateCreativeParameters(fields.creative);
  return { title, content, tags, mode: fields.mode, modeLabel, ...(typeof fields.notice === 'string' ? { notice: fields.notice } : {}),
    ...(typeof fields.disclosure === 'string' ? { disclosure: fields.disclosure } : {}), ...(creative ? { creative } : {}) };
}
// Neither file bytes, names, object URLs nor EXIF can enter the API body.
export function buildCreativeRequest(spotIds: string[], notes: string, photo?: PhotoMeta): CreativeRequest {
  const result: CreativeRequest = { spotIds: [...new Set(spotIds)].slice(0, 6), mood: 'poetic', notes: notes.trim().slice(0, 600), creative: true };
  if (photo) result.photoMeta = { width: photo.width, height: photo.height, type: photo.type };
  return result;
}
export async function requestCreativeDraft(body: CreativeRequest, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<CreativeDraft> {
  checkAbort(signal);
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 135000);
  try {
    const response = await fetcher('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCreativeRequest(body.spotIds, body.notes, body.photoMeta)), signal: controller.signal });
    checkAbort(signal);
    let data: unknown;
    try { data = await response.json(); } catch { throw new Error('创意服务未返回有效内容，请重试。'); }
    checkAbort(signal);
    if (!response.ok) {
      const detail = data && typeof data === 'object' && typeof (data as Record<string, unknown>).error === 'string' ? String((data as Record<string, unknown>).error) : '创意服务暂不可用，请重试。';
      throw new Error(detail);
    }
    return parseCreativeDraft(data);
  } catch (error) {
    if (signal.aborted) throw abortError();
    if (timedOut) throw new Error('创意生成超时，请重试。');
    throw error;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
export function loadLocalPhoto(file: File, signal?: AbortSignal): Promise<LocalPhoto> {
  checkAbort(signal);
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return Promise.reject(new Error('请选择 JPG、PNG 或 WebP 照片；HEIC 可先转换为 JPG。'));
  if (file.size > MAX_PHOTO_BYTES || file.size === 0) return Promise.reject(new Error('请选择 20 MB 以内的有效照片。'));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let released = false, settled = false;
    const release = () => { if (!released) { released = true; image.removeAttribute('src'); URL.revokeObjectURL(url); } };
    const cleanup = () => { image.onload = null; image.onerror = null; signal?.removeEventListener('abort', abort); };
    const fail = (error: Error) => { if (settled) return; settled = true; cleanup(); release(); reject(error); };
    const abort = () => fail(abortError());
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      if (signal?.aborted) return abort();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 20000 || image.naturalHeight > 20000 || image.naturalWidth * image.naturalHeight > 50_000_000)
        return fail(new Error('照片尺寸过大或无法读取，请选择单边 2 万像素、总计 5000 万像素以内的照片。'));
      settled = true; cleanup();
      resolve({ image, url, name: file.name, width: image.naturalWidth, height: image.naturalHeight, type: file.type, release });
    };
    image.onerror = () => fail(new Error('浏览器无法读取这张照片，请换一张 JPG 或 PNG。'));
    image.src = url;
  });
}
export function getVideoSupport(): VideoSupport {
  const unavailable = (reason: string): VideoSupport => ({ supported: false, mimeType: '', extension: 'webm', reason });
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function')
    return unavailable('当前浏览器不支持照片短片录制，可下载海报和文案；请使用新版 Chrome 或 Edge 导出视频。');
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function')
    return unavailable('当前浏览器不支持视频文件导出，可下载海报和文案；请使用新版 Chrome 或 Edge 导出视频。');
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
  return mimeType ? { supported: true, mimeType, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm', reason: '' }
    : unavailable('当前浏览器没有可用的视频编码格式，可下载海报和文案；请使用新版 Chrome 或 Edge 导出视频。');
}
export function getMotionTransform(motion: CreativeParameters['motion'], seconds: number) {
  const progress = Math.max(0, Math.min(1, seconds / VIDEO_DURATION));
  const eased = progress * progress * (3 - 2 * progress);
  return { scale: 1.045 + eased * 0.055, x: motion === 'pan' ? (eased - 0.5) * 46 : Math.sin(progress * Math.PI * 2) * 12,
    y: motion === 'rise' ? 25 - eased * 50 : Math.cos(progress * Math.PI * 2) * 10 };
}
export function getShotAt(seconds: number) {
  const time = Math.max(0, Math.min(VIDEO_DURATION - 0.001, seconds));
  const index = Math.min(2, Math.floor(time / 4));
  const local = time - index * 4;
  const opacity = Math.min(1, local / 0.55, (4 - local) / 0.55);
  return { index, opacity: Math.max(0, opacity), local };
}
const serif = '"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif';
const sans = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const palettes = {
  jade: { dark: '#102a25', tint: '#3c6558', paper: '#f6f0df', gold: '#d5bf87' },
  indigo: { dark: '#15232e', tint: '#46576a', paper: '#f3f0e8', gold: '#b6c8bd' },
  ochre: { dark: '#2e2b20', tint: '#78704d', paper: '#f5eedb', gold: '#e1bf86' },
};
function wrapLines(ctx: CanvasRenderingContext2D, value: string, width: number, maxLines: number): string[] {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    if (ctx.measureText(line + chars[i]).width > width && line) {
      lines.push(line); line = '';
      if (lines.length === maxLines) { let last = lines[maxLines - 1]; while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1); lines[maxLines - 1] = last + '…'; return lines; }
    }
    line += chars[i];
  }
  if (line) lines.push(line);
  return lines;
}
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, width: number, lines = 1, family = serif) {
  ctx.font = '400 ' + size + 'px ' + family;
  wrapLines(ctx, text, width, lines).forEach((line, index) => ctx.fillText(line, x, y + index * size * 1.3));
}
export function renderCreativeFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, creative: CreativeParameters,
  mode: CreativeDraft['mode'], seconds = 0, poster = false, tags: string[] = []) {
  const w = 1080, h = 1440, palette = palettes[creative.palette];
  const motion = getMotionTransform(creative.motion, poster ? 3 : seconds);
  ctx.save(); ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.fillStyle = palette.dark; ctx.fillRect(0, 0, w, h);
  const cover = Math.max(w / image.naturalWidth, h / image.naturalHeight) * motion.scale;
  const imageW = image.naturalWidth * cover, imageH = image.naturalHeight * cover;
  ctx.drawImage(image, (w - imageW) / 2 + motion.x, (h - imageH) / 2 + motion.y, imageW, imageH);
  const veil = ctx.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, palette.dark + '90'); veil.addColorStop(0.25, palette.dark + '08');
  veil.addColorStop(0.56, palette.dark + '28'); veil.addColorStop(0.74, palette.dark + 'c0'); veil.addColorStop(1, palette.dark);
  ctx.fillStyle = veil; ctx.fillRect(0, 0, w, h);
  // Procedural clouds and ink never replace the visitor's photo.
  for (let i = 0; i < 4; i++) {
    const drift = Math.sin(seconds * 0.18 + i) * 75;
    const cloud = ctx.createRadialGradient(160 + i * 255 + drift, 760 + i * 105, 2, 160 + i * 255 + drift, 760 + i * 105, 390);
    const alpha = Math.round((creative.fog * (creative.theme === 'mist' ? 0.48 : 0.26)) * 255).toString(16).padStart(2, '0');
    cloud.addColorStop(0, palette.paper + alpha); cloud.addColorStop(1, palette.paper + '00');
    ctx.fillStyle = cloud; ctx.fillRect(0, 460, w, 730);
  }
  if (creative.theme === 'moon') {
    const moon = ctx.createRadialGradient(827, 279, 0, 827, 279, 60);
    moon.addColorStop(0, palette.paper + 'b0'); moon.addColorStop(0.5, palette.paper + '22'); moon.addColorStop(1, palette.paper + '00');
    ctx.fillStyle = moon; ctx.fillRect(767, 219, 120, 120);
    ctx.beginPath(); ctx.arc(827, 279, 18, 0, Math.PI * 2); ctx.fillStyle = palette.paper + 'bb'; ctx.fill();
  }
  if (creative.theme === 'ink') {
    ctx.strokeStyle = palette.dark + '6b'; ctx.lineWidth = 28;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-80, 970 + i * 23); ctx.bezierCurveTo(310, 820 + i * 17, 700, 1170 + i * 16, 1170, 900 + i * 29); ctx.stroke(); }
  }
  ctx.lineWidth = 1.6; ctx.strokeStyle = palette.gold + 'a0'; ctx.strokeRect(49, 49, 982, 1342);
  ctx.strokeStyle = palette.gold + '40'; ctx.strokeRect(61, 61, 958, 1318);
  ctx.fillStyle = palette.paper; drawText(ctx, '问山  /  龙虎山', 91, 127, 29, 500, 1, sans);
  ctx.font = '400 19px ' + sans; ctx.fillStyle = palette.paper + 'bd'; ctx.fillText('WENSHAN · A MOMENT IN THE MOUNTAINS', 91, 163);
  ctx.fillStyle = palette.dark + 'da'; ctx.fillRect(91, 191, 373, 43);
  ctx.fillStyle = palette.paper; drawText(ctx, mode === 'ai' ? '生成内容 · AI创意编排' : '生成内容 · 本地创意编排', 107, 220, 21, 346, 1, sans);
  ctx.fillStyle = palette.gold; ctx.fillRect(93, 972, 54, 2);
  drawText(ctx, creative.theme === 'moon' ? '月色入怀  /  山水成诗' : creative.theme === 'ink' ? '一笔入山  /  墨意留白' : '云起山间  /  留一刻清闲', 94, 1015, 22, 850, 1, sans);
  let headlineSize = 66;
  do { ctx.font = '400 ' + headlineSize + 'px ' + serif; if (ctx.measureText(creative.headline).width <= 1784 || headlineSize <= 42) break; headlineSize -= 2; } while (true);
  ctx.fillStyle = palette.paper; drawText(ctx, creative.headline, 88, 1090, headlineSize, 892, 2);
  let subtitleSize = 27;
  do { ctx.font = '400 ' + subtitleSize + 'px ' + serif; if (ctx.measureText(creative.subtitle).width <= 1744 || subtitleSize <= 18) break; subtitleSize -= 1; } while (true);
  ctx.fillStyle = palette.paper + 'c8'; drawText(ctx, creative.subtitle, 94, 1220, subtitleSize, 872, 2);
  if (poster) {
    ctx.fillStyle = palette.gold + 'dc'; drawText(ctx, tags.slice(0, 4).map(tag => '#' + tag).join('  '), 94, 1314, 22, 890, 1, sans);
  } else {
    const shot = getShotAt(seconds); ctx.globalAlpha = shot.opacity; ctx.fillStyle = palette.gold;
    drawText(ctx, creative.shotCaptions[shot.index], 94, 1314, 27, 875, 1); ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i === shot.index ? palette.gold : palette.paper + '40'; ctx.fillRect(865 + i * 33, 975, 23, 3); }
  }
  ctx.fillStyle = palette.paper + 'aa';
  drawText(ctx, mode === 'ai' ? CREATIVE_MEDIA_LABEL : '本地创意编排 · 照片动效', 94, 1363, 18, 780, 1, sans);
  ctx.restore();
}
export async function createPoster(photo: LocalPhoto, draft: CreativeDraft, signal?: AbortSignal): Promise<Blob> {
  checkAbort(signal);
  if (!draft.creative) throw new Error('未收到有效的画面创意参数，请重新生成。');
  const canvas = document.createElement('canvas'); canvas.width = POSTER_SIZE.width; canvas.height = POSTER_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.width = canvas.height = 0; throw new Error('当前浏览器无法生成海报。'); }
  try {
    renderCreativeFrame(ctx, photo.image, draft.creative, draft.mode, 0, true, draft.tags);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result && result.size ? resolve(result) : reject(new Error('海报导出失败，请重试。')), 'image/png'));
    checkAbort(signal); return blob;
  } finally { canvas.width = canvas.height = 0; }
}
// Give live-recorded WebM a real 00:12 duration without changing encoded media bytes.
export function addWebmDuration(bytes: Uint8Array, milliseconds = 12000): Uint8Array {
  function vint(offset: number, id = false): { length: number; value: number; unknown: boolean } | null {
    const first = bytes[offset]; if (!first) return null;
    let length = 1, mask = 0x80; while (length <= 8 && !(first & mask)) { mask >>= 1; length++; }
    if (length > 8 || offset + length > bytes.length || (id && length > 4)) return null;
    let value = id ? first : first & (mask - 1), unknown = !id && (first & (mask - 1)) === mask - 1;
    for (let i = 1; i < length; i++) { value = value * 256 + bytes[offset + i]; unknown = unknown && bytes[offset + i] === 255; }
    return { length, value, unknown };
  }
  function element(offset: number) {
    const id = vint(offset, true); if (!id) return null;
    const size = vint(offset + id.length); if (!size) return null;
    const start = offset + id.length + size.length;
    const end = size.unknown ? bytes.length : start + size.value;
    return end <= bytes.length ? { id: id.value, start, end, sizeOffset: offset + id.length, size } : null;
  }
  function sizeBytes(value: number, length: number): Uint8Array | null {
    if (value >= Math.pow(2, 7 * length) - 1) return null;
    const result = new Uint8Array(length);
    for (let i = length - 1; i >= 0; i--) { result[i] = value % 256; value = Math.floor(value / 256); }
    result[0] |= 1 << (8 - length); return result;
  }
  let segment: ReturnType<typeof element> = null;
  for (let offset = 0; offset < bytes.length;) { const found = element(offset); if (!found) return bytes; if (found.id === 0x18538067) { segment = found; break; } offset = found.end; }
  if (!segment) return bytes;
  let info: ReturnType<typeof element> = null, scale = 1_000_000;
  for (let offset = segment.start; offset < segment.end;) { const found = element(offset); if (!found) return bytes; if (found.id === 0x114d9b74) return bytes; if (found.id === 0x1549a966) { info = found; break; } offset = found.end; }
  if (!info || info.size.unknown) return bytes;
  let duration: ReturnType<typeof element> = null;
  for (let offset = info.start; offset < info.end;) {
    const found = element(offset); if (!found) return bytes;
    if (found.id === 0x2ad7b1) { scale = 0; for (let i = found.start; i < found.end; i++) scale = scale * 256 + bytes[i]; }
    if (found.id === 0x4489) duration = found;
    offset = found.end;
  }
  if (scale <= 0) return bytes;
  if (duration) {
    const result = bytes.slice(), data = new DataView(result.buffer);
    if (duration.end - duration.start === 8) data.setFloat64(duration.start, milliseconds * 1_000_000 / scale);
    else if (duration.end - duration.start === 4) data.setFloat32(duration.start, milliseconds * 1_000_000 / scale);
    return result;
  }
  const added = new Uint8Array(11); added.set([0x44, 0x89, 0x88]); new DataView(added.buffer).setFloat64(3, milliseconds * 1_000_000 / scale);
  const infoSize = sizeBytes(info.size.value + added.length, info.size.length);
  const segmentSize = segment.size.unknown ? null : sizeBytes(segment.size.value + added.length, segment.size.length);
  if (!infoSize || (!segment.size.unknown && !segmentSize)) return bytes;
  const result = new Uint8Array(bytes.length + added.length);
  result.set(bytes.subarray(0, info.end)); result.set(added, info.end); result.set(bytes.subarray(info.end), info.end + added.length);
  result.set(infoSize, info.sizeOffset); if (segmentSize) result.set(segmentSize, segment.sizeOffset);
  return result;
}
export async function createPhotoVideo(photo: LocalPhoto, draft: CreativeDraft, options: {
  signal: AbortSignal; onProgress?: (progress: number) => void; onPreview?: (canvas: HTMLCanvasElement) => void;
}): Promise<{ blob: Blob; extension: 'webm' | 'mp4' }> {
  checkAbort(options.signal);
  const support = getVideoSupport();
  if (!support.supported) throw new Error(support.reason);
  if (!draft.creative) throw new Error('未收到有效的画面创意参数，请重新生成。');
  if (document.visibilityState === 'hidden') throw new Error('请保持本页面在前台，再导出 12 秒短片。');
  const canvas = document.createElement('canvas'); canvas.width = VIDEO_SIZE.width; canvas.height = VIDEO_SIZE.height;
  const ctx = canvas.getContext('2d'); if (!ctx) { canvas.width = canvas.height = 0; throw new Error('当前浏览器无法绘制短片。'); }
  const creative = draft.creative;
  try { renderCreativeFrame(ctx, photo.image, creative, draft.mode, 0); } catch (error) { canvas.width = canvas.height = 0; throw error; }
  let stream: MediaStream;
  try { stream = canvas.captureStream(VIDEO_FPS); } catch { canvas.width = canvas.height = 0; throw new Error('浏览器未允许照片短片录制，可先下载海报。'); }
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream, { mimeType: support.mimeType, videoBitsPerSecond: 2_400_000 }); }
  catch { stream.getTracks().forEach(track => track.stop()); canvas.width = canvas.height = 0; throw new Error('视频编码器未能启动，可先下载海报，或换用新版 Chrome / Edge。'); }
  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    let frame = 0, watchdog: ReturnType<typeof setTimeout> | undefined, settled = false, finishing = false;
    let startedAt = 0, lastPaint = -1000;
    const clean = () => {
      cancelAnimationFrame(frame); clearTimeout(watchdog);
      options.signal.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageHide);
      recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null;
      stream.getTracks().forEach(track => track.stop()); canvas.width = canvas.height = 0;
    };
    const fail = (error: Error) => {
      if (settled) return; settled = true;
      try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* cleanup still stops every track */ }
      clean(); reject(error);
    };
    const abort = () => fail(abortError());
    const visibility = () => { if (document.visibilityState === 'hidden') fail(new Error('页面已切到后台，短片录制已中止。海报和文案已保留，回到页面后可重新导出。')); };
    const pageHide = () => fail(new Error('页面离开，短片录制已中止。'));
    recorder.ondataavailable = event => { if (!settled && event.data.size > 0) chunks.push(event.data); };
    recorder.onerror = () => fail(new Error('短片录制中断，请重新导出。'));
    recorder.onstop = async () => {
      if (settled || !finishing) return fail(new Error('短片录制意外停止，请重试。'));
      const raw = new Blob(chunks, { type: recorder.mimeType || support.mimeType });
      if (!raw.size) return fail(new Error('未能获得视频画面，请重新导出或换用新版 Chrome / Edge。'));
      clean();
      try {
        const blob = support.extension === 'webm' ? new Blob([addWebmDuration(new Uint8Array(await raw.arrayBuffer()), VIDEO_DURATION * 1000).buffer as ArrayBuffer], { type: raw.type }) : raw;
        checkAbort(options.signal);
        settled = true; options.onProgress?.(1); resolve({ blob, extension: support.extension });
      } catch (error) { settled = true; reject(error); }
    };
    options.signal.addEventListener('abort', abort, { once: true }); document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pageHide);
    const tick = (now: number) => {
      if (settled || finishing) return;
      try {
        const elapsed = now - startedAt;
        if (elapsed - lastPaint >= 1000 / VIDEO_FPS - 2 || elapsed >= VIDEO_DURATION * 1000) {
          lastPaint = elapsed;
          renderCreativeFrame(ctx, photo.image, creative, draft.mode, Math.min(VIDEO_DURATION, elapsed / 1000));
          options.onProgress?.(Math.min(0.99, elapsed / (VIDEO_DURATION * 1000))); options.onPreview?.(canvas);
        }
        if (elapsed >= VIDEO_DURATION * 1000) { finishing = true; recorder.stop(); }
        else frame = requestAnimationFrame(tick);
      } catch (error) { fail(error instanceof Error ? error : new Error('短片绘制失败，请重试。')); }
    };
    try {
      checkAbort(options.signal); recorder.start(250); startedAt = performance.now();
      options.onProgress?.(0); options.onPreview?.(canvas);
      frame = requestAnimationFrame(tick);
      watchdog = setTimeout(() => fail(new Error('短片录制未按时完成，请保持页面在前台后重试。')), (VIDEO_DURATION + 5) * 1000);
    } catch (error) { fail(error instanceof Error ? error : new Error('短片录制未能启动。')); }
  });
}
