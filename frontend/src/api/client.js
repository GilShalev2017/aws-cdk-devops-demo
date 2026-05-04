/**
 * API Client
 * Thin wrapper around fetch() that points at the API Gateway.
 * In dev: uses REACT_APP_API_URL env var (set in .env.local)
 * In prod: uses relative /api path (CloudFront routes /api/* to API Gateway)
 */
const BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Products ──────────────────────────────────────────────────────────────
export const productsApi = {
  list:       (category) => request('GET', `/products${category ? `?category=${category}` : ''}`),
  get:        (id)       => request('GET', `/products/${id}`),
  create:     (data)     => request('POST', '/products', data),
  update:     (id, data) => request('PUT', `/products/${id}`, data),
  delete:     (id)       => request('DELETE', `/products/${id}`),
  uploadUrl:  (id)       => request('GET', `/products/${id}/upload-url`),
};

// ── Orders ────────────────────────────────────────────────────────────────
export const ordersApi = {
  list:   (userId) => request('GET', `/orders${userId ? `?userId=${userId}` : ''}`),
  get:    (id)     => request('GET', `/orders/${id}`),
  create: (data)   => request('POST', '/orders', data),
  update: (id, s)  => request('PUT', `/orders/${id}`, { status: s }),
  delete: (id)     => request('DELETE', `/orders/${id}`),
};

// ── Users ─────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   ()         => request('GET', '/users'),
  get:    (id)       => request('GET', `/users/${id}`),
  create: (data)     => request('POST', '/users', data),
  update: (id, data) => request('PUT', `/users/${id}`, data),
  delete: (id)       => request('DELETE', `/users/${id}`),
};
