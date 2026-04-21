# Relax with Zoe Lane Setup

## What I need from you to make Stripe fully real

1. Stripe Secret Key
- Name: STRIPE_SECRET_KEY
- Example format: sk_live_...

2. Stripe Price ID for Fan ($2.22/mo)
- Name: STRIPE_PRICE_FAN
- Example format: price_...

3. Stripe Price ID for Superfan ($9.99/mo)
- Name: STRIPE_PRICE_SUPERFAN
- Example format: price_...

4. Stripe Webhook Signing Secret
- Name: STRIPE_WEBHOOK_SECRET
- Example format: whsec_...

5. Auth pepper (random secret string)
- Name: AUTH_PEPPER
- Any long random string is fine

## Cloudflare resources required

1. D1 database
- Run this once:

```powershell
wrangler d1 create relax-with-zoe-db
```

2. Bind the D1 DB to Pages project `exclusive-content`
- Binding name must be: DB
- In Cloudflare dashboard: Workers & Pages -> exclusive-content -> Settings -> Functions -> D1 bindings

3. Apply schema
- Run this after DB is created:

```powershell
wrangler d1 execute relax-with-zoe-db --file=./schema.sql --remote
```

4. Add environment variables and secrets
- In Cloudflare dashboard: Workers & Pages -> exclusive-content -> Settings -> Variables and Secrets
- Add:
  - AUTH_PEPPER
  - STRIPE_SECRET_KEY
  - STRIPE_PRICE_FAN
  - STRIPE_PRICE_SUPERFAN
  - STRIPE_WEBHOOK_SECRET

## Stripe webhook endpoint

Set this endpoint in Stripe Dashboard webhooks:

- https://solelyzoelane.net/api/stripe-webhook

Subscribe this webhook to events:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

## Access model now implemented

- Fan: photo access
- Superfan: photos + videos access
- Upgrade path: account page button sends Fan users to Superfan checkout
- Tier state is stored in Cloudflare D1 (`users.tier`) and webhook events are logged in `subscription_events`

## Secondary payment step now implemented

1. User creates account on index page
2. User is sent to subscribe page
3. User selects Fan or Superfan
4. Stripe checkout
5. Success page verifies checkout session and updates account tier

