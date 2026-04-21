import { json, requireAuth } from './_lib.js';

export async function onRequestGet(context) {
  const user = await requireAuth(context.request, context.env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  return json({ user });
}
