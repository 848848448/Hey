import { checkRateLimit, recordAttempt, clearAttempts, hashPassword, getClientIP } from './_security.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const ip = getClientIP(request);
    const rateKey = 'login:' + ip;
    const check = await checkRateLimit(env, rateKey, 5, 15 * 60 * 1000);
    if (check.blocked) {
      return json({ error: 'Too many login attempts. Try again in ' + Math.ceil(check.retryAfter / 60) + ' minutes.' }, 429);
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return json({ error: 'Missing fields' }, 400);
    }

    const normalEmail = email.trim().toLowerCase();
    const ownerEmail = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

    let role = null;
    let sellerCode = '';

    if (normalEmail === ownerEmail && password === env.ADMIN_PASSWORD) {
      role = 'owner';
    } else {
      const admin = await env.DB.prepare(
        'SELECT email, password FROM admin_users WHERE email = ?'
      ).bind(normalEmail).first();
      if (admin) {
        if (admin.password.length === 64 && admin.password.indexOf(':') === -1) {
          const salt = normalEmail;
          const hashed = await hashPassword(password, salt);
          if (hashed === admin.password) role = 'admin';
        } else {
          if (admin.password === password) {
            role = 'admin';
            const salt = normalEmail;
            const hashed = await hashPassword(password, salt);
            await env.DB.prepare('UPDATE admin_users SET password = ? WHERE email = ?').bind(hashed, normalEmail).run();
          }
        }
      }
    }

    if (!role) {
      try {
        const seller = await env.DB.prepare(
          'SELECT code, password, active FROM sellers WHERE (email = ? OR code = ?) AND active = 1'
        ).bind(normalEmail, normalEmail).first();
        if (seller && seller.password) {
          if (seller.password.length === 64 && seller.password.indexOf(':') === -1) {
            const hashed = await hashPassword(password, seller.code);
            if (hashed === seller.password) { role = 'seller'; sellerCode = seller.code; }
          } else {
            if (seller.password === password) {
              role = 'seller';
              sellerCode = seller.code;
              const hashed = await hashPassword(password, seller.code);
              await env.DB.prepare('UPDATE sellers SET password = ? WHERE code = ?').bind(hashed, seller.code).run();
            }
          }
        }
      } catch (e) {}
    }

    if (!role) {
      await recordAttempt(env, rateKey, 15 * 60 * 1000);
      return json({ error: 'Invalid email or password.' }, 401);
    }

    await clearAttempts(env, rateKey);

    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiry = Date.now() + 24 * 60 * 60 * 1000;

    await env.DB.prepare(
      'DELETE FROM admin_sessions WHERE expiry < ?'
    ).bind(Date.now()).run();

    await env.DB.prepare(
      'INSERT INTO admin_sessions (token, email, role, expiry, seller_code) VALUES (?, ?, ?, ?, ?)'
    ).bind(token, normalEmail, role, expiry, sellerCode).run();

    return json({ token, role, sellerCode });
  } catch (e) {
    return json({ error: 'Server error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
