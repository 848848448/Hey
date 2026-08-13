export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();
    const adminPassword = env.ADMIN_PASSWORD;

    if (!adminPassword || password !== adminPassword) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiry = Date.now() + 24 * 60 * 60 * 1000;

    const sessions = await env.SUBMISSIONS.get('admin_sessions');
    const parsed = sessions ? JSON.parse(sessions) : [];
    parsed.push({ token, expiry });
    const active = parsed.filter(function(s) { return s.expiry > Date.now(); });
    await env.SUBMISSIONS.put('admin_sessions', JSON.stringify(active));

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
