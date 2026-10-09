import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FlaskConical, KeyRound, LoaderCircle, RotateCcw, Save, Settings2, ShieldCheck, X } from 'lucide-react';
import { AI_DEFAULTS } from '../shared/aiDefaults.mjs';

type Format = 'chat-completions' | 'responses' | 'anthropic';
type Form = { enabled: boolean; name: string; format: Format; baseUrl: string; model: string; apiKey: string; authMode: 'bearer' | 'x-api-key'; jsonMode: boolean; tokenParameter: 'max_tokens' | 'max_completion_tokens'; maxTokens: number; timeoutSeconds: number };
type PublicConfig = Omit<Form, 'apiKey'> & { hasKey: boolean; configured: boolean; endpoint: string };
const defaults: Form = { enabled: true, name: AI_DEFAULTS.name, format: AI_DEFAULTS.format as Format, baseUrl: AI_DEFAULTS.baseUrl, model: AI_DEFAULTS.model, apiKey: '', authMode: AI_DEFAULTS.authMode as Form['authMode'], jsonMode: AI_DEFAULTS.jsonMode, tokenParameter: AI_DEFAULTS.tokenParameter as Form['tokenParameter'], maxTokens: AI_DEFAULTS.maxTokens, timeoutSeconds: AI_DEFAULTS.timeoutSeconds };
const ecnuDefaults: Form = { ...defaults, name: '华东师大 ChatECNU', baseUrl: 'https://chat.ecnu.edu.cn/open/api/v1', model: 'ecnu-plus' };
const presets: { id: string; label: string; values: Partial<Form> }[] = [
  { id: 'deepseek', label: 'DeepSeek · 默认推荐', values: defaults },
  { id: 'ecnu', label: '华东师大 · Chat Completions', values: ecnuDefaults },
  { id: 'ecnu-responses', label: '华东师大 · Responses', values: { ...ecnuDefaults, format: 'responses' } },
  { id: 'ecnu-anthropic', label: '华东师大 · Anthropic', values: { ...ecnuDefaults, format: 'anthropic', baseUrl: 'https://chat.ecnu.edu.cn/open/api/anthropic' } },
  { id: 'openai', label: 'OpenAI · Responses', values: { name: 'OpenAI', format: 'responses', baseUrl: 'https://api.openai.com/v1', model: '', authMode: 'bearer', tokenParameter: 'max_completion_tokens' } },

  { id: 'anthropic', label: 'Anthropic · Messages', values: { name: 'Anthropic', format: 'anthropic', baseUrl: 'https://api.anthropic.com', model: '', authMode: 'bearer' } },
];
function endpoint(form: Form) {
  const base = form.baseUrl.trim().replace(/\/+$/, '').replace(/\/(chat\/completions|responses|messages)$/, '');
  if (!base) return '填写 API 地址后显示';
  return form.format === 'anthropic' ? `${base.endsWith('/v1') ? base : `${base}/v1`}/messages` : `${base}/${form.format === 'responses' ? 'responses' : 'chat/completions'}`;
}
async function settingsRequest<T>(suffix = '', body?: Form, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/settings/ai${suffix}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.any([AbortSignal.timeout((body?.timeoutSeconds || defaults.timeoutSeconds) * 1000 + 10000), ...(signal ? [signal] : [])]) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '设置服务暂不可用。');
  return result;
}
export function ApiSettings({ onClose, onSaved }: { onClose: () => void; onSaved: (configured: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const loadingRequest = useRef<AbortController | null>(null);
  const operationRequest = useRef<AbortController | null>(null);
  const [form, setForm] = useState<Form>(defaults);
  const [hasKey, setHasKey] = useState(false);
  const [savedOrigin, setSavedOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<'test' | 'save' | ''>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  function hydrate(result: PublicConfig) {
    const { hasKey: keyPresent, configured: _configured, endpoint: _endpoint, ...fields } = result;
    setForm({ ...defaults, ...fields, apiKey: '' }); setHasKey(keyPresent); setSavedOrigin(new URL(fields.baseUrl).origin);
  }
  function loadSettings() {
    loadingRequest.current?.abort();
    const controller = new AbortController(); loadingRequest.current = controller;
    setLoading(true); setLoadFailed(false); setFeedback(null);
    settingsRequest<PublicConfig>('', undefined, controller.signal).then(result => {
      if (!controller.signal.aborted && mounted.current) { hydrate(result); onSaved(result.configured); }
    }).catch(error => {
      if (!controller.signal.aborted && mounted.current) { setLoadFailed(true); setFeedback({ ok: false, text: error instanceof Error ? error.message : '配置读取失败，请重试。' }); }
    }).finally(() => { if (!controller.signal.aborted && mounted.current) setLoading(false); });
  }
  useEffect(() => {
    mounted.current = true; dialog.current?.showModal(); loadSettings();
    const originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { mounted.current = false; loadingRequest.current?.abort(); operationRequest.current?.abort(); document.body.style.overflow = originalOverflow; };
  }, []);
  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => ({ ...f, [key]: value })); setFeedback(null); }
  let retainKey = false;
  try { retainKey = hasKey && new URL(form.baseUrl).origin === savedOrigin; } catch {}
  async function perform(action: 'test' | 'save') {
    operationRequest.current?.abort();
    const controller = new AbortController(); operationRequest.current = controller;
    setBusy(action); setFeedback(null);
    try {
      if (action === 'test') {
        const result = await settingsRequest<{ latencyMs: number; message: string }>('/test', form, controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        setFeedback({ ok: true, text: `${result.message} 耗时 ${(result.latencyMs / 1000).toFixed(1)} 秒。` });
      } else {
        const result = await settingsRequest<PublicConfig>('', form, controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        hydrate(result); onSaved(result.configured);
        setFeedback({ ok: true, text: result.configured ? '已保存并立即生效。接下来的行程解读、讲解和手记将使用这份配置。' : '已停用 AI，网站使用本地规划与文案模板。' });
      }
    } catch (error) { if (mounted.current && !controller.signal.aborted) setFeedback({ ok: false, text: error instanceof Error ? error.message : '操作失败，请重试。' }); }
    finally { if (mounted.current && !controller.signal.aborted) setBusy(''); }
  }
  return <dialog className="api-dialog" ref={dialog} aria-labelledby="api-title" onCancel={onClose}>
    <div className="api-settings">
      <div className="api-settings-heading"><div className="api-heading-icon"><Settings2 size={23} /></div><div><div className="eyebrow">CONNECT YOUR INTELLIGENCE</div><h2 id="api-title">给小道士，接上你的 AI。</h2></div><button className="icon-button" aria-label="关闭 API 设置" onClick={onClose}><X size={20} /></button></div>
      <p className="api-intro">默认使用 DeepSeek，也可以连接其他兼容服务。配置保存在当前本机服务器，已有配置会优先保留。</p>
      <button className="text-button api-reload" type="button" disabled={loading || Boolean(busy)} onClick={loadSettings}><RotateCcw size={14} />重新读取配置</button>
      {loading ? <div className="api-loading"><LoaderCircle className="spin" size={20} />正在读取配置…</div> : <form onSubmit={e => { e.preventDefault(); void perform('save'); }}>
        <fieldset disabled={Boolean(busy) || loadFailed}>
          <div className="api-enable"><label htmlFor="api-enabled"><strong>启用 AI 服务</strong><span>关闭后仍可使用本地演示功能</span></label><input id="api-enabled" type="checkbox" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} /></div>
          <label className="api-field">快速填入服务预设<select defaultValue="" onChange={e => { const preset = presets.find(p => p.id === e.target.value); if (preset) { setForm(f => ({ ...f, ...preset.values, enabled: true, apiKey: '' })); setFeedback(null); } e.target.value = ''; }}><option value="" disabled>选择一个预设，也可以手动配置</option>{presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <div className="api-two-columns"><label className="api-field">配置名称<input required maxLength={60} value={form.name} onChange={e => update('name', e.target.value)} /></label><label className="api-field">接口格式<select value={form.format} onChange={e => update('format', e.target.value as Format)}><option value="chat-completions">OpenAI Chat Completions</option><option value="responses">OpenAI Responses</option><option value="anthropic">Anthropic Messages</option></select></label></div>
          <label className="api-field">API 地址（Base URL 或完整端点）<input required type="url" spellCheck={false} autoComplete="off" value={form.baseUrl} onChange={e => update('baseUrl', e.target.value)} placeholder={AI_DEFAULTS.baseUrl} /></label>
          <div className="api-endpoint"><span>请求地址</span><code>{endpoint(form)}</code></div>
          <div className="api-two-columns"><label className="api-field">模型名称<input required maxLength={120} list="provider-models" autoComplete="off" value={form.model} onChange={e => update('model', e.target.value)} placeholder="填写账号可用的模型 ID" /><datalist id="provider-models"><option value={AI_DEFAULTS.model} /><option value="ecnu-plus" /><option value="ecnu-max" /></datalist></label><label className="api-field">API Key <span className="api-key-state"><KeyRound size={11} />{retainKey ? '已保存 · 不回显' : '等待配置'}</span><input type="password" maxLength={1024} autoComplete="new-password" spellCheck={false} value={form.apiKey} onChange={e => update('apiKey', e.target.value)} placeholder={retainKey ? '留空继续使用已保存密钥' : '输入这个服务的密钥'} /></label></div>
          {hasKey && !retainKey && <p className="api-key-warning">服务地址已改变，请输入新服务的密钥。原密钥不会发送到新地址。</p>}
          <details className="api-advanced"><summary>高级兼容选项<ChevronDown size={14} /></summary><div className="api-two-columns"><label className="api-field">输出 Token 上限<input type="number" min={256} max={8192} required value={form.maxTokens} onChange={e => update('maxTokens', Number(e.target.value))} /></label><label className="api-field">超时时间（秒）<input type="number" min={10} max={120} required value={form.timeoutSeconds} onChange={e => update('timeoutSeconds', Number(e.target.value))} /></label></div>{form.format === 'anthropic' ? <label className="api-field">认证方式<select value={form.authMode} onChange={e => update('authMode', e.target.value as Form['authMode'])}><option value="bearer">Authorization: Bearer（华东师大）</option><option value="x-api-key">x-api-key（兼容旧式认证）</option></select></label> : <><label className="api-checkbox"><input type="checkbox" checked={form.jsonMode} onChange={e => update('jsonMode', e.target.checked)} /><span>使用原生 JSON 模式</span></label><p className="api-help">服务不支持 JSON 参数时可关闭；返回内容仍需通过 JSON 校验。</p>{form.format === 'chat-completions' && <label className="api-field">Token 参数名<select value={form.tokenParameter} onChange={e => update('tokenParameter', e.target.value as Form['tokenParameter'])}><option value="max_tokens">max_tokens（华东师大、兼容服务）</option><option value="max_completion_tokens">max_completion_tokens（OpenAI 新模型）</option></select></label>}</>}</details>
          <div className="api-security"><ShieldCheck size={17} /><p>密钥只提交给本机服务器，并用于请求上方地址。保存后不回传到浏览器，也不放入浏览器本地存储。</p></div>
        </fieldset>
        {feedback && <div className={`api-feedback ${feedback.ok ? 'success' : 'error'}`} role="status">{feedback.ok && <Check size={17} />}<span>{feedback.text}</span></div>}
        <div className="api-settings-actions"><a href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek 接口文档 ↗</a><div><button className="api-test-button" type="button" disabled={Boolean(busy) || !form.enabled || loadFailed} onClick={() => { const element = dialog.current?.querySelector('form'); if (element?.reportValidity()) void perform('test'); }}>{busy === 'test' ? <LoaderCircle className="spin" size={15} /> : <FlaskConical size={15} />}{busy === 'test' ? '正在测试…' : '测试连接'}</button><button className="primary" type="submit" disabled={Boolean(busy) || loadFailed}>{busy === 'save' ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}保存并应用</button></div></div>
        <p className="api-test-note">测试会发起一次简短模型请求，可能消耗少量配额。测试成功后仍需保存。</p>
      </form>}
    </div>
  </dialog>;
}
