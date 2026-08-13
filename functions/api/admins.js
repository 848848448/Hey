export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminsRaw = await env.SUBMISSIONS.get('admin_users');
  const admins = adminsRaw ? JSON.parse(adminsRaw) : [];

  const list = [{ email: ownerEmail, role: 'owner' }];
  admins.forEach(a => list.push({ email: a.email, role: 'admin' }));

  return json(list);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { email, password } = await request.json();
  if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

  const normalEmail = email.trim().toLowerCase();
  const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

  if (normalEmail === ownerEmail) {
    return json({ error: 'Cannot add the owner as a regular admin.' }, 400);
  }

  const adminsRaw = await env.SUBMISSIONS.get('admin_users');
  const admins = adminsRaw ? JSON.parse(adminsRaw) : [];

  if (admins.some(a => a.email === normalEmail)) {
    return json({ error: 'This email is already an admin.' }, 400);
  }

  admins.push({ email: normalEmail, password });
  await env.SUBMISSIONS.put('admin_users', JSON.stringify(admins));

  return json({ status: 'ok' });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { email } = await request.json();
  const normalEmail = (email || '').trim().toLowerCase();
  const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

  if (normalEmail === ownerEmail) {
    return json({ error: 'The owner cannot be removed.' }, 403);
  }

  const adminsRaw = await env.SUBMISSIONS.get('admin_users');
  const admins = adminsRaw ? JSON.parse(adminsRaw) : [];
  const filtered = admins.filter(a => a.email !== normalEmail);
  await env.SUBMISSIONS.put('admin_users', JSON.stringify(filtered));

  // Remove their sessions too
  const sessionsRaw = await env.SUBMISSIONS.get('admin_sessions');
  const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
  const activeSessions = sessions.filter(s => s.email !== normalEmail);
  await env.SUBMISSIONS.put('admin_sessions', JSON.stringify(activeSessions));

  return json({ status: 'ok' });
}

async function verifyOwner(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const sessionsRaw = await env.SUBMISSIONS.get('admin_sessions');
  const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
  const session = sessions.find(s => s.token === token && s.expiry > Date.now());

  if (!session || session.role !== 'owner') return null;
  return session;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
