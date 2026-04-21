import { json, requireAuth, stripeForm, stripePriceForPlan, toStripePlan } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => null);
  const plan = toStripePlan(body?.plan);
  if (!plan) return json({ error: 'Invalid plan.' }, 400);

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe is not configured yet.' }, 500);

  const priceId = stripePriceForPlan(plan, env);
  if (!priceId) return json({ error: 'Price ID not configured for this plan.' }, 500);

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripeForm('https://api.stripe.com/v1/customers', stripeKey, {
      email: user.email,
      name: user.name || '',
      'metadata[user_id]': String(user.id)
    });
    customerId = customer.id;
    await env.DB.prepare('UPDATE users SET stripe_customer_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2').bind(customerId, user.id).run();
  }

  const origin = new URL(request.url).origin;
  const session = await stripeForm('https://api.stripe.com/v1/checkout/sessions', stripeKey, {
    mode: 'subscription',
    customer: customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/index.html`,
    'metadata[user_id]': String(user.id),
    'metadata[tier]': plan,
    'subscription_data[metadata][user_id]': String(user.id),
    'subscription_data[metadata][tier]': plan
  });

  return json({ url: session.url, sessionId: session.id });
}
