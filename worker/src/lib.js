// Pure helpers for the Worker. Kept separate from index.js so they're
// testable in plain Node without Hono.

// Whitelist of model identifiers the client may pick. Must mirror MODELS
// in src/config.js.
export const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-120b:free',
  'deepseek/deepseek-v4-flash'
]);

// Whitelist of provider pins the client may set. Anything else is rejected
// to keep the surface area small.
export const ALLOWED_PROVIDERS = new Set([
  'cerebras/fp16'
]);

export const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-120b';
export const OPENROUTER_DEFAULT_PROVIDER = 'cerebras/fp16';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Validate client-supplied model + optional provider. Falls back to defaults
// if either is missing or not whitelisted.
export function pickModel(requestedModel, requestedProvider) {
  const model = (typeof requestedModel === 'string' && ALLOWED_MODELS.has(requestedModel))
    ? requestedModel
    : OPENROUTER_DEFAULT_MODEL;
  const provider = (typeof requestedProvider === 'string' && ALLOWED_PROVIDERS.has(requestedProvider))
    ? requestedProvider
    : OPENROUTER_DEFAULT_PROVIDER;
  return { model, provider };
}

// Gate for /auth/dev-login. Returns true if the request is allowed to proceed.
// - In production: requires a token (from query string or X-Dev-Login-Token
//   header) that matches the DEV_LOGIN_TOKEN env var. The token is set via
//   `wrangler secret put DEV_LOGIN_TOKEN`. Anyone without the token gets 404.
// - In any other environment: requires a localhost Origin so a malicious
//   external site can't trigger this by spoofing the Origin header.
export function isDevLoginAllowed({ environment, providedToken, expectedToken, origin }) {
  if (environment === 'production') {
    return Boolean(expectedToken && providedToken && providedToken === expectedToken);
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}

// Build the exact request body sent to OpenRouter. Exported so tests can
// assert the shape without mocking fetch.
export function buildOpenRouterBody({ messages, model, provider, temperature, maxTokens, topP = 0.9 }) {
  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    include_reasoning: false,
    response_format: { type: 'json_object' },
    // Pin the request to a specific provider for low-latency routing.
    // allow_fallbacks: false so we always get the provider we asked for.
    provider: { order: [provider], allow_fallbacks: false },
    // gpt-oss-120b is a reasoning model; without this it can spend the
    // entire max_tokens budget on internal thinking and produce no
    // visible content. `low` keeps reasoning short so the model still
    // has tokens left for the actual JSON output.
    reasoning: { effort: 'low' }
  };
}

// Build the headers sent to OpenRouter. `appUrl` is used for the
// HTTP-Referer field which OpenRouter uses for ranking/attribution.
export function buildOpenRouterHeaders(apiKey, appUrl) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': appUrl || 'https://atharva2099.github.io/Trip.AI',
    'X-Title': 'Trip.AI'
  };
}

