import { createSession, json, passwordHash } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password are required.' }, 400);
  }

  const email = String(body.email).trim().toLowerCase();
  const hash = await passwordHash(email, String(body.password), env);
  const user = await env.DB.prepare(
    'SELECT id, email, name, tier, stripe_customer_id, stripe_subscription_id FROM users WHERE email = ?1 AND password_hash = ?2'
  ).bind(email, hash).first();

  if (!user) return json({ error: 'Invalid credentials.' }, 401);

  const token = await createSession(env, user.id);
  return json({ token, user });
}
