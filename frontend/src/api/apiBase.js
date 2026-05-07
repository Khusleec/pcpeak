/**
 * API base URL for axios and OAuth links.
 * - REACT_APP_API_URL wins when set (Vercel/Railway explicit).
 * - On deployed origin (not localhost): same-origin `/api` → Vercel rewrites proxy to Railway.
 * - Local dev: docker-compose uses CORE_API_PORT=5500 → default http://localhost:5500/api
 */
export function getApiBaseUrl() {
  const envUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') {
      return `${window.location.origin.replace(/\/+$/, '')}/api`;
    }
  }

  return 'http://localhost:5500/api';
}
