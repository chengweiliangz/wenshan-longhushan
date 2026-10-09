// Shared public defaults contain no credential. Saved owner settings take precedence.
export const AI_DEFAULTS = Object.freeze({
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  format: 'chat-completions',
  authMode: 'bearer',
  jsonMode: true,
  tokenParameter: 'max_tokens',
  maxTokens: 1800,
  timeoutSeconds: 45,
});
