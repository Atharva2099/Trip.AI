import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ─── CORS ────────────────────────────────────────────────────
app.use('*', cors({
  origin: (c) => {
    const envOrigin = c.env.APP_URL;
    if (envOrigin) return envOrigin;
    // Fallbacks for local dev
    const reqOrigin = c.req.header('origin');
    if (reqOrigin?.includes('localhost')) return reqOrigin;
    return 'https://atharva2099.github.io';
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

app.get('/auth/github', async (c) => {
  const state = generateId();
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = `${new URL(c.req.url).origin}/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
  // Store state in cookie for validation
  c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  return c.redirect(url);
});

app.get('/auth/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookieState = c.req.header('cookie')?.match(/oauth_state=([^;]+)/)?.[1];

  if (!code || state !== cookieState) {
    return c.redirect(`${c.env.APP_URL}/?error=auth_failed`);
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
    return c.redirect(`${c.env.APP_URL}/?error=auth_failed`);
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

  return c.redirect(`${c.env.APP_URL}/?token=${jwt}`);
});

// ─── Google OAuth ────────────────────────────────────────────

app.get('/auth/google', async (c) => {
  const state = generateId();
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}&access_type=offline`;
  c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`);
  return c.redirect(url);
});

app.get('/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const cookieState = c.req.header('cookie')?.match(/oauth_state=([^;]+)/)?.[1];

  if (!code || state !== cookieState) {
    return c.redirect(`${c.env.APP_URL}/?error=auth_failed`);
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
    return c.redirect(`${c.env.APP_URL}/?error=auth_failed`);
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

  return c.redirect(`${c.env.APP_URL}/?token=${jwt}`);
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
    `SELECT id, title, destination, start_date, end_date, budget, created_at
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
    `INSERT INTO itineraries (id, user_id, title, destination, start_date, end_date, budget, travelers, interests, itinerary_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    user.sub,
    body.title || `${body.destination} Trip`,
    body.destination,
    body.start_date,
    body.end_date,
    body.budget,
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

// ─── Health ──────────────────────────────────────────────────

app.get('/', (c) => c.json({ ok: true, service: 'tripai-api' }));

export default app;
