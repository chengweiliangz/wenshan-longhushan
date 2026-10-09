import { GUIDE_PERSONA_SYSTEM } from '../shared/guidePersona.mjs';

export class ProviderError extends Error {
  constructor(message, status = 502, { code = 'PROVIDER_ERROR', retryable = status >= 500 || status === 429 } = {}) {
    super(message); this.name = 'ProviderError'; this.status = status; this.code = code; this.retryable = retryable;
  }
}
export function endpointFor(config) {
  let base = config.baseUrl.replace(/\/+$/, '');
  base = base.replace(/\/(chat\/completions|responses|messages)$/, '');
  if (config.format === 'anthropic') return `${base.endsWith('/v1') ? base : `${base}/v1`}/messages`;
  return `${base}/${config.format === 'responses' ? 'responses' : 'chat/completions'}`;
}
function headersFor(config) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.format === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  if (config.authMode === 'x-api-key') headers['x-api-key'] = config.apiKey;
  else headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}
function deepSeekOptions(config, body) {
  // Normal guide answers need content, not a hidden chain of thought. Only set
  // this provider-specific option on the official Chat Completions endpoint.
  if (config.format === 'chat-completions' && new URL(config.baseUrl).hostname === 'api.deepseek.com') body.thinking = { type: 'disabled' };
  return body;
}
function conversation(instruction, data, json) {
  let system = `${GUIDE_PERSONA_SYSTEM}\n${instruction}`;
  if (json) system += '\n仅输出一个合法 JSON 对象，不要 Markdown 代码块。';
  if (typeof data.question !== 'string' || !Array.isArray(data.facts)) return { system, messages: [{ role: 'user', content: JSON.stringify(data) }] };
  system += `\n<BOUNDED_GUIDE_FACTS>\n${JSON.stringify(data.facts)}\n</BOUNDED_GUIDE_FACTS>`;
  system += '\n下一段仅是完整 facts 的逐项原文摘录索引，不是可以脱离全文使用的独立史料。完整 BOUNDED_GUIDE_FACTS 仍是权威依据；标点切片可能跨越指代、限定和关系，请结合原全文理解。答复前逐项核对方位、年代、对象和关系词，不得换字、调换对象或把不同片段错误拼接；资料未支持的关系就说明无法确认。';
  system += `\n<BOUNDED_GUIDE_FACT_ATOMS>\n${JSON.stringify(data.factAtoms || [])}\n</BOUNDED_GUIDE_FACT_ATOMS>`;
  const messages = (data.history || []).map(({ role, content }) => ({ role, content }));
  messages.push({ role: 'user', content: data.question });
  return { system, messages };
}
function requestFor(config, system, messages, stream, signal, json) {
  let body;
  if (config.format === 'anthropic') {
    body = { model: config.model, max_tokens: config.maxTokens, system, messages, stream };
  } else if (config.format === 'responses') {
    body = { model: config.model, instructions: system, input: messages, max_output_tokens: config.maxTokens, store: false, stream };
    if (json && config.jsonMode) body.text = { format: { type: 'json_object' } };
  } else {
    body = { model: config.model, messages: [{ role: 'system', content: system }, ...messages], [config.tokenParameter]: config.maxTokens, stream };
    if (json && config.jsonMode) body.response_format = { type: 'json_object' };
  }
  return { url: endpointFor(config), options: { method: 'POST', headers: headersFor(config), body: JSON.stringify(deepSeekOptions(config, body)), redirect: 'error', signal } };
}
export function buildRequest(config, instruction, data, signal) {
  const { system, messages } = conversation(instruction, data, true);
  const timeout = AbortSignal.timeout(config.timeoutSeconds * 1000);
  return requestFor(config, system, messages, false, signal ? AbortSignal.any([signal, timeout]) : timeout, true);
}
export function buildGuideRequest(config, data, signal) {
  const { system, messages } = conversation('请直接回答当前用户问题。先给具体建议，再作必要解释；不要输出 JSON。', data, false);
  return requestFor(config, system, messages, true, signal, false);
}
export function extractText(format, result) {
  let text;
  if (format === 'chat-completions') {
    if (result.choices?.[0]?.finish_reason !== 'stop') throw new ProviderError('模型未完整生成结果，请增加输出上限或更换模型。');
    text = result.choices[0].message?.content;
  } else if (format === 'responses') {
    if (result.status !== 'completed') throw new ProviderError('Responses 返回未完成状态，请检查模型和输出上限。');
    text = result.output?.filter(item => item.type === 'message').flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('');
  } else {
    if (!['end_turn', 'stop_sequence'].includes(result.stop_reason)) throw new ProviderError('Messages 返回未完成状态，请检查模型和输出上限。');
    text = result.content?.filter(item => item.type === 'text').map(item => item.text).join('');
  }
  if (typeof text !== 'string' || !text.trim()) throw new ProviderError('模型没有返回可用文本，请检查接口格式。');
  return text.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
}
function httpError(status) {
  const messages = { 400: '请求格式或参数不受支持，请检查模型、JSON 模式和 Token 参数。', 401: '密钥认证失败，请检查 API Key 是否正确或已失效。', 402: '服务余额或配额不足，请检查模型服务账户。', 403: '服务拒绝访问，请检查密钥权限或网络访问限制。', 404: '未找到接口或模型，请检查 API 地址、格式和模型名称。', 422: '请求参数不受支持，请检查模型和接口设置。', 429: '服务配额不足或请求过于频繁，请稍后再试。' };
  const codes = { 400: 'INVALID_REQUEST', 401: 'AUTH_FAILED', 402: 'QUOTA_EXCEEDED', 403: 'ACCESS_DENIED', 404: 'MODEL_NOT_FOUND', 422: 'INVALID_REQUEST', 429: 'RATE_LIMITED' };
  // Never read or echo error bodies: a provider may reflect a credential.
  return new ProviderError(`上游 HTTP ${status}：${messages[status] || '模型服务暂时不可用，请稍后重试。'}`, status === 429 ? 429 : 502, { code: codes[status] || 'UPSTREAM_ERROR', retryable: status === 429 || status >= 500 });
}
function abortError(signal, error) {
  if (signal?.reason?.name === 'TimeoutError' || error?.name === 'TimeoutError') return new ProviderError('模型响应超时，请稍后再试或调整超时时间。', 504, { code: 'TIMEOUT', retryable: true });
  return new ProviderError('已停止这次回答。', 499, { code: 'CANCELLED', retryable: false });
}
function raceSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const aborted = () => { signal.removeEventListener('abort', aborted); reject(abortError(signal)); };
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', aborted); resolve(value); }, error => { signal.removeEventListener('abort', aborted); reject(error); });
  });
}
export async function requestJSON(config, instruction, data, schema, fetcher = fetch, { signal } = {}) {
  if (!config.enabled || !config.apiKey || !config.model) return null;
  const { url, options } = buildRequest(config, instruction, data, signal);
  let response;
  try { response = await raceSignal(fetcher(url, options), options.signal); }
  catch (error) {
    if (error instanceof ProviderError) throw error;
    if (options.signal.aborted || ['TimeoutError', 'AbortError'].includes(error.name)) throw abortError(options.signal, error);
    throw new ProviderError('无法连接模型服务，请检查地址、网络或重定向设置。', 502, { code: 'NETWORK_ERROR' });
  }
  if (!response.ok) throw httpError(response.status);
  try { return schema.parse(JSON.parse(extractText(config.format, await raceSignal(response.json(), options.signal)))); }
  catch (error) { if (error instanceof ProviderError) throw error; if (options.signal.aborted) throw abortError(options.signal, error); throw new ProviderError('模型返回的 JSON 不符合要求，请检查接口格式或启用 JSON 模式。', 502, { code: 'INVALID_RESPONSE' }); }
}
const invalidStream = () => new ProviderError('模型返回的流式数据不完整或格式无效，请重试并检查接口格式。', 502, { code: 'INVALID_STREAM' });
const incompleteStream = () => new ProviderError('模型回答未完整生成，请增加输出上限或重试。', 502, { code: 'INCOMPLETE_RESPONSE' });

