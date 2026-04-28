-- D1 schema for Trip.AI
-- Run: npx wrangler d1 execute tripai-db --local --file=./migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  destination TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  budget INTEGER,
  travelers TEXT,        -- JSON: {"adults":2,"children":0}
  interests TEXT,        -- JSON array string
  itinerary_data TEXT NOT NULL, -- full JSON string
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT,
  type TEXT CHECK(type IN ('activity','meal','accommodation')),
  coordinates TEXT,      -- JSON: {"lat":18.5,"lng":73.8}
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  itinerary_id TEXT REFERENCES itineraries(id) ON DELETE CASCADE,
  day INTEGER,
  category TEXT CHECK(category IN ('activity','food','transport','accommodation','other')),
  description TEXT,
  planned_amount INTEGER,
  actual_amount INTEGER,
  spent_at INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_itineraries_user ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_itinerary ON expenses(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
