export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();

    if (!data.fullName || !data.email || !data.consent) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const fullName = String(data.fullName).slice(0, 200);
    const phone = String(data.phone || '').slice(0, 50);
    const email = String(data.email).slice(0, 200);
    const language = String(data.language || '').slice(0, 100);
    const preferredTime = JSON.stringify(Array.isArray(data.preferredTime) ? data.preferredTime.slice(0, 4) : []);
    const consent = data.consent ? 1 : 0;

    await env.DB.prepare(
      'INSERT INTO submissions (id, full_name, phone, email, language, preferred_time, consent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, fullName, phone, email, language, preferredTime, consent, timestamp).run();

    return json({ status: 'ok', id });
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
