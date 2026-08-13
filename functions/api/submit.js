export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();

    if (!data.fullName || !data.email || !data.consent) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const submission = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      fullName: String(data.fullName).slice(0, 200),
      phone: String(data.phone || '').slice(0, 50),
      email: String(data.email).slice(0, 200),
      language: String(data.language || '').slice(0, 100),
      preferredTime: Array.isArray(data.preferredTime) ? data.preferredTime.slice(0, 4) : [],
      consent: Boolean(data.consent),
    };

    const existing = await env.SUBMISSIONS.get('all_submissions');
    const submissions = existing ? JSON.parse(existing) : [];
    submissions.push(submission);
    await env.SUBMISSIONS.put('all_submissions', JSON.stringify(submissions));

    return new Response(JSON.stringify({ status: 'ok', id: submission.id }), {
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
