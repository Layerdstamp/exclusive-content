import { json, tierLabel, verifyStripeSignature } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const rawBody = await request.text();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'STRIPE_WEBHOOK_SECRET is not configured.' }, 500);
  }

  const signature = request.headers.get('stripe-signature');
  const validSig = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!validSig) return json({ error: 'Invalid Stripe signature.' }, 401);

  const event = JSON.parse(rawBody);
  const eventType = event.type;
  const obj = event.data?.object || {};

  let userId = obj.metadata?.user_id ? Number(obj.metadata.user_id) : null;
  const tier = tierLabel(obj.metadata?.tier || 'none');
  const customerId = obj.customer || null;
  const subscriptionId = obj.subscription || obj.id || null;

  if (!userId && customerId) {
    const userRow = await env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?1').bind(customerId).first();
    if (userRow) userId = userRow.id;
  }

  if (userId && (eventType === 'checkout.session.completed' || eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.created')) {
    let nextTier = tier;
    if (eventType.startsWith('customer.subscription')) {
      const priceId = obj.items?.data?.[0]?.price?.id || null;
      if (priceId && priceId === env.STRIPE_PRICE_SUPERFAN) nextTier = 'superfan';
      if (priceId && priceId === env.STRIPE_PRICE_FAN) nextTier = 'fan';
    }

    await env.DB.prepare(
      'UPDATE users SET tier = ?1, stripe_customer_id = COALESCE(?2, stripe_customer_id), stripe_subscription_id = COALESCE(?3, stripe_subscription_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?4'
    ).bind(nextTier, customerId, subscriptionId, userId).run();
  }

  await env.DB.prepare(
    'INSERT INTO subscription_events (user_id, stripe_event_id, stripe_customer_id, stripe_subscription_id, tier, status, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
  ).bind(userId, event.id || null, customerId, subscriptionId, tier, eventType, rawBody).run();

  return json({ received: true });
}
