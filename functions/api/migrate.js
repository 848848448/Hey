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
    'CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)',
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token)',
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expiry)',
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
