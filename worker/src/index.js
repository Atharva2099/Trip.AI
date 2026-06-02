import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_PROVIDER,
  rateLimit,
  parseModelJson,
  groundItineraryContext,
  pickModel,
  callOpenRouter,
  isDevLoginAllowed
} from './lib.js';

const app = new Hono();

// ─── CORS ────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://atharva2099.github.io',
  'https://atharva2099.github.io/Trip.AI',
  'http://localhost:3000',
  'http://localhost:8787'
];

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return origin;
    return ALLOWED_ORIGINS[0];
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// ─── JWT Utils ───────────────────────────────────────────────

const b64urlEncode = (input) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = '';
  bytes.forEach(b => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const b64urlDecode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${b64urlEncode(sig)}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = b64urlDecode(signature);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
}

function generateId() {
  return crypto.randomUUID();
}

// ─── Auth Middleware ─────────────────────────────────────────

async function authMiddleware(c, next) {
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // jti == sessions.id. Verify the session is still alive so logout actually invalidates tokens.
  if (payload.jti) {
    const row = await c.env.DB.prepare(
      'SELECT 1 FROM sessions WHERE id = ? AND user_id = ?'
    ).bind(payload.jti, payload.sub).first();
    if (!row) {
      return c.json({ error: 'Session expired' }, 401);
    }
  }
  c.set('user', payload);
  await next();
}

// ─── GitHub OAuth ────────────────────────────────────────────

function encodeState(randomId, origin) {
  return encodeURIComponent(btoa(JSON.stringify({ s: randomId, o: origin })));
}

function decodeState(state) {
  try {
    const { s, o } = JSON.parse(atob(decodeURIComponent(state)));
    if (ALLOWED_ORIGINS.some(allowed => o && o.startsWith(allowed))) return { s, o };
    return { s, o: null };
  } catch {
    return { s: state, o: null };
  }
}

function appRedirect(appOrigin, path, defaultOrigin) {
  const origin = appOrigin || defaultOrigin;
  if (origin.includes('localhost')) return `${origin}${path}`;
  return `${origin}/Trip.AI${path}`;
}

app.get('/auth/github', async (c) => {
  try {
    const randomId = generateId();
    const clientId = c.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return c.json({ error: 'GITHUB_CLIENT_ID not configured' }, 500);
    }
    const origin = c.req.query('origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const appOrigin = allowed ? origin : c.env.APP_URL;
    const state = encodeState(randomId, appOrigin);
    const redirectUri = `${new URL(c.req.url).origin}/auth/github/callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
    return c.redirect(url);
  } catch (err) {
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

app.get('/auth/github/callback', async (c) => {
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const { s: state, o: appOrigin } = decodeState(stateParam);

  if (!code) {
    return c.redirect(appRedirect(appOrigin, '/?error=auth_failed', c.env.APP_URL));
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${new URL(c.req.url).origin}/auth/github/callback`
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return c.redirect(appRedirect(appOrigin, '/?error=auth_failed', c.env.APP_URL));
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Trip.AI' }
  });
  const githubUser = await userRes.json();

  const emailRes = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Trip.AI' }
  });
  const emails = await emailRes.json();
  const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email || githubUser.login + '@github.com';

  const userId = `gh_${githubUser.id}`;
  const db = c.env.DB;

  await db.prepare(
    `INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar`
  ).bind(userId, primaryEmail, githubUser.name || githubUser.login, githubUser.avatar_url).run();

  const sessionId = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  // The legacy `token` column is still NOT NULL UNIQUE; pass sessionId to
  // satisfy the constraint. The new flow identifies sessions by `id` (= jti).
  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(sessionId, userId, sessionId, expiresAt).run();

  const jwt = await signJWT(
    { sub: userId, email: primaryEmail, name: githubUser.name || githubUser.login, jti: sessionId, exp: expiresAt },
    c.env.JWT_SECRET
  );

  return c.redirect(appRedirect(appOrigin, `/?token=${jwt}`, c.env.APP_URL));
});

