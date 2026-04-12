/* ──────────────────────────────────────────
   STRIPE INTEGRATION MODULE
   Replace keys with your live Stripe keys
   ────────────────────────────────────────── */

// ⚠️ Replace with your Stripe publishable key
const STRIPE_PK = 'pk_test_REPLACE_WITH_YOUR_KEY';

// ⚠️ Replace with your Stripe Price IDs
const PRICE_PHOTOS = 'price_REPLACE_PHOTOS_MONTHLY';
const PRICE_PREMIUM = 'price_REPLACE_PREMIUM_MONTHLY';

let stripeInstance = null;

function getStripe() {
  if (!stripeInstance && typeof Stripe !== 'undefined') {
    stripeInstance = Stripe(STRIPE_PK);
  }
  return stripeInstance;
}

/* Redirect to Stripe Checkout for new subscription */
async function startCheckout(tier = 'photos') {
  const stripe = getStripe();
  if (!stripe) {
    showToast('Payment system loading… try again in a moment.');
    return;
  }

  const priceId = tier === 'premium' ? PRICE_PREMIUM : PRICE_PHOTOS;

  try {
    const { error } = await stripe.redirectToCheckout({
      lineItems: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      successUrl: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'success.html?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'index.html'
    });

    if (error) {
      showToast(error.message);
    }
  } catch (err) {
    showToast('Unable to connect to payment system.');
  }
}

/* Redirect to Stripe Customer Portal for managing subscription */
async function manageSubscription() {
  // In production, this would call your backend to create a portal session
  // For now, show a message
  showToast('Subscription management will be available once Stripe is configured.');
}

/* Upgrade from photos to premium tier */
async function upgradeToPremium() {
  // In production, this would call your backend to update the subscription
  // For now, redirect to checkout for premium
  await startCheckout('premium');
}
