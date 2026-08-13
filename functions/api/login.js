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
      const adminsRaw = await env.SUBMISSIONS.get('admin_users');
      const admins = adminsRaw ? JSON.parse(adminsRaw) : [];
      const match = admins.find(a => a.email === normalEmail && a.password === password);
      if (match) role = 'admin';
    }

    if (!role) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiry = Date.now() + 24 * 60 * 60 * 1000;

    const sessionsRaw = await env.SUBMISSIONS.get('admin_sessions');
    const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
    sessions.push({ token, email: normalEmail, role, expiry });
    const active = sessions.filter(s => s.expiry > Date.now());
    await env.SUBMISSIONS.put('admin_sessions', JSON.stringify(active));

    return json({ token, role });
  } catch (e) {
    return json({ error: 'Invalid request' }, 400);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
