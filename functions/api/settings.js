export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    results.forEach(r => { settings[r.key] = r.value; });
    return json(settings);
  } catch (e) {
    return json({});
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  try {
    const body = await request.json();
    const allowed = ['company_name', 'company_description', 'accent_color', 'logo_data', 'form_active', 'success_message', 'notification_email', 'google_sheet_url'];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        await env.DB.prepare(
          'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
        ).bind(key, String(body[key]), String(body[key])).run();
      }
    }
    return json({ status: 'ok' });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || 'unknown') }, 500);
  }
}

async function verifyOwner(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expiry > ?'
  ).bind(token, Date.now()).first();
  if (!session || session.role !== 'owner') return null;
  return session;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
