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

    let emailResult = null;
    try {
      emailResult = await sendNotificationEmail(env, { fullName, phone, email, language, preferredTime, timestamp });
    } catch (e) {
      emailResult = { error: e.message || 'unknown error' };
    }

    return json({ status: 'ok', id, email_status: emailResult });
  } catch (e) {
    return json({ error: 'Server error: ' + (e.message || 'unknown') }, 500);
  }
}

async function sendNotificationEmail(env, sub) {
  if (!env.RESEND_API_KEY) return { skipped: 'no RESEND_API_KEY env var' };

  let notifEmail;
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'notification_email'").first();
    notifEmail = row?.value;
  } catch (e) { return { skipped: 'db error: ' + e.message }; }

  if (!notifEmail || !notifEmail.trim()) return { skipped: 'no notification_email in settings' };

  let companyName = 'GoldsteinCare';
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'company_name'").first();
    if (row?.value) companyName = row.value;
  } catch (e) {}

  const times = (() => {
    try { return JSON.parse(sub.preferredTime).join(', '); } catch(e) { return sub.preferredTime || ''; }
  })();

  const date = new Date(sub.timestamp).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#2d2219;">
  <div style="background:#d94430;padding:24px 28px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">New Registration</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${companyName}</p>
  </div>
  <div style="background:#ffffff;padding:24px 28px;border:1px solid #e4ddd6;border-top:none;border-radius:0 0 12px 12px;">
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;width:140px;">Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;font-weight:600;">${esc(sub.fullName)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Phone</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(sub.phone)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Email</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;"><a href="mailto:${esc(sub.email)}" style="color:#d94430;">${esc(sub.email)}</a></td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Language</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(sub.language)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Preferred Time</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(times)}</td></tr>
      <tr><td style="padding:10px 12px;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Submitted</td><td style="padding:10px 12px;">${esc(date)}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#97897a;">View all submissions in your <a href="https://goldsteincare.pages.dev/admin.html" style="color:#d94430;">admin dashboard</a>.</p>
  </div>
</div>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: companyName + ' <onboarding@resend.dev>',
      to: [notifEmail.trim()],
      subject: 'New Registration: ' + sub.fullName,
      html: html,
    }),
  });

  const result = await resp.json();
  if (!resp.ok) return { error: result.message || JSON.stringify(result), to: notifEmail.trim() };
  return { sent: true, to: notifEmail.trim(), id: result.id };
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
