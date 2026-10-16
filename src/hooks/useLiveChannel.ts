'use client';

import { useEffect, useRef, useState } from 'react';
import { getEcho } from '@/lib/echo';

export type LiveStatus = 'connecting' | 'live' | 'offline';

/**
 * Subscribe to a private Reverb channel event.
 * Returns the websocket connection status so the UI can show LIVE / OFFLINE.
 */
export function useLiveChannel<T>(channel: string, event: string, onMessage: (payload: T) => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const handlerRef = useRef(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const pusher = echo.connector?.pusher;
    const onState = ({ current }: { current: string }) => {
      setStatus(current === 'connected' ? 'live' : current === 'connecting' || current === 'initialized' ? 'connecting' : 'offline');
    };
    pusher?.connection.bind('state_change', onState);
    onState({ current: pusher?.connection.state ?? 'connecting' });

    const sub = echo.private(channel);
    sub.listen(`.${event}`, (payload: T) => handlerRef.current(payload));
    sub.error?.(() => setStatus('offline'));

    return () => {
      pusher?.connection.unbind('state_change', onState);
      echo.leave(channel);
    };
  }, [channel, event]);

  return status;
}
