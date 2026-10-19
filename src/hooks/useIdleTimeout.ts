'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useTvModeStore } from '@/store/tvModeStore';
import { useLogout } from '@/hooks/useAuth';

const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_WINDOW_MS = 30 * 1000; // Show warning 30 seconds before timeout
const ACTIVITY_STORAGE_KEY = 'soc_last_activity_ts';

export function useIdleTimeout() {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  const token = useAuthStore((s) => s.token);
  const isTvActive = useTvModeStore((s) => s.isActive);
  const logout = useLogout();
  const router = useRouter();

  const lastActivityRef = useRef<number>(0);
  const throttleRef = useRef<number>(0);

  // Reset activity timestamp locally and sync across tabs via localStorage
  const recordActivity = useCallback(() => {
    // If TV wall mode is active, do not trigger activity/timeout
    if (isTvActive) return;

    const now = Date.now();
    // Throttle activity recording to once every 2 seconds
    if (now - throttleRef.current < 2000) return;
    throttleRef.current = now;

    lastActivityRef.current = now;
    if (isWarningOpen) {
      setIsWarningOpen(false);
    }

    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Storage access best effort
    }
  }, [isTvActive, isWarningOpen]);

  // Manually extend session (e.g. from modal button)
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    throttleRef.current = now;
    setIsWarningOpen(false);
    setSecondsRemaining(30);
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Best effort
    }
  }, []);

  // Graceful logout due to idle timeout
  const handleTimeout = useCallback(() => {
    setIsWarningOpen(false);
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace('/soc-dashboard-finale/login?reason=idle_timeout');
      },
    });
  }, [logout, router]);

  // Listen for user interaction events across the window
  useEffect(() => {
    if (!token || isTvActive) return;

    // Initialize timestamp
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
    } catch {
      // Best effort
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleEvent, { passive: true });
    });

    // Cross-tab synchronization listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        const remoteTime = Number(e.newValue);
        if (remoteTime > lastActivityRef.current) {
          lastActivityRef.current = remoteTime;
          setIsWarningOpen(false);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleEvent));
      window.removeEventListener('storage', handleStorage);
    };
  }, [token, isTvActive, recordActivity]);

  // Periodic ticker checking elapsed idle time
  useEffect(() => {
    if (!token || isTvActive) {
      setIsWarningOpen(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (!lastActivityRef.current) {
        lastActivityRef.current = now;
        return;
      }
      const elapsed = now - lastActivityRef.current;
      const timeLeftMs = IDLE_LIMIT_MS - elapsed;

      if (timeLeftMs <= 0) {
        // Time expired
        clearInterval(interval);
        handleTimeout();
      } else if (timeLeftMs <= WARNING_WINDOW_MS) {
        // Warning window (<= 30s remaining)
        setIsWarningOpen(true);
        setSecondsRemaining(Math.max(1, Math.ceil(timeLeftMs / 1000)));
      } else {
        if (isWarningOpen) {
          setIsWarningOpen(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [token, isTvActive, isWarningOpen, handleTimeout]);

  return {
    isWarningOpen,
    secondsRemaining,
    extendSession,
    handleLogout: handleTimeout,
  };
}
