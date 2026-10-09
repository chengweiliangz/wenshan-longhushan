import { z } from 'zod';
import { AI_DEFAULTS } from '../shared/aiDefaults.mjs';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formats = ['chat-completions', 'responses', 'anthropic'];
export class ConfigError extends Error { constructor(message) { super(message); this.name = 'ConfigError'; } }
export function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new ConfigError('请填写完整的 API 地址。'); }
  if (url.username || url.password || url.search || url.hash) throw new ConfigError('API 地址不能包含账号、密码、查询参数或片段。');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) throw new ConfigError('远程 API 必须使用 HTTPS；本机模型可使用 HTTP。');
  return url.href.replace(/\/+$/, '');
}
export const settingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1).max(60),
  format: z.enum(formats),
  baseUrl: z.string().trim().min(1).max(500).transform(normalizeBaseUrl),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().max(1024).refine(v => !/[\r\n]/.test(v), '密钥不能包含换行。').optional().default(''),
  authMode: z.enum(['bearer', 'x-api-key']).default('bearer'),
  jsonMode: z.boolean().default(AI_DEFAULTS.jsonMode),
  tokenParameter: z.enum(['max_tokens', 'max_completion_tokens']).default(AI_DEFAULTS.tokenParameter),
  maxTokens: z.number().int().min(256).max(8192).default(AI_DEFAULTS.maxTokens),
  timeoutSeconds: z.number().int().min(10).max(120).default(AI_DEFAULTS.timeoutSeconds),
}).strict();

function fromEnvironment(env) {
  return settingsSchema.parse({
    enabled: env.AI_ENABLED !== 'false' && Boolean(env.AI_API_KEY?.trim()),
    name: env.AI_NAME || AI_DEFAULTS.name,
    format: env.AI_FORMAT || AI_DEFAULTS.format,
    baseUrl: env.AI_BASE_URL || AI_DEFAULTS.baseUrl,
    model: env.AI_MODEL || AI_DEFAULTS.model,
    apiKey: env.AI_API_KEY || '',
    authMode: env.AI_AUTH_MODE || AI_DEFAULTS.authMode,
    jsonMode: env.AI_JSON_MODE ? env.AI_JSON_MODE !== 'false' : AI_DEFAULTS.jsonMode,
    tokenParameter: env.AI_TOKEN_PARAMETER || AI_DEFAULTS.tokenParameter,
    maxTokens: Number(env.AI_MAX_TOKENS || AI_DEFAULTS.maxTokens),
    timeoutSeconds: Number(env.AI_TIMEOUT_SECONDS || AI_DEFAULTS.timeoutSeconds),
  });
}

export function createConfigStore({ filePath = path.join(root, '.local', 'ai-config.json'), env = () => process.env } = {}) {
  const get = () => {
    if (!existsSync(filePath)) return fromEnvironment(env());
    try { return settingsSchema.parse(JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))); }
    catch { throw new ConfigError('本地 AI 配置文件无效，请修复 .local/ai-config.json。'); }
  };
  const resolve = input => {
    const draft = settingsSchema.parse(input);
    const current = get();
    // Never reuse a saved credential for a different API origin (including port).
    const sameOrigin = new URL(draft.baseUrl).origin === new URL(current.baseUrl).origin;
    const apiKey = draft.apiKey || (sameOrigin ? current.apiKey : '');
    if (draft.enabled && !apiKey) throw new ConfigError(sameOrigin ? '请填写 API Key 后再启用 AI。' : 'API 服务地址已改变，请输入该服务的密钥。原密钥不会发送到新地址。');
    return { ...draft, apiKey };
  };
  const save = input => {
    const config = resolve(input);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, filePath);
    return config;
  };
  return { get, resolve, save };
}
export function publicConfig(config) {
  const { apiKey, ...safe } = config;
  return { ...safe, hasKey: Boolean(apiKey), configured: config.enabled && Boolean(apiKey && config.model) };
}
export const configStore = createConfigStore();