// ─── Google OAuth ────────────────────────────────────────────

app.get('/auth/google', async (c) => {
  try {
    const randomId = generateId();
    const clientId = c.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return c.json({ error: 'GOOGLE_CLIENT_ID not configured' }, 500);
    }
    const origin = c.req.query('origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const appOrigin = allowed ? origin : c.env.APP_URL;
    const state = encodeState(randomId, appOrigin);
    const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&access_type=offline`;
    return c.redirect(url);
  } catch (err) {
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const { s: state, o: appOrigin } = decodeState(stateParam);

  if (!code) {
    return c.redirect(appRedirect(appOrigin, '/?error=auth_failed', c.env.APP_URL));
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${new URL(c.req.url).origin}/auth/google/callback`,
      grant_type: 'authorization_code'
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return c.redirect(appRedirect(appOrigin, '/?error=auth_failed', c.env.APP_URL));
  }

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const googleUser = await userRes.json();

  const userId = `go_${googleUser.id}`;
  const db = c.env.DB;

  await db.prepare(
    `INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar`
  ).bind(userId, googleUser.email, googleUser.name, googleUser.picture).run();

  const sessionId = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(sessionId, userId, sessionId, expiresAt).run();

  const jwt = await signJWT(
    { sub: userId, email: googleUser.email, name: googleUser.name, jti: sessionId, exp: expiresAt },
    c.env.JWT_SECRET
  );

  return c.redirect(appRedirect(appOrigin, `/?token=${jwt}`, c.env.APP_URL));
});

// ─── Auth Status ─────────────────────────────────────────────

app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const row = await c.env.DB.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').bind(user.sub).first();
  return c.json({ user: row });
});

app.post('/auth/logout', authMiddleware, async (c) => {
  const user = c.get('user');
  if (user.jti) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(user.jti, user.sub).run();
  }
  return c.json({ success: true });
});

// ─── Dev Login (local only) ──────────────────────────────────
// Issues a real JWT for a `dev-user` so the planner is testable
// end-to-end without setting up GitHub/Google OAuth. Gated by BOTH
// the environment name AND the request origin so it can never be
// reached from a deployed worker even if the env var is missing.
app.get('/auth/dev-login', async (c) => {
  const allowed = isDevLoginAllowed({
    environment: c.env.ENVIRONMENT,
    providedToken: c.req.query('token') || c.req.header('X-Dev-Login-Token'),
    expectedToken: c.env.DEV_LOGIN_TOKEN,
    origin: c.req.header('Origin') || ''
  });
  if (!allowed) {
    return c.json({ error: 'Not found' }, 404);
  }

  const userId = 'dev-user';
  const db = c.env.DB;
  await db.prepare(
    `INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar`
  ).bind(userId, 'dev@trip.ai', 'Dev User', null).run();

  const sessionId = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(sessionId, userId, sessionId, expiresAt).run();

  const jwt = await signJWT(
    { sub: userId, email: 'dev@trip.ai', name: 'Dev User', jti: sessionId, exp: expiresAt },
    c.env.JWT_SECRET
  );

  return c.json({ token: jwt, user: { id: userId, email: 'dev@trip.ai', name: 'Dev User' } });
});

// ─── Trips ───────────────────────────────────────────────────

app.get('/api/trips', authMiddleware, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, destination, start_date, end_date, budget, proposed_budget, created_at
     FROM itineraries WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(user.sub).all();
  return c.json({ trips: results });
});

app.get('/api/trips/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT * FROM itineraries WHERE id = ? AND user_id = ?`
  ).bind(id, user.sub).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  try {
    row.itinerary_data = JSON.parse(row.itinerary_data);
    row.travelers = JSON.parse(row.travelers || '{}');
    row.interests = JSON.parse(row.interests || '[]');
  } catch { /* keep as strings */ }
  return c.json(row);
});