// Call OpenRouter and return the assistant message content. Throws on
// non-2xx or malformed responses. `fetcher` is injected for tests.
export async function callOpenRouter({ messages, model, provider, temperature, maxTokens, apiKey, appUrl, timeoutMs = 300000 }, fetcher = fetch) {
  if (!apiKey) {
    const err = new Error('OPENROUTER_API_KEY is not configured on the server. Set it in worker/.dev.vars (dev) or via `wrangler secret put` (prod), then restart.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  // Reject obviously-placeholder keys early so the user gets a clear
  // message instead of a confusing "User not found." from OpenRouter.
  if (/REPLACE-ME|YOUR-KEY|placeholder/i.test(apiKey)) {
    const err = new Error('OPENROUTER_API_KEY is still a placeholder. Replace it in worker/.dev.vars with a real key from openrouter.ai/keys.');
    err.code = 'PLACEHOLDER_API_KEY';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetcher(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: buildOpenRouterHeaders(apiKey, appUrl),
      body: JSON.stringify(buildOpenRouterBody({ messages, model, provider, temperature, maxTokens }))
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || `OpenRouter error: ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      console.error(`[openrouter] ${res.status} ${msg} | model=${model} | provider=${provider}`);
      throw err;
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    const content = message?.content;
    if (content === undefined || content === null) {
      // Debug: surface the actual response shape so we can diagnose
      // reasoning-model content placement (gpt-oss-120b puts text in
      // `reasoning` or `content` depending on whether reasoning is on).
      console.error('[openrouter] no content in response. keys:', Object.keys(data || {}), 'message keys:', Object.keys(message || {}), 'raw:', JSON.stringify(data).slice(0, 500));
      throw new Error('No content in response');
    }
    return content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Per-IP token bucket. In-memory only — fine for a single-worker CF deploy.
const buckets = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: limit, resetAt: now + windowMs };
  if (now > b.resetAt) {
    b.tokens = limit;
    b.resetAt = now + windowMs;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}

// Tolerant JSON extractor: handles plain JSON, ```json fences, plain ``` fences,
// and JSON embedded in surrounding prose. Returns null on failure.
export function parseModelJson(content) {
  if (!content) return null;
  const cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

// ─── Exa grounding ───────────────────────────────────────────

// In-memory cache: cacheKey -> { text, expiresAt }
const groundingCache = new Map();
const GROUNDING_TTL_MS = 60 * 60 * 1000; // 1 hour

const GROUNDING_TIMEOUT_MS = 3500;

// Exa search behaviour:
//   - returns the joined highlights string on success (may be '' if no highlights found)
//   - returns null on request failure (non-2xx, network error, abort) so the caller
//     can distinguish "no results" from "request failed" and decide whether to retry
async function exaSearch(query, apiKey, fetcher, signal) {
  if (!apiKey || !query) return '';
  try {
    const res = await fetcher('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: 5,
        contents: { highlights: { numSentences: 3, highlightsPerUrl: 1 } }
      }),
      signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];
    const lines = [];
    for (const r of results) {
      const hl = (r.highlights || []).join(' ');
      if (hl) lines.push(`- ${hl}`);
    }
    return lines.join('\n');
  } catch {
    return null;
  }
}

// Wrap exaSearch with retries. Always tries at least EXA_RETRY_ATTEMPTS times
// before giving up — we never silently degrade on a single transient failure.
const EXA_RETRY_ATTEMPTS = 3;
const EXA_RETRY_DELAYS_MS = [0, 500, 1500]; // backoff between attempts

async function exaSearchWithRetry(query, apiKey, fetcher, signal) {
  for (let attempt = 0; attempt < EXA_RETRY_ATTEMPTS; attempt++) {
    if (signal?.aborted) return '';
    if (EXA_RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, EXA_RETRY_DELAYS_MS[attempt]);
        signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
      });
    }
    const result = await exaSearch(query, apiKey, fetcher, signal);
    if (result !== null) {
      // Only log the "interesting" case: a retry actually saved us.
      // First-try successes are silent.
      if (attempt > 0) {
        console.log(`[exa] recovered on attempt ${attempt + 1}/${EXA_RETRY_ATTEMPTS} for "${query.slice(0, 50)}..."`);
      }
      return result;
    }
    // Per-attempt failures are silent — only the final "gave up" is logged below.
  }
  console.error(`[exa] gave up after ${EXA_RETRY_ATTEMPTS} attempts for "${query.slice(0, 50)}..."`);
  return '';
}

// Pull recent web context for a destination so the LLM doesn't hallucinate.
// Returns a single string to inject into the system prompt, or '' on failure.
export async function groundItineraryContext({ destination, home }, apiKey, fetcher = fetch) {
  if (!apiKey) return '';
  if (!destination) return '';
  const cacheKey = `${destination}::${home || ''}`;
  const cached = groundingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const queries = [
    `top attractions and things to do in ${destination} 2025`,
    `${destination} average daily cost for tourists food activities transport 2025`
  ];
  if (home && home !== destination) {
    queries.push(`how to travel from ${home} to ${destination} options flight train bus 2025`);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), GROUNDING_TIMEOUT_MS);

  try {
    const results = await Promise.all(queries.map(q => exaSearchWithRetry(q, apiKey, fetcher, ac.signal)));
    const combined = results
      .map((text, i) => text ? `WEB CONTEXT (${queries[i]}):\n${text}` : '')
      .filter(Boolean)
      .join('\n\n');
    if (combined) {
      groundingCache.set(cacheKey, { text: combined, expiresAt: Date.now() + GROUNDING_TTL_MS });
    } else {
      console.warn(`[grounding] no Exa results for "${destination}" — LLM will run without web context`);
    }
    return combined;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

// Test-only: clear the grounding cache.
export function _clearGroundingCache() {
  groundingCache.clear();
}