// Parse SSE by complete lines, retaining split CRLF and UTF-8 bytes between reads.
// Event buffers are bounded so malformed upstream data cannot grow indefinitely.
export async function* parseSSE(body, signal) {
  if (!body?.getReader) throw invalidStream();
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const decode = (value, options) => { try { return decoder.decode(value, options); } catch { throw invalidStream(); } };
  let buffer = '', data = [], event = '', eventSize = 0, streamSize = 0, complete = false;
  const cancelled = () => { Promise.resolve(reader.cancel()).catch(() => {}); };
  signal?.addEventListener('abort', cancelled, { once: true });
  try {
    while (true) {
      const { value, done } = await raceSignal(reader.read(), signal);
      if (done) { buffer += decode(); complete = true; }
      else { streamSize += value.byteLength; if (streamSize > 2 * 1024 * 1024) throw invalidStream(); buffer += decode(value, { stream: true }); }
      if (buffer.length + eventSize > 256 * 1024) throw invalidStream();
      while (true) {
        const at = buffer.search(/[\r\n]/);
        if (at < 0 || (!complete && buffer[at] === '\r' && at === buffer.length - 1)) break;
        const line = buffer.slice(0, at);
        const size = buffer[at] === '\r' && buffer[at + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(at + size);
        if (!line) {
          if (data.length) yield { event, data: data.join('\n') };
          data = []; event = ''; eventSize = 0;
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let content = colon < 0 ? '' : line.slice(colon + 1);
        if (content.startsWith(' ')) content = content.slice(1);
        if (field === 'data') { data.push(content); eventSize += content.length; }
        if (field === 'event') event = content;
        if (eventSize > 256 * 1024) throw invalidStream();
      }
      if (complete) { if (buffer.trim() || data.length) throw invalidStream(); break; }
    }
  } finally {
    signal?.removeEventListener('abort', cancelled);
    // Closing after a terminal event releases the response socket promptly.
    if (!complete) Promise.resolve(reader.cancel()).catch(() => {});
    reader.releaseLock();
  }
}
export async function consumeProviderStream(format, body, { signal, onDelta = () => {} } = {}) {
  let answer = '', finished = false;
  const emit = text => {
    if (typeof text !== 'string') throw invalidStream();
    if (!text) return;
    if (answer.length + text.length > 6000) throw incompleteStream();
    answer += text; onDelta({ text });
  };
  for await (const frame of parseSSE(body, signal)) {
    if (signal?.aborted) throw abortError(signal);
    if (format === 'chat-completions' && frame.data === '[DONE]') {
      if (!finished || !answer.trim()) throw invalidStream();
      return { answer };
    }
    let value;
    try { value = JSON.parse(frame.data); } catch { throw invalidStream(); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidStream();
    if (value.error || frame.event === 'error' || value.type === 'error') throw new ProviderError('模型服务在生成过程中返回错误，请稍后重试。', 502, { code: 'UPSTREAM_STREAM_ERROR' });
    if (format === 'chat-completions') {
      if (!Array.isArray(value.choices)) throw invalidStream();
      const choice = value.choices.find(item => item.index === 0) || value.choices[0];
      if (!choice) continue; // Optional usage-only event.
      if (choice.delta?.content != null) { if (finished) throw invalidStream(); emit(choice.delta.content); }
      if (choice.finish_reason != null) {
        if (choice.finish_reason !== 'stop') throw incompleteStream();
        finished = true;
      }
    } else if (format === 'responses') {
      const type = value.type || frame.event;
      if (type === 'response.output_text.delta') emit(value.delta);
      if (type === 'response.incomplete') throw incompleteStream();
      if (type === 'response.failed') throw new ProviderError('模型服务未能完成回答，请稍后重试。', 502, { code: 'UPSTREAM_STREAM_ERROR' });
      if (type === 'response.completed') {
        if (value.response?.status !== 'completed' || !answer.trim()) throw invalidStream();
        return { answer };
      }
    } else if (format === 'anthropic') {
      const type = value.type || frame.event;
      if (type === 'content_block_delta' && value.delta?.type === 'text_delta') emit(value.delta.text);
      if (type === 'message_delta' && value.delta?.stop_reason) {
        if (!['end_turn', 'stop_sequence'].includes(value.delta.stop_reason)) throw incompleteStream();
        finished = true;
      }
      if (type === 'message_stop') { if (!finished || !answer.trim()) throw invalidStream(); return { answer }; }
    } else throw invalidStream();
  }
  // EOF is not success: each protocol must send its actual terminal event.
  throw invalidStream();
}
export async function requestGuideStream(config, data, { signal, onDelta } = {}, fetcher = fetch) {
  if (!config.enabled || !config.apiKey || !config.model) throw new ProviderError('尚未连接 AI 服务。', 400, { code: 'NOT_CONFIGURED', retryable: false });
  const timeout = AbortSignal.timeout(config.timeoutSeconds * 1000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const { url, options } = buildGuideRequest(config, data, combined);
  try {
    const response = await raceSignal(fetcher(url, options), combined);
    if (!response.ok) throw httpError(response.status);
    if (!/^text\/event-stream(?:\s*;|\s*$)/i.test(response.headers?.get('content-type') || '')) {
      Promise.resolve(response.body?.cancel()).catch(() => {});
      throw new ProviderError('模型服务没有返回流式回答，请检查接口格式或使用普通讲解接口。', 502, { code: 'STREAM_UNSUPPORTED', retryable: false });
    }
    return await consumeProviderStream(config.format, response.body, { signal: combined, onDelta });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (combined.aborted || ['TimeoutError', 'AbortError'].includes(error.name)) throw abortError(combined, error);
    throw new ProviderError('模型连接中断，请检查网络后重试。', 502, { code: 'NETWORK_ERROR' });
  }
}

// Keep the process to one upstream request; cancellation releases the slot.
let active = false;
export async function runExclusive(task, { signal } = {}) {
  if (signal?.aborted) throw abortError(signal);
  if (active) throw new ProviderError('已有模型请求正在处理，请等待它完成后重试。', 429, { code: 'BUSY', retryable: true });
  active = true;
  try { return await raceSignal(Promise.resolve().then(task), signal); } finally { active = false; }
}
