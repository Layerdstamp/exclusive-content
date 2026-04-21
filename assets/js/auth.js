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

async function registerAccount({ name, email, password }) {
  const data = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });
  writeAuth({ token: data.token, user: data.user });
  return data.user;
}

async function loginAccount({ email, password }) {
  const data = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  writeAuth({ token: data.token, user: data.user });
  return data.user;
}

async function refreshCurrentUser() {
  const data = await api('/api/me', { method: 'GET' });
  const auth = readAuth();
  writeAuth({ token: auth.token, user: data.user });
  return data.user;
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST', body: '{}' });
  } catch {}
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem('video_unlocked');
  window.location.href = 'index.html';
}

async function requireAuth({ minTier = 'fan' } = {}) {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }

  try {
    await refreshCurrentUser();
  } catch {
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
