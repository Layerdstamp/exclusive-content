const AUTH_KEY = 'zl_auth';

function readAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

function authHeader() {
  const auth = readAuth();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function isAuthenticated() {
  const auth = readAuth();
  return Boolean(auth?.token && auth?.user);
}

function getCurrentUser() {
  const auth = readAuth();
  return auth?.user || null;
}

function getUserTier() {
  return getCurrentUser()?.tier || 'none';
}

function isSuperfan() {
  return getUserTier() === 'superfan';
}

function isFanOrHigher() {
  const tier = getUserTier();
  return tier === 'fan' || tier === 'superfan';
}

/* ─── Demo / offline fallback ────────────────────────────────────────────
   When the D1 backend isn't configured yet, API calls fail and the app
   falls back to localStorage-only mode. Everything works identically;
   the tier is stored in the session and Stripe/D1 just aren't involved.
   Once D1 + Stripe are live, remove the catch blocks below and the
   _demo flag from writeAuth calls.
──────────────────────────────────────────────────────────────────────── */

const DEMO_ACCOUNTS_KEY = 'zl_demo_accounts';

function demoReadAccounts() {
  try { return JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) || '{}'); } catch { return {}; }
}

function demoSaveAccount(email, record) {
  const accounts = demoReadAccounts();
  accounts[email.toLowerCase()] = record;
  localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function registerAccount({ name, email, password }) {
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    writeAuth({ token: data.token, user: data.user });
    return data.user;
  } catch {
    /* Demo fallback: store locally */
    const user = { id: 'local-' + Date.now(), name, email, tier: 'none' };
    const token = 'demo-' + Date.now();
    demoSaveAccount(email, { name, email, passwordHint: password.slice(0,2), tier: 'none' });
    writeAuth({ token, user, _demo: true });
    return user;
  }
}

async function loginAccount({ email, password }) {
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    writeAuth({ token: data.token, user: data.user });
    return data.user;
  } catch {
    /* Demo fallback: check local accounts */
    const accounts = demoReadAccounts();
    const record = accounts[email.toLowerCase()];
    if (!record) throw new Error('No account found. Please create one first.');
    const user = { id: 'local-' + email, name: record.name, email, tier: record.tier || 'none' };
    const token = 'demo-' + Date.now();
    writeAuth({ token, user, _demo: true });
    return user;
  }
}

async function refreshCurrentUser() {
  const auth = readAuth();
  if (auth?._demo) return auth.user; /* Skip API in demo mode */
  try {
    const data = await api('/api/me', { method: 'GET' });
    writeAuth({ token: auth.token, user: data.user });
    return data.user;
  } catch {
    /* If backend unreachable, just return cached user */
    return auth?.user || null;
  }
}

/* Called by subscribe.html when Stripe isn't configured yet */
function demoSetTier(tier) {
  const auth = readAuth();
  if (!auth) return;
  const user = { ...auth.user, tier };
  writeAuth({ ...auth, user });
  /* Also update local demo account record */
  if (auth._demo && user.email) {
    const accounts = demoReadAccounts();
    if (accounts[user.email.toLowerCase()]) {
      accounts[user.email.toLowerCase()].tier = tier;
      localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  }
}

async function logout() {
  const auth = readAuth();
  if (!auth?._demo) {
    try { await api('/api/logout', { method: 'POST', body: '{}' }); } catch {}
  }
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem('video_unlocked');
  window.location.href = 'index.html';
}

async function requireAuth({ minTier = 'fan' } = {}) {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }

  const user = await refreshCurrentUser();
  if (!user) {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
    return false;
  }

  if (minTier === 'fan' && !isFanOrHigher()) {
    window.location.href = 'subscribe.html';
    return false;
  }
  if (minTier === 'superfan' && !isSuperfan()) {
    window.location.href = 'subscribe.html';
    return false;
  }

  return true;
}

function showToast(message, duration = 3000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
