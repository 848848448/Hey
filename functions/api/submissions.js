export async function onRequestGet(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessions = await env.SUBMISSIONS.get('admin_sessions');
  const parsed = sessions ? JSON.parse(sessions) : [];
  const valid = parsed.some(function(s) {
    return s.token === token && s.expiry > Date.now();
  });

  if (!valid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await env.SUBMISSIONS.get('all_submissions');
  const submissions = data ? JSON.parse(data) : [];

  return new Response(JSON.stringify(submissions), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
