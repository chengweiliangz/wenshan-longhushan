import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { get as httpGet } from 'node:http';
import { z } from 'zod';
import { createConfigStore, settingsSchema, publicConfig, normalizeBaseUrl } from '../server/config.mjs';
import { endpointFor, buildRequest, extractText, requestJSON, runExclusive } from '../server/providers.mjs';
import { createApp } from '../server/index.mjs';
const base = settingsSchema.parse({ enabled: true, name: 'Unit test', format: 'chat-completions', baseUrl: 'https://chat.ecnu.edu.cn/open/api/v1', model: 'ecnu-plus', apiKey: 'test-only-not-a-real-key' });
function temporaryStore(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'wenshan-config-'));
  t.after(() => { if (path.dirname(directory) === path.resolve(tmpdir()) && path.basename(directory).startsWith('wenshan-config-')) rmSync(directory, { recursive: true, force: true }); });
  const filePath = path.join(directory, 'ai-config.json');
  return { filePath, store: createConfigStore({ filePath, env: () => ({ AI_API_KEY: base.apiKey, AI_MODEL: base.model, AI_BASE_URL: base.baseUrl }) }) };
}
test('three protocol adapters produce distinct endpoints, payloads and auth headers', () => {
  const chat = buildRequest(base, 'json', {}); const cb = JSON.parse(chat.options.body);
  assert.equal(chat.url, `${base.baseUrl}/chat/completions`); assert.equal(cb.response_format.type, 'json_object'); assert.equal(cb.max_tokens, 1800); assert.equal(chat.options.redirect, 'error');
  const modern = JSON.parse(buildRequest({ ...base, tokenParameter: 'max_completion_tokens' }, 'json', {}).options.body);
  assert.equal(modern.max_completion_tokens, 1800); assert.equal(modern.max_tokens, undefined);
  const responses = buildRequest({ ...base, format: 'responses' }, 'json', {}); const rb = JSON.parse(responses.options.body);
  assert.equal(responses.url, `${base.baseUrl}/responses`); assert.equal(rb.text.format.type, 'json_object'); assert.equal(rb.store, false); assert.equal(rb.messages, undefined);
  const messages = buildRequest({ ...base, format: 'anthropic', baseUrl: 'https://chat.ecnu.edu.cn/open/api/anthropic' }, 'json', {}); const mb = JSON.parse(messages.options.body);
  assert.equal(messages.url, 'https://chat.ecnu.edu.cn/open/api/anthropic/v1/messages'); assert.ok(mb.system); assert.equal(mb.messages[0].role, 'user'); assert.equal(mb.response_format, undefined); assert.equal(messages.options.headers['anthropic-version'], '2023-06-01'); assert.ok(messages.options.headers.Authorization);
  const keyAuth = buildRequest({ ...base, format: 'anthropic', authMode: 'x-api-key' }, 'json', {});
  assert.equal(keyAuth.options.headers['x-api-key'], base.apiKey); assert.equal(keyAuth.options.headers.Authorization, undefined);
});
test('complete endpoint inputs do not acquire duplicate paths', () => {
  for (const [format, baseUrl, expected] of [['chat-completions', `${base.baseUrl}/chat/completions/`, `${base.baseUrl}/chat/completions`], ['responses', `${base.baseUrl}/responses`, `${base.baseUrl}/responses`], ['anthropic', 'https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages']]) assert.equal(endpointFor({ ...base, format, baseUrl }), expected);
});
test('Responses extracts message text after reasoning items; Anthropic ignores thinking', () => {
  assert.equal(extractText('responses', { status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }), '{"ok":true}');
  assert.equal(extractText('anthropic', { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '```json\n{"ok":true}\n```' }] }), '{"ok":true}');
  assert.throws(() => extractText('responses', { status: 'incomplete', output: [] }));
  assert.throws(() => extractText('anthropic', { stop_reason: 'max_tokens', content: [] }));
});
test('all three formats parse valid model JSON with mocked HTTP responses', async () => {
  const shapes = { 'chat-completions': { choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] }, responses: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }, anthropic: { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"ok":true}' }] } };
  for (const [format, response] of Object.entries(shapes)) assert.deepEqual(await requestJSON({ ...base, format }, 'json', {}, z.object({ ok: z.boolean() }), async () => ({ ok: true, json: async () => response })), { ok: true });
});
test('errors never echo upstream content or credentials and disabled config does not fetch', async () => {
  let readBody = false;
  await assert.rejects(requestJSON(base, 'test', {}, z.object({}), async () => ({ ok: false, status: 401, json: () => { readBody = true; return { error: base.apiKey }; } })), e => !e.message.includes(base.apiKey) && e.message.includes('401'));
  assert.equal(readBody, false);
  assert.equal(await requestJSON({ ...base, enabled: false }, '', {}, z.object({}), async () => { throw new Error('must not fetch'); }), null);
});
test('URL validation accepts local HTTP but rejects insecure remote and credential URLs', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:11434/v1/'), 'http://127.0.0.1:11434/v1');
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?key=secret', 'file:///a', 'https://example.com#secret']) assert.throws(() => normalizeBaseUrl(url));
});
test('configuration persists, API representation omits secret, blank keeps only same-origin key', t => {
  const { store, filePath } = temporaryStore(t);
  const saved = store.save({ ...base, apiKey: '', model: 'ecnu-max' });
  assert.equal(saved.apiKey, base.apiKey); assert.equal(store.get().model, 'ecnu-max'); assert.ok(existsSync(filePath));
  assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).apiKey, base.apiKey);
  assert.equal(publicConfig(saved).apiKey, undefined); assert.equal(publicConfig(saved).hasKey, true);
  assert.throws(() => store.resolve({ ...base, baseUrl: 'https://different.example/v1', apiKey: '' }), /新地址/);
  assert.equal(store.resolve({ ...base, baseUrl: 'https://different.example/v1', apiKey: '', enabled: false }).apiKey, '');
  assert.equal(store.get().model, 'ecnu-max');
});
test('settings HTTP saves safely, tests drafts without saving, and blocks cross-site and secret files', async t => {
  const { store } = temporaryStore(t);
  const providerCalls = [];
  const server = createApp({ store, provider: async (config, _instruction, _data, schema) => { providerCalls.push(config.format); return schema.parse({ ok: true }); } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (endpoint, body, headers = {}) => fetch(`${url}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const original = await fetch(`${url}/api/settings/ai`).then(r => r.json()); assert.equal(original.hasKey, true); assert.equal(original.apiKey, undefined);
    const testResponse = await send('/api/settings/ai/test', { ...base, format: 'responses', apiKey: '' }); assert.equal(testResponse.status, 200); assert.equal((await testResponse.json()).ok, true); assert.equal(store.get().format, 'chat-completions');
    const saved = await send('/api/settings/ai', { ...base, format: 'responses', apiKey: '' }); const publicBody = await saved.text(); assert.equal(saved.status, 200); assert.ok(!publicBody.includes(base.apiKey)); assert.equal(store.get().format, 'responses');
    const foreign = await send('/api/settings/ai', base, { Origin: 'https://unrelated.example' }); assert.equal(foreign.status, 403);
    const reboundStatus = await new Promise((resolve, reject) => { const req = httpGet(`${url}/api/settings/ai`, { headers: { Host: 'unrelated.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); }); assert.equal(reboundStatus, 403);
    const exfil = await send('/api/settings/ai/test', { ...base, baseUrl: 'https://unrelated.example', apiKey: '' }); assert.equal(exfil.status, 400); assert.deepEqual(providerCalls, ['responses']);
    for (const endpoint of ['/.env', '/.local/ai-config.json', '/@fs/E:/project/.LOCAL/ai-config.json', '/%2elocal/ai-config.json']) { const response = await fetch(`${url}${endpoint}`); assert.equal(response.status, 404); }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('upstream calls remain sequential and lock is released after failure', async () => {
  let release; const waiting = runExclusive(() => new Promise(resolve => { release = resolve; }));
  await assert.rejects(runExclusive(async () => true), /正在处理/); release(); await waiting;
  await assert.rejects(runExclusive(async () => { throw new Error('fail'); })); assert.equal(await runExclusive(async () => true), true);
});
