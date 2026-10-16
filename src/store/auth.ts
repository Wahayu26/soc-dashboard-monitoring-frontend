'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: string | null;
  permissions: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

/**
 * Lightweight presence flag read by `src/proxy.ts` to guard routes on the server.
 * It does NOT contain the token – real authorization is always enforced by the
 * Laravel API (Sanctum). The Bearer token itself lives in localStorage via zustand.
 */
export const AUTH_FLAG_COOKIE = 'soc_auth';

function setAuthFlag(on: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${AUTH_FLAG_COOKIE}=1; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`
    : `${AUTH_FLAG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        setAuthFlag(true);
        set({ token, user });
      },
      clearAuth: () => {
        setAuthFlag(false);
        set({ token: null, user: null });
      },
    }),
    {
      name: 'soc-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);

/** Permission check helper usable outside React. */
export function hasPermission(user: AuthUser | null, permission?: string | null): boolean {
  if (!permission) return true;
  return user?.permissions?.includes(permission) ?? false;
}
