export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const data = await env.SUBMISSIONS.get('all_submissions');
  return json(data ? JSON.parse(data) : []);
}

async function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const sessionsRaw = await env.SUBMISSIONS.get('admin_sessions');
  const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
  return sessions.find(s => s.token === token && s.expiry > Date.now()) || null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