app.post('/api/trips', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO itineraries (id, user_id, title, destination, start_date, end_date, budget, proposed_budget, travelers, interests, itinerary_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    user.sub,
    body.title || `${body.destination} Trip`,
    body.destination,
    body.start_date,
    body.end_date,
    body.budget,
    body.proposed_budget || body.budget,
    JSON.stringify(body.travelers || {}),
    JSON.stringify(body.interests || []),
    JSON.stringify(body.itinerary_data)
  ).run();
  return c.json({ id }, 201);
});

app.put('/api/trips/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  if (body.itinerary_data !== undefined) {
    await c.env.DB.prepare(
      `UPDATE itineraries SET itinerary_data = ? WHERE id = ? AND user_id = ?`
    ).bind(JSON.stringify(body.itinerary_data), id, user.sub).run();
  }
  if (body.proposed_budget !== undefined) {
    await c.env.DB.prepare(
      `UPDATE itineraries SET proposed_budget = ? WHERE id = ? AND user_id = ?`
    ).bind(body.proposed_budget, id, user.sub).run();
  }
  return c.json({ success: true });
});

app.delete('/api/trips/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM itineraries WHERE id = ? AND user_id = ?').bind(id, user.sub).run();
  return c.json({ success: true });
});

// ─── Bookmarks ───────────────────────────────────────────────

app.get('/api/bookmarks', authMiddleware, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(user.sub).all();
  results.forEach(r => {
    try { r.coordinates = JSON.parse(r.coordinates); } catch { }
  });
  return c.json({ bookmarks: results });
});

app.post('/api/bookmarks', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO bookmarks (id, user_id, name, destination, type, coordinates, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user.sub, body.name, body.destination, body.type, JSON.stringify(body.coordinates || {}), body.notes || '').run();
  return c.json({ id }, 201);
});

app.delete('/api/bookmarks/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?').bind(id, user.sub).run();
  return c.json({ success: true });
});

// ─── LLM Proxy ───────────────────────────────────────────────

app.post('/api/generate', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  if (!rateLimit(`gen:${ip}`, 10, 10 * 60 * 1000)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const body = await c.req.json();
  const messages = body.messages;
  const temperature = body.temperature ?? 0.3;
  const maxTokens = body.maxTokens ?? 5000;
  const grounding = body.grounding; // { destination, home } from client
  const { model, provider } = pickModel(body.model, body.provider);

  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return c.json({
      error: 'OPENROUTER_API_KEY is not configured on the server. Set it in worker/.dev.vars (dev) or via `wrangler secret put` (prod), then restart.',
      code: 'MISSING_API_KEY'
    }, 503);
  }
  if (/REPLACE-ME|YOUR-KEY|placeholder/i.test(apiKey)) {
    return c.json({
      error: 'OPENROUTER_API_KEY is still a placeholder. Replace it in worker/.dev.vars with a real key from openrouter.ai/keys.',
      code: 'PLACEHOLDER_API_KEY'
    }, 503);
  }

  // Inject Exa grounding context into the first system message if available.
  let contextBlock = '';
  try {
    if (grounding?.destination) {
      contextBlock = await groundItineraryContext(
        { destination: grounding.destination, home: grounding.home },
        c.env.EXA_API_KEY
      );
    }
  } catch {
    contextBlock = '';
  }

  if (contextBlock && messages.length > 0 && messages[0].role === 'system') {
    messages[0] = { ...messages[0], content: `${messages[0].content}\n\n${contextBlock}` };
  } else if (contextBlock) {
    messages.unshift({ role: 'system', content: contextBlock });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const content = await callOpenRouter(
      { messages, model, provider, temperature, maxTokens, apiKey, appUrl: c.env.APP_URL },
      fetch
    );
    clearTimeout(timeoutId);
    return c.json({ content, model, provider });
  } catch (error) {
    clearTimeout(timeoutId);
    // Map error codes to HTTP statuses the frontend can branch on.
    let status = 500;
    if (error.code === 'MISSING_API_KEY' || error.code === 'PLACEHOLDER_API_KEY') status = 503;
    else if (/timeout/i.test(error.message)) status = 504;
    else if (error.status === 401 || error.status === 403) status = 502;
    return c.json({ error: error.message, code: error.code || null }, status);
  }
});

