export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return json({ error: 'Missing fields' }, 400);
    }

    const normalEmail = email.trim().toLowerCase();
    const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

    let role = null;

    if (normalEmail === ownerEmail && password === env.ADMIN_PASSWORD) {
      role = 'owner';
    } else {
      const admin = await env.DB.prepare(
        'SELECT email FROM admin_users WHERE email = ? AND password = ?'
      ).bind(normalEmail, password).first();
      if (admin) role = 'admin';
    }

    if (!role) {
      return json({ error: 'Invalid email or password.' }, 401);
    }

    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiry = Date.now() + 24 * 60 * 60 * 1000;

    await env.DB.prepare(
      'DELETE FROM admin_sessions WHERE expiry < ?'
    ).bind(Date.now()).run();

    await env.DB.prepare(
      'INSERT INTO admin_sessions (token, email, role, expiry) VALUES (?, ?, ?, ?)'
    ).bind(token, normalEmail, role, expiry).run();

    return json({ token, role });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || 'unknown') }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
