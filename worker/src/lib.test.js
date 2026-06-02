import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseModelJson,
  rateLimit,
  groundItineraryContext,
  _clearGroundingCache,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_PROVIDER,
  pickModel,
  ALLOWED_MODELS,
  ALLOWED_PROVIDERS,
  buildOpenRouterBody,
  buildOpenRouterHeaders,
  callOpenRouter,
  OPENROUTER_URL,
  isDevLoginAllowed
} from './lib.js';

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"name":"X","cost":10}')).toEqual({ name: 'X', cost: 10 });
  });

  it('strips ```json fences', () => {
    expect(parseModelJson('```json\n{"name":"X","cost":10}\n```')).toEqual({ name: 'X', cost: 10 });
  });

  it('strips plain ``` fences', () => {
    expect(parseModelJson('```\n{"name":"X","cost":10}\n```')).toEqual({ name: 'X', cost: 10 });
  });

  it('extracts JSON embedded in prose', () => {
    expect(parseModelJson('Here: {"name":"X","cost":10} thanks!')).toEqual({ name: 'X', cost: 10 });
  });

  it('returns null on garbage', () => {
    expect(parseModelJson('sorry, I cannot help with that')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(parseModelJson('')).toBeNull();
    expect(parseModelJson(null)).toBeNull();
    expect(parseModelJson(undefined)).toBeNull();
  });
});

