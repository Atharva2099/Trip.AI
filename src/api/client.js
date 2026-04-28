const API_BASE = 'https://tripai-api.athuspydy.workers.dev';

function getToken() {
  return localStorage.getItem('tripai_token');
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (res.status === 401) {
    localStorage.removeItem('tripai_token');
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const authApi = {
  me: () => api('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' })
};

export const tripsApi = {
  list: () => api('/api/trips'),
  get: (id) => api(`/api/trips/${id}`),
  create: (data) => api('/api/trips', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => api(`/api/trips/${id}`, { method: 'DELETE' })
};

export const bookmarksApi = {
  list: () => api('/api/bookmarks'),
  create: (data) => api('/api/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => api(`/api/bookmarks/${id}`, { method: 'DELETE' })
};

export const expensesApi = {
  list: (itineraryId) => api(`/api/expenses?itinerary_id=${itineraryId}`),
  create: (data) => api('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
};

export const profileApi = {
  get: () => api('/api/profile')
};

export { getToken };
