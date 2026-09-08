export async function ensureRateLimitTable(env) {
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER DEFAULT 0, first_attempt INTEGER NOT NULL, blocked_until INTEGER DEFAULT 0)'
    ).run();
  } catch (e) {}
}

export async function checkRateLimit(env, key, maxAttempts, windowMs) {
  const now = Date.now();

  await ensureRateLimitTable(env);

  const row = await env.DB.prepare(
    'SELECT * FROM rate_limits WHERE key = ?'
  ).bind(key).first();

  if (row && row.blocked_until > now) {
    const retryAfter = Math.ceil((row.blocked_until - now) / 1000);
    return { blocked: true, retryAfter };
  }

  if (row && (now - row.first_attempt) > windowMs) {
    await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
    return { blocked: false };
  }

  if (row && row.attempts >= maxAttempts) {
    const blockedUntil = now + windowMs;
    await env.DB.prepare(
      'UPDATE rate_limits SET blocked_until = ? WHERE key = ?'
    ).bind(blockedUntil, key).run();
    return { blocked: true, retryAfter: Math.ceil(windowMs / 1000) };
  }

  return { blocked: false };
}

export async function recordAttempt(env, key, windowMs) {
  const now = Date.now();
  try {
    await env.DB.prepare(
      'INSERT INTO rate_limits (key, attempts, first_attempt) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1'
    ).bind(key, now).run();
  } catch (e) {}
}

export async function clearAttempts(env, key) {
  try {
    await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
  } catch (e) {}
}

export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}