describe('rateLimit', () => {
  it('allows up to the limit, then rejects', () => {
    const key = `rl:${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it('refills after the window expires', () => {
    const key = `rl:${Math.random()}`;
    expect(rateLimit(key, 1, 10)).toBe(true);
    expect(rateLimit(key, 1, 10)).toBe(false);
    return new Promise(resolve => {
      setTimeout(() => {
        expect(rateLimit(key, 1, 10)).toBe(true);
        resolve();
      }, 20);
    });
  });
});

describe('OPENROUTER_DEFAULT_MODEL', () => {
  it('is GPT-OSS 120B (cheapest + reasoning-capable MoE)', () => {
    expect(OPENROUTER_DEFAULT_MODEL).toBe('openai/gpt-oss-120b');
  });
});

describe('OPENROUTER_DEFAULT_PROVIDER', () => {
  it('is cerebras/fp16 for the lowest-latency routing', () => {
    expect(OPENROUTER_DEFAULT_PROVIDER).toBe('cerebras/fp16');
  });
});

describe('pickModel', () => {
  it('passes through a whitelisted model and provider', () => {
    const r = pickModel('openai/gpt-oss-120b', 'cerebras/fp16');
    expect(r).toEqual({ model: 'openai/gpt-oss-120b', provider: 'cerebras/fp16' });
  });

  it('uses the default model for an unknown model string', () => {
    const r = pickModel('gpt-9000', 'cerebras/fp16');
    expect(r.model).toBe(OPENROUTER_DEFAULT_MODEL);
    expect(r.provider).toBe('cerebras/fp16');
  });

  it('uses the default provider for an unknown provider string', () => {
    const r = pickModel('openai/gpt-oss-120b', 'some-bogus-provider');
    expect(r.model).toBe('openai/gpt-oss-120b');
    expect(r.provider).toBe(OPENROUTER_DEFAULT_PROVIDER);
  });

  it('falls back to defaults for missing/garbage input', () => {
    expect(pickModel(undefined, undefined)).toEqual({ model: OPENROUTER_DEFAULT_MODEL, provider: OPENROUTER_DEFAULT_PROVIDER });
    expect(pickModel(null, null)).toEqual({ model: OPENROUTER_DEFAULT_MODEL, provider: OPENROUTER_DEFAULT_PROVIDER });
    expect(pickModel(42, 42)).toEqual({ model: OPENROUTER_DEFAULT_MODEL, provider: OPENROUTER_DEFAULT_PROVIDER });
  });

  it('whitelist contains the models advertised in the UI', () => {
    const advertised = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-120b:free',
      'deepseek/deepseek-v4-flash'
    ];
    for (const m of advertised) {
      expect(ALLOWED_MODELS.has(m), `expected ${m} in ALLOWED_MODELS`).toBe(true);
    }
  });

  it('whitelist contains the cerebras/fp16 provider', () => {
    expect(ALLOWED_PROVIDERS.has('cerebras/fp16')).toBe(true);
  });
});

describe('isDevLoginAllowed', () => {
  describe('in production', () => {
    it('allows when provided token matches expected', () => {
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: 'secret123',
        expectedToken: 'secret123'
      })).toBe(true);
    });

    it('blocks when no token is provided', () => {
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: null,
        expectedToken: 'secret123'
      })).toBe(false);
    });

    it('blocks when provided token does not match', () => {
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: 'wrong',
        expectedToken: 'secret123'
      })).toBe(false);
    });

    it('blocks when DEV_LOGIN_TOKEN is not set in the secret store', () => {
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: 'secret123',
        expectedToken: null
      })).toBe(false);
    });

    it('blocks when both are empty', () => {
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: null,
        expectedToken: null
      })).toBe(false);
    });

    it('ignores Origin in production (token-only gate)', () => {
      // In prod, we don't care about Origin — only the token matters.
      // An attacker with the token can sign in from anywhere, by design.
      expect(isDevLoginAllowed({
        environment: 'production',
        providedToken: 'secret123',
        expectedToken: 'secret123',
        origin: 'https://evil.example.com'
      })).toBe(true);
    });
  });

  describe('in dev / staging / unspecified environment', () => {
    it('allows when origin is localhost', () => {
      expect(isDevLoginAllowed({
        environment: undefined,
        providedToken: undefined,
        expectedToken: undefined,
        origin: 'http://localhost:3000'
      })).toBe(true);
    });

    it('allows when origin is 127.0.0.1', () => {
      expect(isDevLoginAllowed({
        origin: 'http://127.0.0.1:3000'
      })).toBe(true);
    });

    it('blocks when origin is missing', () => {
      expect(isDevLoginAllowed({
        origin: ''
      })).toBe(false);
    });

    it('blocks when origin is a non-localhost URL', () => {
      expect(isDevLoginAllowed({
        origin: 'https://example.com'
      })).toBe(false);
    });

    it('blocks when origin is the production frontend', () => {
      expect(isDevLoginAllowed({
        origin: 'https://atharva2099.github.io'
      })).toBe(false);
    });

    it('does not require a token in dev (localhost is enough)', () => {
      expect(isDevLoginAllowed({
        environment: 'development',
        providedToken: null,
        expectedToken: 'some-token',
        origin: 'http://localhost:3000'
      })).toBe(true);
    });
  });
});

describe('groundItineraryContext', () => {
  beforeEach(() => {
    _clearGroundingCache();
  });

  const makeExaResponse = (highlights) => ({
    ok: true,
    json: async () => ({ results: highlights.map(text => ({ highlights: [text] })) })
  });

  const makeFetcher = (handler) => async (url, opts) => {
    return handler(url, opts);
  };

  it('returns empty string when no API key', async () => {
    const fetcher = makeFetcher(() => makeExaResponse(['something']));
    const text = await groundItineraryContext({ destination: 'Lisbon' }, '', fetcher);
    expect(text).toBe('');
  });

  it('returns empty string on no destination', async () => {
    const fetcher = makeFetcher(() => makeExaResponse(['x']));
    const text = await groundItineraryContext({}, 'key', fetcher);
    expect(text).toBe('');
  });

  it('returns concatenated highlights for destination + home', async () => {
    const fetcher = makeFetcher((url, opts) => {
      const body = JSON.parse(opts.body);
      if (body.query.includes('attractions')) return makeExaResponse(['Top attraction: Belem Tower']);
      if (body.query.includes('daily cost')) return makeExaResponse(['Typical daily cost: $80']);
      if (body.query.includes('how to travel')) return makeExaResponse(['Flight takes 3h 10m']);
      return makeExaResponse([]);
    });
    const text = await groundItineraryContext({ destination: 'Lisbon', home: 'Berlin' }, 'key', fetcher);
    expect(text).toContain('Belem Tower');
    expect(text).toContain('$80');
    expect(text).toContain('Flight takes 3h 10m');
    expect(text).toContain('WEB CONTEXT');
  });

  it('omits transport query when home is same as destination', async () => {
    let queries = [];
    const fetcher = makeFetcher((url, opts) => {
      queries.push(JSON.parse(opts.body).query);
      return makeExaResponse(['ok']);
    });
    await groundItineraryContext({ destination: 'Paris', home: 'Paris' }, 'key', fetcher);
    expect(queries).toHaveLength(2);
    expect(queries.some(q => q.includes('how to travel'))).toBe(false);
  });

  it('returns empty string when all exa calls fail', async () => {
    const fetcher = makeFetcher(() => ({ ok: false, json: async () => ({}) }));
    const text = await groundItineraryContext({ destination: 'Tokyo' }, 'key', fetcher);
    expect(text).toBe('');
  });

  it('caches successful results', async () => {
    let calls = 0;
    const fetcher = makeFetcher(() => {
      calls += 1;
      return makeExaResponse(['unique-highlight-A']);
    });
    await groundItineraryContext({ destination: 'Lisbon' }, 'key', fetcher);
    await groundItineraryContext({ destination: 'Lisbon' }, 'key', fetcher);
    // 2 queries on first call (no home), cached on second — should be 2, not 4.
    expect(calls).toBe(2);
  });

  it('uses a different cache key for different destinations', async () => {
    let calls = 0;
    const fetcher = makeFetcher(() => {
      calls += 1;
      return makeExaResponse(['x']);
    });
    await groundItineraryContext({ destination: 'Lisbon' }, 'key', fetcher);
    await groundItineraryContext({ destination: 'Tokyo' }, 'key', fetcher);
    // 2 queries each, no cache hit — expect 4
    expect(calls).toBe(4);
  });
});

// Test the retry-on-failure behaviour. The previous tests used
// exaSearchWithRetry indirectly via groundItineraryContext, but didn't
// exercise the retry path. The functions aren't exported, so we drive
// the full flow with a flaky fetcher and assert the call count.
//
// Note: groundItineraryContext always runs 2 queries by default
// (top attractions + average cost). Add a `home` and it runs 3.
// Per-query retries are independent — one query's failure doesn't
// affect the other.
describe('groundItineraryContext — retry on transient failure', () => {
  beforeEach(() => _clearGroundingCache());

  it('retries each query up to 3 times when the first attempts fail', async () => {
    let callCount = 0;
    const callsByQuery = {};
    const fetcher = async (url, opts) => {
      callCount += 1;
      const query = JSON.parse(opts.body).query;
      callsByQuery[query] = (callsByQuery[query] || 0) + 1;
      // Each query fails its first 2 attempts, then succeeds on the 3rd
      if (callsByQuery[query] < 3) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ results: [{ highlights: ['recovered!'] }] }) };
    };
    const text = await groundItineraryContext({ destination: 'TestRetry' }, 'key', fetcher);
    expect(text).toContain('recovered!');
    // 2 queries × 3 attempts each = 6 fetcher calls
    expect(callCount).toBe(6);
    // Each query was retried
    expect(Object.values(callsByQuery).every(n => n === 3)).toBe(true);
  });

  it('does not retry on first-try success', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return { ok: true, status: 200, json: async () => ({ results: [{ highlights: ['first try!'] }] }) };
    };
    const text = await groundItineraryContext({ destination: 'TestNoRetry' }, 'key', fetcher);
    expect(text).toContain('first try!');
    // 2 queries, each succeeds on first try = 2 fetcher calls
    expect(callCount).toBe(2);
  });

  it('gives up after 3 attempts and returns empty string (degraded)', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return { ok: false, status: 500, json: async () => ({}) };
    };
    const text = await groundItineraryContext({ destination: 'TestGiveUp' }, 'key', fetcher);
    expect(text).toBe('');
    // 2 queries × 3 attempts each = 6 fetcher calls
    expect(callCount).toBe(6);
  });

  it('counts attempts per-query, not per-call (independent retries)', async () => {
    const counts = {};
    const fetcher = async (url, opts) => {
      const query = JSON.parse(opts.body).query;
      counts[query] = (counts[query] || 0) + 1;
      // The 'attractions' query succeeds on first try; the 'daily cost' query fails twice then succeeds
      if (query.includes('average daily cost')) {
        if (counts[query] < 3) {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ results: [{ highlights: ['cost ok'] }] }) };
      }
      return { ok: true, status: 200, json: async () => ({ results: [{ highlights: ['attractions ok'] }] }) };
    };
    const text = await groundItineraryContext({ destination: 'TestIndependent' }, 'key', fetcher);
    expect(text).toContain('cost ok');
    expect(text).toContain('attractions ok');
    // 'attractions' query: 1 attempt, 'cost' query: 3 attempts = 4 total fetcher calls
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('buildOpenRouterBody', () => {
  const baseOpts = {
    messages: [{ role: 'user', content: 'hi' }],
    model: 'openai/gpt-oss-120b',
    provider: 'cerebras/fp16',
    temperature: 0.3,
    maxTokens: 5000
  };

  it('includes the exact fields OpenRouter expects', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body).toEqual({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.3,
      max_tokens: 5000,
      top_p: 0.9,
      include_reasoning: false,
      response_format: { type: 'json_object' },
      provider: { order: ['cerebras/fp16'], allow_fallbacks: false },
      reasoning: { effort: 'low' }
    });
  });

  it('disables reasoning explicitly so gpt-oss does not emit thinking traces', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body.include_reasoning).toBe(false);
  });

  it('limits gpt-oss reasoning effort to low so the model has tokens left for the JSON output', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body.reasoning).toEqual({ effort: 'low' });
  });

  it('pins the provider with allow_fallbacks: false so we always get cerebras', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body.provider.order).toEqual(['cerebras/fp16']);
    expect(body.provider.allow_fallbacks).toBe(false);
  });

  it('requests structured JSON output', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('uses top_p: 0.9 by default for tighter sampling', () => {
    const body = buildOpenRouterBody(baseOpts);
    expect(body.top_p).toBe(0.9);
  });

  it('lets callers override top_p if needed', () => {
    const body = buildOpenRouterBody({ ...baseOpts, topP: 0.95 });
    expect(body.top_p).toBe(0.95);
  });
});

describe('buildOpenRouterHeaders', () => {
  it('includes Authorization with Bearer token', () => {
    const h = buildOpenRouterHeaders('sk-test-123', 'https://example.com');
    expect(h['Authorization']).toBe('Bearer sk-test-123');
  });

  it('includes Content-Type application/json', () => {
    const h = buildOpenRouterHeaders('k', 'u');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('uses the provided appUrl for HTTP-Referer', () => {
    const h = buildOpenRouterHeaders('k', 'https://myapp.com');
    expect(h['HTTP-Referer']).toBe('https://myapp.com');
  });

  it('falls back to the production Trip.AI URL when no appUrl given', () => {
    const h = buildOpenRouterHeaders('k', '');
    expect(h['HTTP-Referer']).toBe('https://atharva2099.github.io/Trip.AI');
  });

  it('sets X-Title header to Trip.AI', () => {
    const h = buildOpenRouterHeaders('k', 'u');
    expect(h['X-Title']).toBe('Trip.AI');
  });
});

describe('callOpenRouter', () => {
  const baseArgs = {
    messages: [{ role: 'user', content: 'Plan me a trip' }],
    model: 'openai/gpt-oss-120b',
    provider: 'cerebras/fp16',
    temperature: 0.3,
    maxTokens: 5000,
    apiKey: 'sk-test',
    appUrl: 'https://example.com'
  };

  const makeFetcher = (handler) => async (url, opts) => handler(url, opts);
  const okResponse = (body) => ({
    ok: true,
    status: 200,
    json: async () => body
  });

  it('sends the request to the OpenRouter chat completions endpoint', async () => {
    let captured = null;
    const fetcher = makeFetcher((url, opts) => {
      captured = { url, opts };
      return okResponse({ choices: [{ message: { content: 'ok' } }] });
    });
    await callOpenRouter(baseArgs, fetcher);
    expect(captured.url).toBe(OPENROUTER_URL);
    expect(captured.url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('sends the body with the exact model + provider pinning', async () => {
    let body = null;
    const fetcher = makeFetcher((url, opts) => {
      body = JSON.parse(opts.body);
      return okResponse({ choices: [{ message: { content: 'ok' } }] });
    });
    await callOpenRouter(baseArgs, fetcher);
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.provider).toEqual({ order: ['cerebras/fp16'], allow_fallbacks: false });
  });

  it('returns the assistant message content on success', async () => {
    const fetcher = makeFetcher(() => okResponse({ choices: [{ message: { content: 'Itinerary JSON here' } }] }));
    const out = await callOpenRouter(baseArgs, fetcher);
    expect(out).toBe('Itinerary JSON here');
  });

  it('throws with the OpenRouter error message on non-2xx', async () => {
    const fetcher = makeFetcher(() => ({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } })
    }));
    await expect(callOpenRouter(baseArgs, fetcher)).rejects.toThrow('Model not found');
  });

  it('falls back to a generic error message when the body is not JSON', async () => {
    const fetcher = makeFetcher(() => ({
      ok: false,
      status: 500,
      json: async () => { throw new Error('parse fail'); }
    }));
    await expect(callOpenRouter(baseArgs, fetcher)).rejects.toThrow('OpenRouter error: 500');
  });

  it('throws when the response has no content', async () => {
    const fetcher = makeFetcher(() => okResponse({ choices: [{ message: {} }] }));
    await expect(callOpenRouter(baseArgs, fetcher)).rejects.toThrow('No content in response');
  });

  it('throws when OPENROUTER_API_KEY is missing', async () => {
    await expect(callOpenRouter({ ...baseArgs, apiKey: '' }, makeFetcher(() => okResponse({})))).rejects.toThrow(/OPENROUTER_API_KEY/);
  });

  it('attaches an AbortSignal so the timeout fires', async () => {
    let captured = null;
    const fetcher = makeFetcher((url, opts) => {
      captured = opts;
      return okResponse({ choices: [{ message: { content: 'ok' } }] });
    });
    await callOpenRouter(baseArgs, fetcher);
    expect(captured.signal).toBeDefined();
    expect(captured.signal instanceof AbortSignal).toBe(true);
  });

  it('includes the Authorization header in the request', async () => {
    let captured = null;
    const fetcher = makeFetcher((url, opts) => {
      captured = opts;
      return okResponse({ choices: [{ message: { content: 'ok' } }] });
    });
    await callOpenRouter({ ...baseArgs, apiKey: 'sk-xyz' }, fetcher);
    expect(captured.headers['Authorization']).toBe('Bearer sk-xyz');
  });

  it('translates AbortError to a timeout error', async () => {
    const fetcher = makeFetcher(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    await expect(callOpenRouter({ ...baseArgs, timeoutMs: 100 }, fetcher)).rejects.toThrow(/timed out/);
  });
});

describe('callOpenRouter — placeholder key detection', () => {
  const baseArgs = {
    messages: [{ role: 'user', content: 'hi' }],
    model: 'openai/gpt-oss-120b',
    provider: 'cerebras/fp16',
    temperature: 0.3,
    maxTokens: 100,
    apiKey: '',
    appUrl: 'https://example.com'
  };
  const okFetcher = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });

  it('throws with code MISSING_API_KEY when apiKey is empty', async () => {
    let err;
    try { await callOpenRouter({ ...baseArgs, apiKey: '' }, okFetcher); } catch (e) { err = e; }
    expect(err.message).toMatch(/OPENROUTER_API_KEY/);
    expect(err.code).toBe('MISSING_API_KEY');
  });

  it('throws with code MISSING_API_KEY when apiKey is missing entirely', async () => {
    const { apiKey: _omit, ...args } = baseArgs;
    let err;
    try { await callOpenRouter(args, okFetcher); } catch (e) { err = e; }
    expect(err.code).toBe('MISSING_API_KEY');
  });

  it('throws with code PLACEHOLDER_API_KEY for obvious placeholders', async () => {
    for (const placeholder of ['REPLACE-ME', 'YOUR-KEY', 'placeholder-text', 'sk-or-v1-REPLACE-ME']) {
      let err;
      try { await callOpenRouter({ ...baseArgs, apiKey: placeholder }, okFetcher); } catch (e) { err = e; }
      expect(err.code, `apiKey=${placeholder}`).toBe('PLACEHOLDER_API_KEY');
    }
  });

  it('does NOT flag a real-shaped key as placeholder', async () => {
    const fetcher = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    const out = await callOpenRouter({ ...baseArgs, apiKey: 'sk-or-v1-real-looking-key-abc123' }, fetcher);
    expect(out).toBe('ok');
  });
});
