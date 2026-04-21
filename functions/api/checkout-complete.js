import { json, requireAuth, tierLabel } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe is not configured yet.' }, 500);

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (!sessionId) return json({ error: 'Missing session id.' }, 400);

  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  const stripeSession = await stripeRes.json();
  if (!stripeRes.ok) return json({ error: stripeSession?.error?.message || 'Unable to verify checkout session.' }, 400);

  if (stripeSession.payment_status !== 'paid' && stripeSession.status !== 'complete') {
    return json({ error: 'Payment not completed yet.' }, 400);
  }

  const paidTier = tierLabel(stripeSession.metadata?.tier || stripeSession.subscription_details?.metadata?.tier || 'fan');
  await env.DB.prepare(
    'UPDATE users SET tier = ?1, stripe_subscription_id = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3'
  ).bind(paidTier, stripeSession.subscription || null, user.id).run();

  const updated = await env.DB.prepare('SELECT id, email, name, tier, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?1').bind(user.id).first();
  return json({ user: updated });
}
