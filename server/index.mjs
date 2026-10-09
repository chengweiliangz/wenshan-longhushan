import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, ZodError } from 'zod';
import { spots, sources } from '../shared/catalog.mjs';
import { createPlan } from './planner.mjs';
import { enhancePlan, answerGuide, prepareGuide, createJournal, isAIConfigured } from './ai.mjs';
import { GUIDE_COPY } from '../shared/guidePersona.mjs';
import { configStore, publicConfig, ConfigError } from './config.mjs';
import { endpointFor, requestJSON, requestGuideStream, runExclusive, ProviderError } from './providers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function createApp({ store = configStore, provider = requestJSON, streamProvider = requestGuideStream } = {}) {
  const app = express();
  const generate = (instruction, data, schema) => {
    const config = store.get();
    if (!config.enabled || !config.apiKey) return Promise.resolve(null);
    return runExclusive(() => provider(config, instruction, data, schema));
  };
  // A content request owns its cancellation; leaving the page releases the
  // upstream request as well as the shared provider slot. Stored settings stay intact.
  async function contentResponse(req, res, task, planTask = false) {
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableFinished) controller.abort(); };
    req.once('aborted', disconnected); res.once('close', disconnected);
    try {
      const contentGenerate = (instruction, data, schema, options = {}) => {
        const config = store.get();
        if (!config.enabled || !config.apiKey) return Promise.resolve(null);
        const requestConfig = planTask ? { ...config, maxTokens: Math.max(config.maxTokens, 3000) } : config;
        const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
        return runExclusive(() => provider(requestConfig, instruction, data, schema, fetch, { signal }), { signal });
      };
      const result = await task(contentGenerate);
      if (!controller.signal.aborted && !res.destroyed) res.json(result);
    } finally {
      req.removeListener('aborted', disconnected); res.removeListener('close', disconnected);
    }
  }
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    let pathname = req.path;
    try { for (let i = 0; i < 3; i++) pathname = decodeURIComponent(pathname); } catch { return res.sendStatus(400); }
    if (/(?:^|[\/\\])(?:\.local|\.git|\.env[^/\\]*)(?:[\/\\]|$)/i.test(pathname)) return res.sendStatus(404);
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  // Reject cross-origin browser mutations; credentials never reach the frontend.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' && req.get('origin')) {
      try { if (new URL(req.get('origin')).host !== req.get('host')) return res.status(403).json({ error: '不允许跨站请求。' }); }
      catch { return res.status(403).json({ error: '请求来源无效。' }); }
    }
    next();
  });
  const requests = new Map();
  app.use('/api', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const now = Date.now();
    for (const [key, value] of requests) if (now > value.until) requests.delete(key);
    const entry = requests.get(req.ip) || { count: 0, until: now + 60000 };
    entry.count++; requests.set(req.ip, entry);
    if (entry.count > 30) return res.status(429).json({ error: '请求有点密集，请一分钟后再试。' });
    next();
  });
  app.get('/api/health', (_req, res) => { const ai = publicConfig(store.get()).configured; res.json({ ok: true, ai, mode: ai ? 'ai' : 'local' }); });
  app.get('/api/catalog', (_req, res) => res.json({ spots, sources }));
  app.use('/api/settings', (req, res, next) => {
    // This MVP's settings belong to the local server owner, not public visitors.
    const ip = req.socket.remoteAddress;
    const localIp = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    let localHost = false;
    try { localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${req.get('host')}`).hostname); } catch {}
    if (!localIp || !localHost) return res.status(403).json({ error: 'API 设置仅允许从本机 localhost 或 127.0.0.1 访问。' });
    if (req.method === 'POST' && (!req.is('application/json') || req.get('sec-fetch-site') === 'cross-site')) return res.status(403).json({ error: '不允许跨站修改设置。' });
    next();
  });
  app.get('/api/settings/ai', (_req, res) => { const c = store.get(); res.json({ ...publicConfig(c), endpoint: endpointFor(c) }); });
  app.post('/api/settings/ai', (req, res) => { const c = store.save(req.body); res.json({ ...publicConfig(c), endpoint: endpointFor(c) }); });
  app.post('/api/settings/ai/test', async (req, res) => {
    const c = store.resolve(req.body);
    if (!c.enabled) throw new ConfigError('请先启用 AI，再测试连接。');
    const started = Date.now();
    const result = await runExclusive(() => provider({ ...c, maxTokens: Math.min(c.maxTokens, 256) }, '连接测试。只返回 JSON: {"ok":true}。', { task: 'connection-test' }, z.object({ ok: z.literal(true) })));
    if (!result) throw new ConfigError('请先填写完整的模型配置。');
    res.json({ ok: true, model: c.model, format: c.format, latencyMs: Date.now() - started, message: '连接成功，模型已返回有效 JSON。测试配置尚未保存。' });
  });
  app.post('/api/plan', (req, res) => contentResponse(req, res, generateContent => enhancePlan(createPlan(req.body), generateContent), true));
  app.post('/api/guide', async (req, res) => res.json(await answerGuide(req.body, generate)));
  app.post('/api/guide/stream', async (req, res) => {
    const guide = prepareGuide(req.body);
    const config = store.get();
    const configured = config.enabled && Boolean(config.apiKey && config.model);
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableFinished) controller.abort(); };
    req.once('aborted', disconnected);
    res.once('close', disconnected);
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = (event, value) => {
      if (controller.signal.aborted || res.destroyed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
    };
    const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': keep-alive\n\n'); }, 15000);
    heartbeat.unref();
    try {
      send('meta', { mode: configured ? 'ai' : 'local', modeLabel: configured ? GUIDE_COPY.modelModeLabel : GUIDE_COPY.localModeLabel, sources: guide.sources, ...(configured ? { model: config.model, provider: config.name } : {}) });
      if (!configured) {
        // A local response is delivered once, never animated as model tokens.
        send('done', { ok: true, answer: guide.answer });
      } else {
        const result = await runExclusive(() => streamProvider(config, guide.data, { signal: controller.signal, onDelta: delta => send('delta', delta) }), { signal: controller.signal });
        if (!result?.answer?.trim()) throw new ProviderError('模型没有返回可用回答，请重试。', 502, { code: 'EMPTY_RESPONSE' });
        send('done', { ok: true });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const safe = error instanceof ProviderError ? error : new ProviderError('回答暂时中断，请稍后重试。', 502, { code: 'STREAM_ERROR' });
        send('error', { message: safe.message, code: safe.code, retryable: safe.retryable });
      }
    } finally {
      clearInterval(heartbeat);
      req.removeListener('aborted', disconnected);
      res.removeListener('close', disconnected);
      if (!res.destroyed && !res.writableEnded) res.end();
    }
  });
  app.post('/api/journal', (req, res) => contentResponse(req, res, generateContent => createJournal(req.body, generateContent)));
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在。' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ConfigError) return res.status(400).json({ error: error.message });
    if (error instanceof ProviderError) return res.status(error.status).json({ error: error.message });
    if (error instanceof ZodError) return res.status(400).json({ error: `输入无效，请检查：${error.issues.map(i => i.path.join('.') || '请求内容').join('、')}。`, details: error.issues.map(i => i.path.join('.')) });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: '内容过长，请精简后再试。' });
    if (error instanceof SyntaxError) return res.status(400).json({ error: '请求格式无效。' });
    console.error('Request failed:', error.name);
    return res.status(500).json({ error: '暂时未能完成，请稍后再试。' });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  const dev = process.argv.includes('--dev');
  if (dev) {
    const { createServer } = await import('vite');
    const vite = await createServer({ root, server: { middlewareMode: true, fs: { deny: ['.env', '.env.*', '**/.git/**', '**/.local/**', '*.pem', '*.crt'] } }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(root, 'dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  }
  const port = Number(process.env.PORT) || (dev ? 5173 : 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`Wenshan running at http://${host}:${port} (${isAIConfigured() ? 'AI' : 'local demo'})`));
  server.on('error', error => { console.error(`Server could not start: ${error.code}`); process.exit(1); });
}
