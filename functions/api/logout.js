export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ status: 'ok' });

  try {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  } catch (e) {}

  return json({ status: 'ok' });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
