export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 50));
  const search = (url.searchParams.get('search') || '').trim();
  const statusFilter = (url.searchParams.get('status') || '').trim();
  const offset = (page - 1) * limit;

  let whereClause = '';
  const binds = [];

  if (search || statusFilter) {
    const conditions = [];
    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ? OR address LIKE ?)');
      binds.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%');
    }
    if (statusFilter) {
      conditions.push('status = ?');
      binds.push(statusFilter);
    }
    whereClause = 'WHERE ' + conditions.join(' AND ');
  }

  const countResult = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM submissions ' + whereClause
  ).bind(...binds).first();
  const total = countResult?.total || 0;

  const { results } = await env.DB.prepare(
    'SELECT * FROM submissions ' + whereClause + ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).bind(...binds, limit, offset).all();

  const submissions = results.map(row => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address || '',
    language: row.language,
    preferredTime: JSON.parse(row.preferred_time || '[]'),
    consent: Boolean(row.consent),
    timestamp: row.timestamp,
    status: row.status || 'new',
    notes: row.notes || '',
  }));

  return json({ submissions, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id, status, notes } = await request.json();
  if (!id) return json({ error: 'Missing submission id' }, 400);

  const validStatuses = ['new', 'contacted', 'completed'];
  if (status && !validStatuses.includes(status)) {
    return json({ error: 'Invalid status' }, 400);
  }

  if (status !== undefined) {
    await env.DB.prepare('UPDATE submissions SET status = ? WHERE id = ?').bind(status, id).run();
  }
  if (notes !== undefined) {
    await env.DB.prepare('UPDATE submissions SET notes = ? WHERE id = ?').bind(notes, id).run();
  }

  return json({ status: 'ok' });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await verifyToken(request, env);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { id } = await request.json();
  if (!id) return json({ error: 'Missing submission id' }, 400);

  await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
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
