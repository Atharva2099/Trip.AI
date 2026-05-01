import { Hono } from 'hono';
import { cors } from 'hono/cors';

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

async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${header}.${body}.${signature}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${header}.${body}`));
    if (!valid) return null;
    return JSON.parse(atob(body));
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

  // Exchange code for token
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

  // Get user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Trip.AI' }
  });
  const githubUser = await userRes.json();

  // Get email
  const emailRes = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Trip.AI' }
  });
  const emails = await emailRes.json();
  const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email || githubUser.login + '@github.com';

  const userId = `gh_${githubUser.id}`;
  const db = c.env.DB;

  // Upsert user
  await db.prepare(
    `INSERT INTO users (id, email, name, avatar) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar`
  ).bind(userId, primaryEmail, githubUser.name || githubUser.login, githubUser.avatar_url).run();

  // Create session
  const sessionToken = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(generateId(), userId, sessionToken, expiresAt).run();

  const jwt = await signJWT({ sub: userId, email: primaryEmail, name: githubUser.name || githubUser.login, exp: expiresAt }, c.env.JWT_SECRET);

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

  const sessionToken = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(generateId(), userId, sessionToken, expiresAt).run();

  const jwt = await signJWT({ sub: userId, email: googleUser.email, name: googleUser.name, exp: expiresAt }, c.env.JWT_SECRET);

  return c.redirect(appRedirect(appOrigin, `/?token=${jwt}`, c.env.APP_URL));
});

// ─── Auth Status ─────────────────────────────────────────────

app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const row = await db.prepare('SELECT id, email, name, avatar FROM users WHERE id = ?').bind(user.sub).first();
  return c.json({ user: row });
});

app.post('/auth/logout', authMiddleware, async (c) => {
  const user = c.get('user');
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (payload) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token = ?').bind(user.sub, payload.jti).run();
  }
  return c.json({ success: true });
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

// ─── Expenses ────────────────────────────────────────────────

app.get('/api/expenses', authMiddleware, async (c) => {
  const user = c.get('user');
  const itineraryId = c.req.query('itinerary_id');
  let query = `SELECT * FROM expenses WHERE user_id = ?`;
  const params = [user.sub];
  if (itineraryId) {
    query += ` AND itinerary_id = ?`;
    params.push(itineraryId);
  }
  query += ` ORDER BY day, spent_at`;
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ expenses: results });
});

app.post('/api/expenses', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO expenses (id, user_id, itinerary_id, day, category, description, planned_amount, actual_amount, spent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user.sub, body.itinerary_id, body.day, body.category, body.description, body.planned_amount, body.actual_amount, body.spent_at || Math.floor(Date.now() / 1000)).run();
  return c.json({ id }, 201);
});

app.put('/api/expenses/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE expenses SET actual_amount = ? WHERE id = ? AND user_id = ?`
  ).bind(body.actual_amount, id, user.sub).run();
  return c.json({ success: true });
});

app.delete('/api/expenses/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(id, user.sub).run();
  return c.json({ success: true });
});

// ─── Profile (for personalization) ───────────────────────────

app.get('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const { results: pastTrips } = await db.prepare(
    `SELECT destination, interests, budget, itinerary_data, created_at
     FROM itineraries WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
  ).bind(user.sub).all();

  const { results: bookmarks } = await db.prepare(
    `SELECT name, type, destination, notes FROM bookmarks WHERE user_id = ?`
  ).bind(user.sub).all();

  const { results: spending } = await db.prepare(
    `SELECT category, AVG(planned_amount) as planned, AVG(actual_amount) as actual
     FROM expenses WHERE user_id = ? GROUP BY category`
  ).bind(user.sub).all();

  // Parse JSON fields
  pastTrips.forEach(t => {
    try { t.interests = JSON.parse(t.interests); } catch { t.interests = []; }
  });

  return c.json({ pastTrips, bookmarks, spending });
});

// ─── LLM Proxy ───────────────────────────────────────────────

app.post('/api/generate', async (c) => {
  const body = await c.req.json();
  const messages = body.messages;
  const temperature = body.temperature ?? 0.4;
  const maxTokens = body.maxTokens ?? 6000;

  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Server configuration error: no API key configured' }, 500);
  }

  const model = 'deepseek/deepseek-v4-flash';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': c.env.APP_URL || 'https://atharva2099.github.io/Trip.AI',
        'X-Title': 'Trip.AI'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 1,
        include_reasoning: false,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return c.json({
        error: errorData.error?.message || `OpenRouter error: ${response.status}`
      }, response.status);
    }

    const data = await response.json();
    return c.json({ content: data.choices[0].message.content });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return c.json({ error: 'Request timed out after 5 minutes' }, 504);
    }
    return c.json({ error: error.message }, 500);
  }
});

// ─── Modify Event ────────────────────────────────────────────

app.post('/api/modify-event', async (c) => {
  const body = await c.req.json();
  const { message, context, currentItinerary } = body;

  const apiKey = c.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Server configuration error: no API key configured' }, 500);
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

The response must be a valid JSON object with the same structure as the current details.`;

  const userPrompt = `Current ${context.type} details:
${JSON.stringify(context.currentDetails, null, 2)}

User request: ${message}

Respond with a JSON object containing the modified event details. Maintain the exact structure of the current details while incorporating the requested changes.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': c.env.APP_URL || 'https://atharva2099.github.io/Trip.AI',
        'X-Title': 'Trip.AI'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return c.json({ error: errorData.error?.message || `OpenRouter error: ${response.status}` }, response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return c.json({ error: 'No content in response' }, 500);
    }

    const updatedEvent = JSON.parse(content);
    return c.json({ updatedEvent, message: 'Event modified successfully' });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return c.json({ error: 'Request timed out after 30 seconds' }, 504);
    }
    return c.json({ error: error.message }, 500);
  }
});

// ─── OSRM Route Proxy ────────────────────────────────────────

app.get('/api/route/*', async (c) => {
  const path = c.req.path.replace('/api/route', '');
  const query = c.req.query();
  const queryString = Object.keys(query).length > 0
    ? '?' + new URLSearchParams(query).toString()
    : '';
  const osrmUrl = `https://router.project-osrm.org${path}${queryString}`;

  try {
    const response = await fetch(osrmUrl);
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: 'Routing service unavailable', message: error.message }, 502);
  }
});

// ─── Debug ───────────────────────────────────────────────────

app.get('/debug/env', (c) => {
  return c.json({
    app_url: c.env.APP_URL,
    github_id_set: !!c.env.GITHUB_CLIENT_ID,
    github_secret_set: !!c.env.GITHUB_CLIENT_SECRET,
    google_id_set: !!c.env.GOOGLE_CLIENT_ID,
    google_secret_set: !!c.env.GOOGLE_CLIENT_SECRET,
    jwt_set: !!c.env.JWT_SECRET,
    openrouter_set: !!c.env.OPENROUTER_API_KEY
  });
});

// ─── Health ──────────────────────────────────────────────────

app.get('/', (c) => c.json({ ok: true, service: 'tripai-api' }));

export default app;
