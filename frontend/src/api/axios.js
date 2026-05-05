import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5500/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth failures (expired/invalid token).
// IMPORTANT: don't hard-redirect with window.location — that wipes React state
// and breaks AuthContext's restoration flow on page refresh.
// Just clear the token and let AuthContext + route components react via state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    // Anchor the match — `includes` would match e.g. `/posts/auth/me-comments`.
    const isAuthEndpoint = url === '/auth/me' || url.endsWith('/auth/me');

    // Only purge the token when the server explicitly rejects it.
    // Skip the auto-purge for /auth/me — AuthContext owns that decision so
    // refreshes don't get nuked by a transient hiccup.
    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export default api;
