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
    if (!echo) {
      setStatus('offline');
      return;
    }

    const pusher = echo.connector?.pusher;
    const updateStatus = () => {
      const state = pusher?.connection?.state;
      if (state === 'connected') {
        setStatus('live');
      } else if (state === 'connecting' || state === 'initialized') {
        setStatus('connecting');
      } else {
        setStatus('offline');
      }
    };

    pusher?.connection?.bind('state_change', updateStatus);
    pusher?.connection?.bind('connected', updateStatus);
    pusher?.connection?.bind('disconnected', updateStatus);
    pusher?.connection?.bind('unavailable', updateStatus);
    pusher?.connection?.bind('failed', updateStatus);

    updateStatus();

    const sub = echo.channel(channel);
    sub.listen(`.${event}`, (payload: T) => handlerRef.current(payload));

    return () => {
      pusher?.connection?.unbind('state_change', updateStatus);
      pusher?.connection?.unbind('connected', updateStatus);
      pusher?.connection?.unbind('disconnected', updateStatus);
      pusher?.connection?.unbind('unavailable', updateStatus);
      pusher?.connection?.unbind('failed', updateStatus);
      echo.leaveChannel(channel);
    };
  }, [channel, event]);

  return status;
}
