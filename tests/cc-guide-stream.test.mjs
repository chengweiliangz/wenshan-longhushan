import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(new URL('../src/guideStream.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createGuideSSEParser, completedGuideHistory, GuideStreamError, requestGuideStream } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const encoder = new TextEncoder();
const record = (event, data) => 'event: ' + event + '\r\ndata: ' + JSON.stringify(data) + '\r\n\r\n';
const meta = { mode: 'ai', modeLabel: 'AI 讲解', sources: [], model: 'deepseek-flash', provider: 'DeepSeek' };
const request = { question: '慢一点怎么玩？', history: [] };
const response = body => new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });

test('SSE preserves Chinese UTF-8 and split CRLF records at every byte boundary', () => {
  const events = [];
  const parser = createGuideSSEParser(event => events.push(event));
  const bytes = encoder.encode(': heartbeat\r\n' + record('meta', meta) + record('delta', { text: '山风🌿，慢慢来。' }) + record('done', { ok: true }));
  for (const byte of bytes) parser.push(Uint8Array.of(byte));
  parser.finish();
  assert.deepEqual(events.map(event => event.type), ['meta', 'delta', 'done']);
  assert.equal(events[1].data.text, '山风🌿，慢慢来。');
  assert.equal(events[0].data.model, 'deepseek-flash');
});

test('SSE waits for record boundaries, supports multiline data and ignores comments/unknown events', () => {
  const events = [];
  const parser = createGuideSSEParser(event => events.push(event));
  parser.push(encoder.encode('event: delta\ndata: {\ndata: "text": "先坐一会儿"\ndata: }\n'));
  assert.equal(events.length, 0);
  parser.push(encoder.encode('\n: keepalive\n\nevent: future\ndata: {}\n\n'));
  parser.finish();
  assert.deepEqual(events, [{ type: 'delta', data: { text: '先坐一会儿' } }]);
});

test('model deltas arrive before done, rather than after the complete response', async () => {
  let streamController;
  const events = [];
  const body = new ReadableStream({ start(controller) { streamController = controller; } });
  const running = requestGuideStream(request, event => events.push(event), new AbortController().signal, async (url, options) => {
    assert.equal(url, '/api/guide/stream');
    assert.equal(options.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(options.body), request);
    return response(body);
  });
  streamController.enqueue(encoder.encode(record('meta', meta) + record('delta', { text: '先去泸溪河。' })));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events.map(event => event.type), ['meta', 'delta']);
  streamController.enqueue(encoder.encode(record('delta', { text: '给散步留点空。' }) + record('done', { ok: true })));
  await running;
  assert.equal(events.filter(event => event.type === 'delta').map(event => event.data.text).join(''), '先去泸溪河。给散步留点空。');
  assert.equal(events.at(-1).type, 'done');
});

test('abort immediately cancels a pending stream and stops further callbacks', async () => {
  let streamController;
  let cancelled = 0;
  const controller = new AbortController();
  const events = [];
  const body = new ReadableStream({ start(stream) { streamController = stream; }, cancel() { cancelled++; } });
  const running = requestGuideStream(request, event => events.push(event), controller.signal, async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    return response(body);
  });
  streamController.enqueue(encoder.encode(record('meta', meta) + record('delta', { text: '听山风' })));
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(running, error => error.name === 'AbortError');
  assert.equal(cancelled, 1);
  assert.deepEqual(events.map(event => event.type), ['meta', 'delta']);
});

test('local demo uses its explicit meta and immediate complete answer without fake deltas', async () => {
  const events = [];
  const local = { mode: 'local', modeLabel: '本地演示讲解', sources: [{ id: 'official', title: '景区资料', url: 'https://example.com' }] };
  await requestGuideStream(request, event => events.push(event), new AbortController().signal, async () => response(record('meta', local) + record('done', { ok: true, answer: '本地精选资料讲解。' })));
  assert.deepEqual(events.map(event => event.type), ['meta', 'done']);
  assert.equal(events[0].data.mode, 'local');
  assert.equal(events[1].data.answer, '本地精选资料讲解。');
});

test('server failures reject explicitly and never become an assistant answer', async () => {
  const events = [];
  await assert.rejects(requestGuideStream(request, event => events.push(event), new AbortController().signal, async () => response(record('meta', meta) + record('error', { message: '模型连接失败', code: 'upstream', retryable: true }))), error => error instanceof GuideStreamError && error.message === '模型连接失败' && error.code === 'upstream' && error.retryable);
  assert.deepEqual(events.map(event => event.type), ['meta']);
  await assert.rejects(requestGuideStream(request, () => {}, new AbortController().signal, async () => new Response(JSON.stringify({ error: '问题太长' }), { status: 400, headers: { 'Content-Type': 'application/json' } })), error => error.code === 'http_400' && error.retryable === false);
});

test('truncated, empty, malformed and invalid UTF-8 responses are explicit errors', async () => {
  await assert.rejects(requestGuideStream(request, () => {}, new AbortController().signal, async () => response(record('meta', meta) + record('delta', { text: '未完成' }))), error => error.code === 'interrupted');
  await assert.rejects(requestGuideStream(request, () => {}, new AbortController().signal, async () => response(record('meta', meta) + record('done', { ok: true }))), error => error.code === 'empty_answer');
  assert.throws(() => createGuideSSEParser(() => {}).push(encoder.encode('event: delta\ndata: broken\n\n')), error => error.code === 'invalid_stream');
  const parser = createGuideSSEParser(() => {});
  parser.push(Uint8Array.of(0xe4));
  assert.throws(() => parser.finish(), error => error.code === 'invalid_stream');
});

test('history contains complete pairs only, preserving roles and the bounded most recent context', () => {
  const turns = [{ id: 'greeting', role: 'guide', text: '欢迎', status: 'greeting' }];
  for (let index = 0; index < 10; index++) {
    turns.push({ id: 'user-' + index, role: 'user', text: '问题' + index });
    turns.push({ id: 'guide-' + index, role: 'guide', text: '回答' + index, status: index === 8 ? 'error' : index === 9 ? 'cancelled' : 'complete', replyTo: 'user-' + index });
  }
  turns.push({ id: 'active-user', role: 'user', text: '还没完成的问题' }, { id: 'active-guide', role: 'guide', text: '部分回答', status: 'streaming', replyTo: 'active-user' });
  const history = completedGuideHistory(turns);
  assert.equal(history.length, 12);
  assert.deepEqual(history[0], { role: 'user', content: '问题2' });
  assert.deepEqual(history.at(-1), { role: 'assistant', content: '回答7' });
  assert.equal(history.some(message => message.content.includes('部分') || message.content === '问题8' || message.content === '问题9'), false);
  const large = [];
  for (let index = 0; index < 8; index++) large.push({ id: 'u' + index, role: 'user', text: '问'.repeat(500) }, { id: 'a' + index, role: 'guide', text: '答'.repeat(6000), status: 'complete', replyTo: 'u' + index });
  const bounded = completedGuideHistory(large);
  assert.equal(bounded.length % 2, 0);
  assert.ok(bounded.length <= 12);
  assert.ok(bounded.reduce((sum, message) => sum + message.content.length, 0) <= 8000);
  assert.ok(bounded.filter(message => message.role === 'assistant').every(message => message.content.length <= 1800));
});
