'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/store/auth';

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  message: string;
  access_token: string;
  token_type: 'Bearer';
  user: AuthUser;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<LoginResponse>('/login', payload);
      return data;
    },
    onSuccess: (data) => setAuth(data.access_token, data.user),
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Best effort: revoke token server-side, but always clear locally.
      await api.post('/logout').catch(() => undefined);
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.replace('/login');
    },
  });
}

/**
 * Re-validates the session against `/api/user` and keeps permissions fresh,
 * so role changes made by an admin are reflected without re-login.
 */
export function useCurrentUser(enabled: boolean) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await api.get<AuthUser>('/user')).data,
    enabled: enabled && !!token,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data && token) setAuth(token, query.data);
  }, [query.data, token, setAuth]);

  return query;
}
