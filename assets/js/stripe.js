async function stripeApi(path, payload) {
  const auth = JSON.parse(localStorage.getItem('zl_auth') || 'null');
  const token = auth?.token;
  if (!token) throw new Error('Please sign in first.');

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Payment request failed');
  return data;
}

async function startCheckout(plan = 'fan') {
  const auth = JSON.parse(localStorage.getItem('zl_auth') || 'null');
  if (auth?._demo) {
    /* Demo mode: directly set tier without payment */
    demoSetTier(plan === 'superfan' ? 'superfan' : 'fan');
    window.location.href = 'gallery.html';
    return;
  }
  try {
    const data = await stripeApi('/api/create-checkout-session', { plan });
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message || 'Unable to start checkout.');
  }
}

async function manageSubscription() {
  const auth = JSON.parse(localStorage.getItem('zl_auth') || 'null');
  if (auth?._demo) {
    showToast('Subscription management will be available once Stripe is connected.');
    return;
  }
  try {
    const data = await stripeApi('/api/create-portal-session', {});
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message || 'Unable to open subscription portal.');
  }
}

async function upgradeToSuperfan() {
  await startCheckout('superfan');
}
