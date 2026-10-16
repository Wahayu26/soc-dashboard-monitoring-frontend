import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Attach Bearer token on every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Global 401 handling: token expired / revoked -> wipe session and go to login.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const isLoginCall = error.config?.url?.includes('/login');

    if (status === 401 && !isLoginCall && typeof window !== 'undefined') {
      useAuthStore.getState().clearAuth();
      if (!window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}&reason=expired`);
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-friendly message from a Laravel JSON error response. */
export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to connect to API server. Please ensure backend service is running.';
    }
    const data = error.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const firstValidation = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return firstValidation ?? data?.message ?? fallback;
  }
  return fallback;
}
