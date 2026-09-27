// Tiny API client for the ShopHunt SPA.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

// Hardcoded "analytics" key shipped in the bundle (info-disclosure recon lab).
export const ANALYTICS_KEY = import.meta.env.VITE_ANALYTICS_KEY || 'sh_live_pk_dev';

export function getToken() { return localStorage.getItem('sh_token') || ''; }
export function setToken(t) { t ? localStorage.setItem('sh_token', t) : localStorage.removeItem('sh_token'); }

async function request(path, { method = 'GET', body, headers = {}, form } = {}) {
  const opts = { method, headers: { ...headers }, credentials: 'include' };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (form) {
    opts.body = form; // FormData; browser sets content-type
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
  return data;
}

export const api = {
  base: API_BASE,
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, form) => request(p, { method: 'POST', form }),
};
