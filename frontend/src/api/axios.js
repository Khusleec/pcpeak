import axios from 'axios';
import { getApiBaseUrl } from './apiBase';

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Request timed out. Check your connection and try again.';
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      error.userMessage =
        'Cannot reach the API. Check REACT_APP_API_URL (Vercel env) and that the backend is up.';
    } else if (error.response?.data?.error) {
      error.userMessage = error.response.data.error;
    }
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = url === '/auth/me' || url.endsWith('/auth/me');

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export default api;
