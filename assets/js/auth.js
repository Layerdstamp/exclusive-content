/* ──────────────────────────────────────────
   AUTH MODULE
   SHA-256 hashed password — cannot be reversed
   ────────────────────────────────────────── */

const ADMIN_HASH = '247a0bb794f67c4f9cadcfa9651b52d2428ae596587beccb205ec165d4c06f4b';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Check if user has an active session */
function isAuthenticated() {
  const session = sessionStorage.getItem('zl_auth');
  if (!session) return false;
  try {
    const data = JSON.parse(session);
    // Session valid for 24 hours
    return data.authenticated && (Date.now() - data.timestamp < 86400000);
  } catch { return false; }
}

/* Get current user tier */
function getUserTier() {
  const session = sessionStorage.getItem('zl_auth');
  if (!session) return null;
  try {
    return JSON.parse(session).tier || 'photos';
  } catch { return null; }
}

/* Set auth session */
function setAuth(tier = 'admin') {
  sessionStorage.setItem('zl_auth', JSON.stringify({
    authenticated: true,
    tier: tier,
    timestamp: Date.now()
  }));
}

/* Clear session */
function logout() {
  sessionStorage.removeItem('zl_auth');
  window.location.href = 'index.html';
}

/* Admin password check */
async function verifyAdmin(password) {
  const hash = await sha256(password);
  return hash === ADMIN_HASH;
}

/* Protect a page — redirect to login if not authed */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/* Show toast notification */
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