// ─── Modify Event ────────────────────────────────────────────

app.post('/api/modify-event', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  if (!rateLimit(`mod:${ip}`, 30, 10 * 60 * 1000)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const body = await c.req.json();
  const { message, context, currentItinerary, grounding } = body;
  const { model, provider } = pickModel(body.model, body.provider);

  if (!context || !currentItinerary?.days) {
    return c.json({ error: 'Missing context or currentItinerary' }, 400);
  }

  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return c.json({
      error: 'OPENROUTER_API_KEY is not configured on the server. Set it in worker/.dev.vars (dev) or via `wrangler secret put` (prod), then restart.',
      code: 'MISSING_API_KEY'
    }, 503);
  }

  let contextBlock = '';
  try {
    if (grounding?.destination) {
      contextBlock = await groundItineraryContext(
        { destination: grounding.destination, home: grounding.home },
        c.env.EXA_API_KEY
      );
    }
  } catch {
    contextBlock = '';
  }

  const existingEvents = new Set();
  currentItinerary.days.forEach(day => {
    (day.activities || []).forEach(a => existingEvents.add(a.name.toLowerCase()));
    (day.meals || []).forEach(m => existingEvents.add(m.name.toLowerCase()));
  });

  const systemPrompt = `You are a travel planning assistant. Your task is to modify a ${context.type} based on the user's request.
Important constraints:
1. NEVER suggest any of these existing places: ${Array.from(existingEvents).join(', ')}
2. Keep all locations within 50km of city center
3. Activities must be between 8:00-22:00
4. Use realistic local prices
5. For activities, always include exact coordinates, transport info, and distance
6. For meals, include time, type (breakfast/lunch/dinner), and cost
7. Suggest unique places that aren't already in the itinerary
8. Ensure suggestions are location-appropriate and culturally relevant

The response must be a valid JSON object with the same structure as the current details. Respond with ONLY the JSON object, no prose, no markdown fences.`;

  const userPrompt = `Current ${context.type} details:
${JSON.stringify(context.currentDetails, null, 2)}

User request: ${message}

Respond with a JSON object containing the modified event details. Maintain the exact structure of the current details while incorporating the requested changes.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  if (contextBlock) {
    messages[0] = { ...messages[0], content: `${messages[0].content}\n\n${contextBlock}` };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const content = await callOpenRouter(
      { messages, model, provider, temperature: 0.4, maxTokens: 1000, apiKey, appUrl: c.env.APP_URL, timeoutMs: 30000 },
      fetch
    );
    clearTimeout(timeoutId);

    const updatedEvent = parseModelJson(content);
    if (!updatedEvent) {
      return c.json({ error: 'Model returned invalid JSON' }, 502);
    }
    return c.json({ updatedEvent, message: 'Event modified successfully' });
  } catch (error) {
    clearTimeout(timeoutId);
    let status = 500;
    if (error.code === 'MISSING_API_KEY' || error.code === 'PLACEHOLDER_API_KEY') status = 503;
    else if (/timeout/i.test(error.message)) status = 504;
    else if (error.status === 401 || error.status === 403) status = 502;
    return c.json({ error: error.message, code: error.code || null }, status);
  }
});

// ─── Health ──────────────────────────────────────────────────

app.get('/', (c) => c.json({ ok: true, service: 'tripai-api' }));

// Note: do NOT export the config constants here. Wrangler 4.x interprets
// every named export as a potential service entry and rejects non-handler
// values. Constants are imported by reference inside the file.
export default app;
