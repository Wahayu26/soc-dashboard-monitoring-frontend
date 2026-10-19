'use client';

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { api } from '@/lib/api';

/**
 * Laravel Reverb (Pusher protocol) client singleton.
 * Private channels are authorised through Sanctum at `${API_BASE_URL}/broadcasting/auth`
 * using the same axios instance (Bearer token attached by its interceptor).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let echo: any = null;

export function getEcho() {
  if (typeof window === 'undefined') return null;
  if (echo) return echo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Pusher = Pusher;

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const scheme = isHttps ? 'https' : (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http');
  const wsHost =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? window.location.hostname
      : (process.env.NEXT_PUBLIC_REVERB_HOST ?? '127.0.0.1');
  const port = isHttps ? 443 : Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);

  echo = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? '',
    wsHost,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizer: (channel: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorize: (socketId: string, callback: (error: any, data: any) => void) => {
        api
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((res) => callback(null, res.data))
          .catch((err) => callback(err, null));
      },
    }),
  });

  return echo;
}

export function disconnectEcho() {
  echo?.disconnect();
  echo = null;
}
