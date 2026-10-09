import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CREATIVE_CONTRACT } from '../shared/creativeContract.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const mediaPath = new URL('../src/creativeMedia.ts', import.meta.url);
const code = ts.transpileModule(fs.readFileSync(mediaPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const media = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const creative = { theme: 'mist', headline: '山水不语，云起有声', subtitle: '把这一刻，留给慢下来的自己', palette: 'jade', fog: .25,
  shotCaptions: ['赴一场山水之约', '让生活慢一点', '把余韵带回去'], motion: 'drift', duration: 12 };
const draft = { title: '留住山水的一刻', content: '旅途有风，心里有山。', tags: ['龙虎山', '山水手记'], mode: 'ai', modeLabel: 'AI 共创', creative };
const photo = { image: { naturalWidth: 1600, naturalHeight: 1200 }, width: 1600, height: 1200, type: 'image/jpeg', name: 'private.jpg', url: 'blob:private', release() {} };

function replaceGlobal(t, key, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; });
}
function browser(t, { empty = false, failStart = false, supported = 'video/webm;codecs=vp9' } = {}) {
  const frames = new Map(), canvases = [], recorders = [], draws = [], texts = [];
  const document = new EventTarget(); document.visibilityState = 'visible';
  const window = new EventTarget();
  let id = 0, stopCount = 0, now = 0;
  const track = { stop() { stopCount++; } };
  class Canvas {
    width = 0; height = 0;
    constructor() { canvases.push(this); }
    getContext() {
      const gradient = { addColorStop() {} };
      return { canvas: this, save() {}, restore() {}, setTransform() {}, fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {},
        moveTo() {}, bezierCurveTo() {}, stroke() {}, createLinearGradient() { return gradient; }, createRadialGradient() { return gradient; },
        drawImage(...args) { draws.push(args); }, fillText(text, x, y) { texts.push({ text, x, y }); },
        measureText(text) { const fontSize = Number(this.font?.match(/(\d+)px/)?.[1] || 20); return { width: Array.from(text).length * fontSize }; } };
    }
    toBlob(callback, type) { queueMicrotask(() => callback(new Blob(['PNG'], { type }))); }
    captureStream(fps) { assert.equal(fps, 24); return { getTracks: () => [track] }; }
  }
  class Recorder {
    static isTypeSupported(type) { return type === supported; }
    state = 'inactive';
    constructor(_stream, options) { this.mimeType = options.mimeType; this.options = options; recorders.push(this); }
    start(interval) { assert.equal(interval, 250); if (failStart) throw new Error('start failed'); this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(empty ? [] : [Uint8Array.of(1, 2, 3, 4)], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  document.createElement = type => { assert.equal(type, 'canvas'); return new Canvas(); };
  replaceGlobal(t, 'document', document); replaceGlobal(t, 'window', window); replaceGlobal(t, 'HTMLCanvasElement', Canvas);
  replaceGlobal(t, 'MediaRecorder', Recorder); replaceGlobal(t, 'performance', { now: () => now });
  replaceGlobal(t, 'requestAnimationFrame', callback => { const next = ++id; frames.set(next, callback); return next; });
  replaceGlobal(t, 'cancelAnimationFrame', frame => frames.delete(frame));
  return { document, canvases, recorders, draws, texts, frames, get stops() { return stopCount; },
    advance(milliseconds) { now = milliseconds; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); } };
}

test('creative request sends only selected places, notes and dimension/type metadata, never the photo', async () => {
  const body = media.buildCreativeRequest(['river', 'river', 'elephant'], '  清风入怀  ', photo);
  assert.deepEqual(body, { spotIds: ['river', 'elephant'], mood: 'poetic', notes: '清风入怀', creative: true, photoMeta: { width: 1600, height: 1200, type: 'image/jpeg' } });
  let outbound;
  const result = await media.requestCreativeDraft({ ...body, file: photo }, new AbortController().signal, async (url, options) => {
    assert.equal(url, '/api/journal'); assert.equal(options.headers['Content-Type'], 'application/json');
    outbound = JSON.parse(options.body); return new Response(JSON.stringify(draft));
  });
  assert.deepEqual(outbound, body);
  assert.equal(JSON.stringify(outbound).includes('private'), false);
  assert.deepEqual(result.creative, creative);
  assert.equal(media.buildCreativeRequest(['river'], '').photoMeta, undefined);
});

test('legal 40/80 creative copy and shared enum/duration values are accepted without silent loss', () => {
  const result = media.validateCreativeParameters({ ...creative, headline: '山'.repeat(40), subtitle: '水'.repeat(80) });
  assert.equal(result.headline.length, 40); assert.equal(result.subtitle.length, 80);
  for (const theme of CREATIVE_CONTRACT.themes) assert.equal(media.validateCreativeParameters({ ...creative, theme }).theme, theme);
  assert.deepEqual(media.PHOTO_TYPES, CREATIVE_CONTRACT.photoTypes);
  assert.equal(media.VIDEO_DURATION, CREATIVE_CONTRACT.duration);
  assert.equal(media.validateCreativeParameters({ ...creative, headline: '山'.repeat(41) }), null);
  assert.equal(media.validateCreativeParameters({ ...creative, subtitle: '水'.repeat(81) }), null);
  for (const invalid of [
    { duration: 30 }, { fog: -1 }, { fog: .501 }, { fog: NaN }, { theme: 'stock' }, { theme: ['mist'] }, { motion: 'zoom' },
    { shotCaptions: ['only one'] }, { shotCaptions: ['山'.repeat(25), '二', '三'] }, { extraUrl: 'https://external.invalid/photo.jpg' },
  ]) assert.equal(media.validateCreativeParameters({ ...creative, ...invalid }), null);
  const partial = media.parseCreativeDraft({ ...draft, creative: { ...creative, duration: 30 } });
  assert.equal(partial.content, draft.content); assert.equal(partial.creative, undefined);
});

test('cancel aborts the network call and rejects stale completed replies', async () => {
  const controller = new AbortController();
  let reply;
  const running = media.requestCreativeDraft(media.buildCreativeRequest(['river'], ''), controller.signal, async (_url, options) => {
    assert.equal(options.signal.aborted, false);
    return new Promise(resolve => { reply = resolve; });
  });
  controller.abort(); reply(new Response(JSON.stringify(draft)));
  await assert.rejects(running, error => error.name === 'AbortError');
});

test('HTTP and malformed service replies remain explicit errors', async () => {
  await assert.rejects(media.requestCreativeDraft(media.buildCreativeRequest(['river'], ''), new AbortController().signal, async () =>
    new Response(JSON.stringify({ error: '服务不可用' }), { status: 503 })), /服务不可用/);
  assert.throws(() => media.parseCreativeDraft({ title: 'x' }), /不完整/);
  await assert.rejects(media.requestCreativeDraft(media.buildCreativeRequest(['river'], ''), new AbortController().signal, async () => new Response('invalid')), /有效内容/);
});

test('photo load blocks AVIF, oversized panorama and releases aborted object URLs', async t => {
  let revokes = 0; const images = [];
  t.mock.method(URL, 'createObjectURL', () => 'blob:only-local');
  t.mock.method(URL, 'revokeObjectURL', () => { revokes++; });
  class Image {
    constructor() { images.push(this); }
    removeAttribute() {}
  }
  replaceGlobal(t, 'Image', Image);
  await assert.rejects(media.loadLocalPhoto({ type: 'image/avif', size: 5, name: 'a' }), /JPG/);
  const panorama = media.loadLocalPhoto({ type: 'image/jpeg', size: 5, name: 'panorama' });
  images.at(-1).naturalWidth = 30000; images.at(-1).naturalHeight = 1000; images.at(-1).onload();
  await assert.rejects(panorama, /2 万像素/);
  const controller = new AbortController();
  const pending = media.loadLocalPhoto({ type: 'image/png', size: 5, name: 'p' }, controller.signal);
  controller.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(revokes, 2); assert.equal(images.at(-1).onload, null); assert.equal(images.at(-1).onerror, null);
});

test('PNG draws the exact local image at 1080x1440 and labels generated material accurately', async t => {
  const env = browser(t);
  const png = await media.createPoster(photo, draft);
  assert.equal(png.type, 'image/png'); assert.ok(png.size > 0);
  assert.equal(env.draws.length, 1); assert.equal(env.draws[0][0], photo.image);
  assert.ok(env.texts.some(item => item.text.includes('生成内容')));
  assert.ok(env.texts.some(item => item.text.includes('AI创意编排')));
  assert.equal(env.canvases[0].width, 0); assert.equal(env.canvases[0].height, 0);
  const canvas = new globalThis.HTMLCanvasElement(); canvas.width = 1080; canvas.height = 1440;
  media.renderCreativeFrame(canvas.getContext('2d'), photo.image, creative, 'local');
  assert.ok(env.texts.some(item => item.text.includes('本地创意编排')));
});

test('40/80 Chinese headline and subtitle both fit completely in their frame', t => {
  const env = browser(t), canvas = new globalThis.HTMLCanvasElement(); canvas.width = 1080; canvas.height = 1440;
  media.renderCreativeFrame(canvas.getContext('2d'), photo.image, { ...creative, headline: '山'.repeat(40), subtitle: '水'.repeat(80) }, 'ai', 0, true);
  assert.equal(env.texts.filter(item => /^山+$/.test(item.text)).map(item => item.text).join('').length, 40);
  assert.equal(env.texts.filter(item => /^水+$/.test(item.text)).map(item => item.text).join('').length, 80);
});

test('a completed 12-second recording yields a nonempty file and releases every track and animation', async t => {
  const env = browser(t), progress = [];
  const running = media.createPhotoVideo(photo, draft, { signal: new AbortController().signal, onProgress: value => progress.push(value) });
  assert.equal(env.recorders[0].state, 'recording');
  env.advance(4000); env.advance(8000); env.advance(12000);
  const result = await running;
  assert.equal(result.extension, 'webm'); assert.ok(result.blob.size > 0);
  assert.equal(env.stops, 1); assert.equal(env.frames.size, 0); assert.equal(env.recorders[0].state, 'inactive');
  assert.equal(progress.at(-1), 1);
  assert.ok(env.draws.every(draw => draw[0] === photo.image));
  assert.ok(env.texts.some(item => item.text === creative.shotCaptions[0]));
  assert.ok(env.texts.some(item => item.text === creative.shotCaptions[1]));
  assert.ok(env.texts.some(item => item.text === creative.shotCaptions[2]));
});

test('cancel during recording rejects rather than exporting partial media and stops the stream', async t => {
  const env = browser(t), controller = new AbortController();
  const running = media.createPhotoVideo(photo, draft, { signal: controller.signal });
  env.advance(2000); controller.abort();
  await assert.rejects(running, error => error.name === 'AbortError');
  assert.equal(env.stops, 1); assert.equal(env.frames.size, 0); assert.equal(env.recorders[0].ondataavailable, null);
});

test('background switch ends the recording clearly and leaves no capture track', async t => {
  const env = browser(t);
  const running = media.createPhotoVideo(photo, draft, { signal: new AbortController().signal });
  env.document.visibilityState = 'hidden'; env.document.dispatchEvent(new Event('visibilitychange'));
  await assert.rejects(running, /后台/);
  assert.equal(env.stops, 1); assert.equal(env.frames.size, 0);
});

test('empty recordings and encoder startup failure never become downloadable success', async t => {
  const env = browser(t, { empty: true });
  const running = media.createPhotoVideo(photo, draft, { signal: new AbortController().signal });
  env.advance(12000); await assert.rejects(running, /未能获得视频/); assert.equal(env.stops, 1); assert.equal(env.frames.size, 0);
});

test('encoder startup failure stops its stream immediately', async t => {
  const env = browser(t, { failStart: true });
  await assert.rejects(media.createPhotoVideo(photo, draft, { signal: new AbortController().signal }), /start failed/);
  assert.equal(env.stops, 1); assert.equal(env.frames.size, 0);
});

test('browser capability detection supports MP4 and provides a useful unsupported message', async t => {
  const env = browser(t, { supported: 'video/mp4' });
  assert.equal(media.getVideoSupport().extension, 'mp4');
  const running = media.createPhotoVideo(photo, draft, { signal: new AbortController().signal }); env.advance(12000);
  const result = await running; assert.equal(result.extension, 'mp4'); assert.equal(result.blob.type, 'video/mp4');
  globalThis.MediaRecorder.isTypeSupported = () => false;
  assert.equal(media.getVideoSupport().supported, false); assert.match(media.getVideoSupport().reason, /海报和文案/);
});

test('WebM duration insertion preserves cluster bytes, updates lengths and does not mutate its input', () => {
  const cluster = [0x1f, 0x43, 0xb6, 0x75, 0x84, 1, 2, 3, 4];
  const info = [0x15, 0x49, 0xa9, 0x66, 0x87, 0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40];
  const original = Uint8Array.from([0x18, 0x53, 0x80, 0x67, 0x80 + info.length + cluster.length, ...info, ...cluster]);
  const before = original.slice(), changed = media.addWebmDuration(original);
  assert.deepEqual(original, before); assert.equal(changed.length, original.length + 11);
  assert.deepEqual([...changed.slice(-cluster.length)], cluster);
  const signature = Buffer.from(changed).indexOf(Buffer.from([0x44, 0x89, 0x88]));
  assert.ok(signature > 0); assert.equal(new DataView(changed.buffer).getFloat64(signature + 3), 12000);
  assert.equal(changed[4], original[4] + 11);
  assert.deepEqual(media.addWebmDuration(Uint8Array.of(1, 2, 3)), Uint8Array.of(1, 2, 3));
});

test('CreativeStudio and media exports pass strict TypeScript checks without writing build artifacts', () => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const configuration = ts.readConfigFile(project + 'tsconfig.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configuration.config, ts.sys, project);
  const roots = ['src/creativeMedia.ts', 'src/CreativeStudio.tsx'].map(path => project + path);
  const program = ts.createProgram(roots, { ...parsed.options, noEmit: true, incremental: false, composite: false });
  const errors = ts.getPreEmitDiagnostics(program).filter(item => item.category === ts.DiagnosticCategory.Error && (!item.file || roots.includes(item.file.fileName.replace(/\\/g, '/')) || /creativeMedia|CreativeStudio/.test(item.file.fileName)));
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, { getCurrentDirectory: () => project, getCanonicalFileName: x => x, getNewLine: () => '\n' }));
});
