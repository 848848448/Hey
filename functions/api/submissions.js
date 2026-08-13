export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { results } = await env.DB.prepare(
    'SELECT * FROM submissions ORDER BY timestamp DESC'
  ).all();

  const submissions = results.map(row => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    language: row.language,
    preferredTime: JSON.parse(row.preferred_time || '[]'),
    consent: Boolean(row.consent),
    timestamp: row.timestamp,
  }));

  return json(submissions);
}

async function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expiry > ?'
  ).bind(token, Date.now()).first();

  return session || null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
