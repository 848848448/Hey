export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'No token' }, 401);
  const session = await env.DB.prepare(
    'SELECT * FROM admin_sessions WHERE token = ? AND expiry > ?'
  ).bind(token, Date.now()).first();
  if (!session || session.role !== 'owner') return json({ error: 'Unauthorized' }, 401);

  const checks = {};

  if (!env.RESEND_API_KEY) {
    checks.api_key = 'MISSING — add RESEND_API_KEY in Cloudflare Pages > Settings > Environment variables';
    return json({ success: false, checks });
  }
  checks.api_key = 'OK (' + env.RESEND_API_KEY.slice(0, 6) + '...)';

  let notifEmail;
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'notification_email'").first();
    notifEmail = row?.value;
  } catch (e) {
    checks.notification_email = 'DB ERROR: ' + e.message;
    return json({ success: false, checks });
  }

  if (!notifEmail || !notifEmail.trim()) {
    checks.notification_email = 'MISSING — set it in Admin > Settings > Notifications';
    return json({ success: false, checks });
  }
  notifEmail = notifEmail.trim().toLowerCase();
  checks.notification_email = notifEmail;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GoldsteinCare <onboarding@resend.dev>',
        to: [notifEmail.trim()],
        subject: 'Test Email — GoldsteinCare Notifications',
        html: '<div style="font-family:Arial,sans-serif;padding:24px;"><h2 style="color:#d94430;">It works!</h2><p>Email notifications are set up correctly. You will receive an email each time someone registers.</p></div>',
      }),
    });

    const result = await resp.json();
    checks.resend_status = resp.status;
    checks.resend_response = result;

    if (resp.ok) {
      return json({ success: true, message: 'Test email sent to ' + notifEmail.trim(), checks });
    } else {
      return json({ success: false, message: result.message || 'Resend API error', checks });
    }
  } catch (e) {
    checks.fetch_error = e.message;
    return json({ success: false, message: 'Failed to call Resend API', checks });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
