// Single source of truth for the Worker/API base URL.
// Override at build time with REACT_APP_API_BASE.
export const API_BASE = process.env.REACT_APP_API_BASE || 'https://tripai-api.athuspydy.workers.dev';

// Whitelist of models the client may pick.
//
// Each entry has:
//   - id:       stable React key (also used as the saved-trip "model" tag)
//   - value:    the OpenRouter model identifier sent in API requests
//   - label:    user-facing dropdown text
//   - provider: optional OpenRouter provider pin (e.g. 'cerebras/fp16') for
//               lowest-latency routing. Omit for default routing.
//
// Must mirror ALLOWED_MODELS in worker/src/lib.js.
export const MODELS = [
  { id: 'gpt-oss-120b-cerebras',  value: 'openai/gpt-oss-120b',         label: 'GPT-OSS 120B · Cerebras FP16', provider: 'cerebras/fp16' },
  { id: 'deepseek-v4-flash',      value: 'deepseek/deepseek-v4-flash',  label: 'DeepSeek V4 Flash' },
  { id: 'gpt-oss-120b-auto',      value: 'openai/gpt-oss-120b',         label: 'GPT-OSS 120B (auto-route)' },
  { id: 'gpt-oss-120b-free',      value: 'openai/gpt-oss-120b:free',    label: 'GPT-OSS 120B (Free)' }
];

export const DEFAULT_MODEL = MODELS[0].id;
