import { hashPassword } from './_security.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const seller = await env.DB.prepare(
      'SELECT id, name, code, active FROM sellers WHERE code = ?'
    ).bind(code.toLowerCase()).first();
    if (!seller || !seller.active) return json({ error: 'Seller not found' }, 404);
    return json({ name: seller.name, code: seller.code });
  }

  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { results } = await env.DB.prepare(
    'SELECT * FROM sellers ORDER BY created_at DESC'
  ).all();

  const sellers = [];
  for (const s of results) {
    const count = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM submissions WHERE seller_code = ?'
    ).bind(s.code).first();
    sellers.push({
      id: s.id,
      name: s.name,
      code: s.code,
      email: s.email || '',
      phone: s.phone || '',
      active: Boolean(s.active),
      createdAt: s.created_at,
      submissions: count?.total || 0,
    });
  }

  return json(sellers);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session || session.role !== 'owner') return json({ error: 'Unauthorized' }, 401);

  const { name, code, email, phone, password } = await request.json();
  if (!name || !code) return json({ error: 'Name and code are required' }, 400);
  if (!password || String(password).length < 4) return json({ error: 'Password must be at least 4 characters' }, 400);

  const cleanCode = String(code).trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(cleanCode)) {
    return json({ error: 'Code must be 2-30 characters: letters, numbers, hyphens, underscores' }, 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM sellers WHERE code = ?').bind(cleanCode).first();
  if (existing) return json({ error: 'This code is already taken' }, 400);

  const hashedPass = await hashPassword(String(password), cleanCode);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO sellers (id, name, code, email, phone, password, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, String(name).slice(0, 200), cleanCode, String(email || '').slice(0, 200), String(phone || '').slice(0, 50), hashedPass, new Date().toISOString()).run();

  return json({ status: 'ok', id, code: cleanCode });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session || session.role !== 'owner') return json({ error: 'Unauthorized' }, 401);

  const { id, name, email, phone, active, password } = await request.json();
  if (!id) return json({ error: 'Missing seller id' }, 400);

  if (name !== undefined) {
    await env.DB.prepare('UPDATE sellers SET name = ? WHERE id = ?').bind(String(name).slice(0, 200), id).run();
  }
  if (email !== undefined) {
    await env.DB.prepare('UPDATE sellers SET email = ? WHERE id = ?').bind(String(email).slice(0, 200), id).run();
  }
  if (phone !== undefined) {
    await env.DB.prepare('UPDATE sellers SET phone = ? WHERE id = ?').bind(String(phone).slice(0, 50), id).run();
  }
  if (active !== undefined) {
    await env.DB.prepare('UPDATE sellers SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run();
  }
  if (password !== undefined && String(password).length >= 4) {
    const seller = await env.DB.prepare('SELECT code FROM sellers WHERE id = ?').bind(id).first();
    if (seller) {
      const hashed = await hashPassword(String(password), seller.code);
      await env.DB.prepare('UPDATE sellers SET password = ? WHERE id = ?').bind(hashed, id).run();
    }
  }

  return json({ status: 'ok' });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session || session.role !== 'owner') return json({ error: 'Unauthorized' }, 401);

  const { id } = await request.json();
  if (!id) return json({ error: 'Missing seller id' }, 400);

  await env.DB.prepare('DELETE FROM sellers WHERE id = ?').bind(id).run();
  return json({ status: 'ok' });
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
