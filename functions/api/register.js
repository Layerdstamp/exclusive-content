import { createSession, json, passwordHash } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password are required.' }, 400);
  }

  const email = String(body.email).trim().toLowerCase();
  const name = body.name ? String(body.name).trim() : null;
  if (!email.includes('@')) return json({ error: 'Invalid email.' }, 400);
  if (String(body.password).length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first();
  if (existing) return json({ error: 'Email already registered.' }, 409);

  const hash = await passwordHash(email, String(body.password), env);
  const insert = await env.DB.prepare(
    'INSERT INTO users (email, name, password_hash, tier) VALUES (?1, ?2, ?3, ?4)'
  ).bind(email, name, hash, 'none').run();

  const userId = insert.meta.last_row_id;
  const token = await createSession(env, userId);

  return json({
    token,
    user: { id: userId, email, name, tier: 'none' }
  });
}
