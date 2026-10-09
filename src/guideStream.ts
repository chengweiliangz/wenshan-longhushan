export type GuideSource = { id: string; title: string; url: string; checked?: string };
export type GuideHistoryMessage = { role: 'user' | 'assistant'; content: string };
export type GuideRequest = { question: string; spotId?: string; history: GuideHistoryMessage[] };
export type GuideMeta = { mode: 'ai' | 'local'; modeLabel: string; sources: GuideSource[]; model?: string; provider?: string };
export type GuideStreamEvent =
  | { type: 'meta'; data: GuideMeta }
  | { type: 'delta'; data: { text: string } }
  | { type: 'done'; data: { ok: true; answer?: string } }
  | { type: 'error'; data: { message: string; code?: string; retryable?: boolean } };

export class GuideStreamError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(message: string, code = 'connection_error', retryable = true) {
    super(message);
    this.name = 'GuideStreamError';
    this.code = code;
    this.retryable = retryable;
  }
}

function decodeEvent(type: string, data: string): GuideStreamEvent | null {
  if (!['meta', 'delta', 'done', 'error'].includes(type)) return null;
  let value: unknown;
  try { value = JSON.parse(data); }
  catch { throw new GuideStreamError('回复数据格式有误，请重试。', 'invalid_stream'); }
  if (!value || typeof value !== 'object') throw new GuideStreamError('回复数据格式有误，请重试。', 'invalid_stream');
  const fields = value as Record<string, unknown>;
  if (type === 'meta' && (fields.mode === 'ai' || fields.mode === 'local') && typeof fields.modeLabel === 'string' && Array.isArray(fields.sources)) {
    return { type, data: { mode: fields.mode, modeLabel: fields.modeLabel, sources: fields.sources.filter((source): source is GuideSource => Boolean(source) && typeof source === 'object' && typeof source.id === 'string' && typeof source.title === 'string' && typeof source.url === 'string'), ...(typeof fields.model === 'string' ? { model: fields.model } : {}), ...(typeof fields.provider === 'string' ? { provider: fields.provider } : {}) } };
  }
  if (type === 'delta' && typeof fields.text === 'string') return { type, data: { text: fields.text } };
  if (type === 'done' && fields.ok === true && (fields.answer === undefined || typeof fields.answer === 'string')) return { type, data: { ok: true, ...(typeof fields.answer === 'string' ? { answer: fields.answer } : {}) } };
  if (type === 'error' && typeof fields.message === 'string') return { type, data: { message: fields.message, ...(typeof fields.code === 'string' ? { code: fields.code } : {}), ...(typeof fields.retryable === 'boolean' ? { retryable: fields.retryable } : {}) } };
  throw new GuideStreamError('回复数据格式有误，请重试。', 'invalid_stream');
}

// SSE records and UTF-8 characters can both span network chunks.
export function createGuideSSEParser(onEvent: (event: GuideStreamEvent) => void) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  let eventType = '';
  let dataLines: string[] = [];
  let finished = false;
  function dispatch() {
    if (dataLines.length) {
      const event = decodeEvent(eventType || 'message', dataLines.join('\n'));
      if (event) onEvent(event);
    }
    eventType = '';
    dataLines = [];
  }
  function line(value: string) {
    if (!value) return dispatch();
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const field = colon < 0 ? value : value.slice(0, colon);
    let contents = colon < 0 ? '' : value.slice(colon + 1);
    if (contents.startsWith(' ')) contents = contents.slice(1);
    if (field === 'event') eventType = contents;
    else if (field === 'data') dataLines.push(contents);
  }
  function consume(final = false) {
    let start = 0;
    for (let index = 0; index < pending.length; index++) {
      const char = pending[index];
      if (char !== '\n' && char !== '\r') continue;
      if (char === '\r' && index === pending.length - 1 && !final) break;
      line(pending.slice(start, index));
      if (char === '\r' && pending[index + 1] === '\n') index++;
      start = index + 1;
    }
    pending = pending.slice(start);
    if (final) {
      if (pending) line(pending);
      pending = '';
      dispatch();
    }
  }
  return {
    push(chunk: Uint8Array) {
      if (finished) throw new GuideStreamError('回复流已经结束。', 'invalid_stream');
      try { pending += decoder.decode(chunk, { stream: true }); }
      catch { throw new GuideStreamError('回复文字编码有误，请重试。', 'invalid_stream'); }
      consume();
    },
    finish() {
      if (finished) return;
      finished = true;
      try { pending += decoder.decode(); }
      catch { throw new GuideStreamError('回复文字编码有误，请重试。', 'invalid_stream'); }
      consume(true);
    },
  };
}

type HistoryTurn = { id: string; role: 'user' | 'guide'; text: string; status?: string; replyTo?: string };
// Send complete question/answer pairs only. Failed, cancelled and greeting text
// are deliberately excluded from the next model request.
export function completedGuideHistory(turns: readonly HistoryTurn[]): GuideHistoryMessage[] {
  const pairs: GuideHistoryMessage[][] = [];
  for (const answer of turns) {
    if (answer.role !== 'guide' || answer.status !== 'complete' || !answer.text.trim() || !answer.replyTo) continue;
    const question = turns.find(turn => turn.id === answer.replyTo && turn.role === 'user');
    if (!question?.text.trim()) continue;
    pairs.push([{ role: 'user', content: question.text.trim().slice(0, 500) }, { role: 'assistant', content: answer.text.trim().slice(0, 1800) }]);
  }
  const history: GuideHistoryMessage[] = [];
  let characters = 0;
  for (const pair of pairs.slice(-6).reverse()) {
    const size = pair.reduce((sum, message) => sum + message.content.length, 0);
    if (characters + size > 8000) break;
    history.unshift(...pair);
    characters += size;
  }
  return history;
}

export async function requestGuideStream(body: GuideRequest, onEvent: (event: GuideStreamEvent) => void, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<void> {
  signal.throwIfAborted();
  const response = await fetcher('/api/guide/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  signal.throwIfAborted();
  if (!response.ok) {
    let message = '讲解服务暂时不可用，请重试。';
    try { const error = await response.json(); if (typeof error?.error === 'string') message = error.error; } catch {}
    throw new GuideStreamError(message, `http_${response.status}`, response.status !== 400);
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new GuideStreamError('没有收到有效的流式回复，请重试。', 'invalid_stream');
  const reader = response.body.getReader();
  let done = false;
  let meta = false;
  let text = '';
  const parser = createGuideSSEParser(event => {
    if (done) return;
    signal.throwIfAborted();
    if (event.type === 'error') throw new GuideStreamError(event.data.message, event.data.code, event.data.retryable);
    if (event.type === 'meta') meta = true;
    else if (event.type === 'delta') text += event.data.text;
    else if (event.type === 'done') {
      if (!meta || !(event.data.answer ?? text).trim()) throw new GuideStreamError('没有收到完整的讲解，请重试。', 'empty_answer');
      done = true;
    }
    onEvent(event);
  });
  const abortReader = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener('abort', abortReader, { once: true });
  try {
    while (!done) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) { parser.finish(); break; }
      parser.push(chunk.value);
    }
    if (!done) throw new GuideStreamError('回答中断了，请重试。', 'interrupted');
  } finally {
    signal.removeEventListener('abort', abortReader);
    // Release the transport even if the server forgot to close after done.
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
  }
}
