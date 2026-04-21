import { json, requireAuth, stripeForm } from './_lib.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  if (!user.stripe_customer_id) {
    return json({ error: 'No Stripe customer found for this account yet.' }, 400);
  }
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Stripe is not configured yet.' }, 500);
  }

  const origin = new URL(request.url).origin;
  const session = await stripeForm('https://api.stripe.com/v1/billing_portal/sessions', env.STRIPE_SECRET_KEY, {
    customer: user.stripe_customer_id,
    return_url: `${origin}/account.html`
  });

  return json({ url: session.url });
}
