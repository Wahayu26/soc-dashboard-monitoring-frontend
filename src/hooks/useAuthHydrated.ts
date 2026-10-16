'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * Returns true once the persisted auth store has been rehydrated from localStorage.
 * Prevents SSR/CSR hydration mismatches and premature "logged out" redirects.
 */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}
