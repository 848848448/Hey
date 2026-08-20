export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'No token' }, 401);
  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expiry > ?'
  ).bind(token, Date.now()).first();
  if (!session || session.role !== 'owner') return json({ error: 'Unauthorized' }, 401);

  const migrations = [
    'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER DEFAULT 0, first_attempt INTEGER NOT NULL, blocked_until INTEGER DEFAULT 0)',
    "ALTER TABLE submissions ADD COLUMN address TEXT DEFAULT ''",
    'CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)',
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token)',
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expiry)',
    "CREATE TABLE IF NOT EXISTS sellers (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, email TEXT DEFAULT '', phone TEXT DEFAULT '', active INTEGER DEFAULT 1, created_at TEXT NOT NULL)",
    "ALTER TABLE submissions ADD COLUMN seller_code TEXT DEFAULT ''",
    'CREATE INDEX IF NOT EXISTS idx_sellers_code ON sellers(code)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_seller_code ON submissions(seller_code)',
    "ALTER TABLE sellers ADD COLUMN password TEXT DEFAULT ''",
    "ALTER TABLE admin_sessions ADD COLUMN seller_code TEXT DEFAULT ''",
    "ALTER TABLE submissions ADD COLUMN dob TEXT DEFAULT ''",
  ];

  const results = [];
  for (const sql of migrations) {
    try {
      await env.DB.prepare(sql).run();
      results.push({ sql: sql.slice(0, 60), status: 'ok' });
    } catch (e) {
      results.push({ sql: sql.slice(0, 60), status: 'error', error: e.message });
    }
  }

  return json({ status: 'ok', results });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
