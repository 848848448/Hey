import { checkRateLimit, recordAttempt, getClientIP } from './_security.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const ip = getClientIP(request);
    const rateKey = 'submit:' + ip;
    const check = await checkRateLimit(env, rateKey, 5, 10 * 60 * 1000);
    if (check.blocked) {
      return json({ error: 'Too many submissions. Please try again later.' }, 429);
    }

    const data = await request.json();

    if (!data.fullName || !data.email || !data.address || !data.consent) {
      return json({ error: 'Missing required fields' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
      return json({ error: 'Invalid email format' }, 400);
    }

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const fullName = String(data.fullName).slice(0, 200);
    const phone = String(data.phone || '').slice(0, 50);
    const email = String(data.email).trim().slice(0, 200);
    const address = String(data.address || '').slice(0, 500);
    const language = String(data.language || '').slice(0, 100);
    const preferredTime = JSON.stringify(Array.isArray(data.preferredTime) ? data.preferredTime.slice(0, 4) : []);
    const consent = data.consent ? 1 : 0;

    let sellerCode = '';
    let sellerName = '';
    if (data.sellerCode) {
      const cleanCode = String(data.sellerCode).trim().toLowerCase();
      if (/^[a-z0-9_-]{2,30}$/.test(cleanCode)) {
        try {
          const seller = await env.DB.prepare('SELECT name, active FROM sellers WHERE code = ?').bind(cleanCode).first();
          if (seller && seller.active) {
            sellerCode = cleanCode;
            sellerName = seller.name;
          }
        } catch (e) {}
      }
    }

    await env.DB.prepare(
      'INSERT INTO submissions (id, full_name, phone, email, address, language, preferred_time, consent, timestamp, seller_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, fullName, phone, email, address, language, preferredTime, consent, timestamp, sellerCode).run();

    await recordAttempt(env, rateKey, 10 * 60 * 1000);

    try {
      await sendNotificationEmail(env, { fullName, phone, email, address, language, preferredTime, timestamp, sellerCode, sellerName });
    } catch (e) {}

    try {
      await sendToGoogleSheet(env, { fullName, phone, email, address, language, preferredTime, timestamp, sellerCode, sellerName });
    } catch (e) {}

    return json({ status: 'ok', id });
  } catch (e) {
    return json({ error: 'Server error' }, 500);
  }
}

async function sendNotificationEmail(env, sub) {
  if (!env.RESEND_API_KEY) return;

  let notifEmail;
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'notification_email'").first();
    notifEmail = row?.value;
  } catch (e) { return; }

  if (!notifEmail || !notifEmail.trim()) return;
  notifEmail = notifEmail.trim().toLowerCase();

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
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${esc(companyName)}</p>
  </div>
  <div style="background:#ffffff;padding:24px 28px;border:1px solid #e4ddd6;border-top:none;border-radius:0 0 12px 12px;">
    <table style="width:100%;border-collapse:collapse;font-size:15px;">
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;width:140px;">Name</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;font-weight:600;">${esc(sub.fullName)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Phone</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(sub.phone)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Email</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;"><a href="mailto:${esc(sub.email)}" style="color:#d94430;">${esc(sub.email)}</a></td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Address</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(sub.address)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Language</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(sub.language)}</td></tr>
      <tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Preferred Time</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">${esc(times)}</td></tr>
      ${sub.sellerCode ? '<tr><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Referred By</td><td style="padding:10px 12px;border-bottom:1px solid #f0ebe6;">' + esc(sub.sellerName) + ' (' + esc(sub.sellerCode) + ')</td></tr>' : ''}
      <tr><td style="padding:10px 12px;color:#97897a;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Submitted</td><td style="padding:10px 12px;">${esc(date)}</td></tr>
    </table>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: esc(companyName) + ' <onboarding@resend.dev>',
      to: [notifEmail],
      subject: 'New Registration: ' + sub.fullName,
      html: html,
    }),
  });
}

async function sendToGoogleSheet(env, sub) {
  let sheetUrl;
  try {
    const row = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'google_sheet_url'").first();
    sheetUrl = row?.value;
  } catch (e) { return; }

  if (!sheetUrl || !sheetUrl.trim()) return;

  const times = (() => {
    try { return JSON.parse(sub.preferredTime).join(', '); } catch(e) { return sub.preferredTime || ''; }
  })();

  await fetch(sheetUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: sub.timestamp,
      fullName: sub.fullName,
      phone: "'" + sub.phone,
      email: sub.email,
      address: sub.address,
      language: sub.language,
      preferredTime: times,
      seller: sub.sellerName ? sub.sellerName + ' (' + sub.sellerCode + ')' : '',
    }),
  });
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
