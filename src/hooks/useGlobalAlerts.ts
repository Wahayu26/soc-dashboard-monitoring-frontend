'use client';

import { useEffect, useRef } from 'react';
import { getEcho } from '@/lib/echo';
import { useIncidentStore, type IncidentItem } from '@/store/incidentStore';

export function useGlobalAlerts() {
  const { addIncident, soundEnabled } = useIncidentStore();
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // A4
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback best effort
    }
  };

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const handleAlert = (data: { incident?: IncidentItem } | IncidentItem) => {
      const inc: IncidentItem = (data as any).incident || data;
      if (!inc || !inc.id) return;

      addIncident(inc);
      playChime();
    };

    const channel1 = echo.channel('soc.incidents');
    const channel2 = echo.channel('soc.overview');

    channel1.listen('.incident.alert', handleAlert);
    channel2.listen('.incident.alert', handleAlert);

    return () => {
      echo.leaveChannel('soc.incidents');
      echo.leaveChannel('soc.overview');
    };
  }, [addIncident, soundEnabled]);
}
