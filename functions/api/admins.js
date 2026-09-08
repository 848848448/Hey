import { hashPassword } from './_security.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const { results } = await env.DB.prepare('SELECT email, can_manage_sellers FROM admin_users').all();

  const list = [{ email: ownerEmail, role: 'owner', canManageSellers: true }];
  results.forEach(a => list.push({ email: a.email, role: 'admin', canManageSellers: Boolean(a.can_manage_sellers) }));

  return json(list);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { email, password, canManageSellers } = await request.json();
  if (!email || !password) return json({ error: 'Email and password are required.' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

  const normalEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail)) {
    return json({ error: 'Invalid email format.' }, 400);
  }

  const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (normalEmail === ownerEmail) {
    return json({ error: 'Cannot add the owner as a regular admin.' }, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT email FROM admin_users WHERE email = ?'
  ).bind(normalEmail).first();

  if (existing) {
    return json({ error: 'This email is already an admin.' }, 400);
  }

  const hashed = await hashPassword(password, normalEmail);
  await env.DB.prepare(
    'INSERT INTO admin_users (email, password, can_manage_sellers) VALUES (?, ?, ?)'
  ).bind(normalEmail, hashed, canManageSellers ? 1 : 0).run();

  return json({ status: 'ok' });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const session = await verifyOwner(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { email, canManageSellers } = await request.json();
  const normalEmail = (email || '').trim().toLowerCase();
  if (!normalEmail) return json({ error: 'Missing email' }, 400);

  await env.DB.prepare(
    'UPDATE admin_users SET can_manage_sellers = ? WHERE email = ?'
  ).bind(canManageSellers ? 1 : 0, normalEmail).run();

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

  await env.DB.prepare('DELETE FROM admin_users WHERE email = ?').bind(normalEmail).run();
  await env.DB.prepare('DELETE FROM admin_sessions WHERE email = ?').bind(normalEmail).run();

  return json({ status: 'ok' });
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
