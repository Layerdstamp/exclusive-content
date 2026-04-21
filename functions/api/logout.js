import { json } from './_lib.js';

function readBearer(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

export async function onRequestPost(context) {
  const token = readBearer(context.request);
  if (!token) return json({ ok: true });
  await context.env.DB.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
  return json({ ok: true });
}
