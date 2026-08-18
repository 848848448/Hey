CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  language TEXT,
  preferred_time TEXT,
  consent INTEGER DEFAULT 0,
  timestamp TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  expiry INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  password TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  first_attempt INTEGER NOT NULL,
  blocked_until INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expiry);
CREATE INDEX IF NOT EXISTS idx_sellers_code ON sellers(code);
CREATE INDEX IF NOT EXISTS idx_submissions_seller_code ON submissions(seller_code);
