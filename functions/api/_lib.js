const SESSION_DAYS = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function passwordHash(email, password, env) {
  const pepper = env.AUTH_PEPPER || 'change-me-pepper';
  return sha256Hex(`${email.toLowerCase().trim()}::${password}::${pepper}`);
}

async function createSession(env, userId) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)').bind(token, userId, expires).run();
  return token;
}

function readBearer(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

async function requireAuth(request, env) {
  const token = readBearer(request);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.tier, u.stripe_customer_id, u.stripe_subscription_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?1 AND s.expires_at > datetime('now')`
  ).bind(token).first();
  return row || null;
}

function toStripePlan(plan) {
  if (plan === 'superfan') return 'superfan';
  if (plan === 'fan') return 'fan';
  return null;
}

function tierLabel(tier) {
  if (tier === 'superfan') return 'superfan';
  if (tier === 'fan') return 'fan';
  return 'none';
}

async function stripeForm(url, secretKey, bodyParams) {
  const body = new URLSearchParams(bodyParams);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Stripe request failed');
  }
  return data;
}

function stripePriceForPlan(plan, env) {
  if (plan === 'fan') return env.STRIPE_PRICE_FAN;
  if (plan === 'superfan') return env.STRIPE_PRICE_SUPERFAN;
  return null;
}

async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.slice(2);
  const sig = v1Part.slice(3);
  const signedPayload = `${timestamp}.${rawBody}`;

  const keyData = new TextEncoder().encode(secret);
  const payloadData = new TextEncoder().encode(signedPayload);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return expected === sig;
}

export {
  json,
  passwordHash,
  createSession,
  requireAuth,
  toStripePlan,
  tierLabel,
  stripeForm,
  stripePriceForPlan,
  verifyStripeSignature
};
