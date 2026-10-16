'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PlaylistItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export const TV_PLAYLIST: PlaylistItem[] = [
  {
    id: 'overview',
    title: 'Global Security Overview',
    subtitle: 'Unified Tri-Firewall Curves & Threat Surface',
    url: '/',
  },
  {
    id: 'palo',
    title: 'Palo Alto Networks NGFW',
    subtitle: 'Threat Prevention, App-ID & Global Geo Intelligence',
    url: '/firewall/palo-alto',
  },
  {
    id: 'fgdc',
    title: 'FortiGate FGDC Edge Gateway',
    subtitle: 'Perimeter Ingress/Egress & Drop Burst Telemetry',
    url: '/firewall/fgdc',
  },
  {
    id: 'isfw',
    title: 'FortiGate ISFW Internal Segmentation',
    subtitle: 'Zero-Trust East-West Containment & VLAN Policies',
    url: '/firewall/isfw',
  },
  {
    id: 'edr',
    title: 'CrowdStrike EDR Telemetry',
    subtitle: 'Host Detections, Isolation & MITRE ATT&CK Matrix',
    url: '/edr',
  },
  {
    id: 'db',
    title: 'Database Cluster Health',
    subtitle: 'MySQL Node Telemetry, Replication Lag & Slow Queries',
    url: '/db',
  },
];

interface TvModeState {
  isActive: boolean;
  isPaused: boolean;
  currentIndex: number;
  intervalSeconds: number;
  startTvMode: () => void;
  stopTvMode: () => void;
  togglePause: () => void;
  nextSlide: () => number;
  prevSlide: () => number;
  setCurrentIndex: (index: number) => void;
  setIntervalSeconds: (sec: number) => void;
}

export const useTvModeStore = create<TvModeState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isPaused: false,
      currentIndex: 0,
      intervalSeconds: 30,

      startTvMode: () => {
        set({ isActive: true, isPaused: false });
      },

      stopTvMode: () => {
        set({ isActive: false, isPaused: false });
      },

      togglePause: () => {
        set((state) => ({ isPaused: !state.isPaused }));
      },

      nextSlide: () => {
        const { currentIndex } = get();
        const next = (currentIndex + 1) % TV_PLAYLIST.length;
        set({ currentIndex: next });
        return next;
      },

      prevSlide: () => {
        const { currentIndex } = get();
        const prev = (currentIndex - 1 + TV_PLAYLIST.length) % TV_PLAYLIST.length;
        set({ currentIndex: prev });
        return prev;
      },

      setCurrentIndex: (index) => {
        set({ currentIndex: index });
      },

      setIntervalSeconds: (sec) => {
        set({ intervalSeconds: sec });
      },
    }),
    {
      name: 'soc-tv-kiosk-mode',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        isActive: s.isActive,
        isPaused: s.isPaused,
        currentIndex: s.currentIndex,
        intervalSeconds: s.intervalSeconds,
      }),
    }
  )
);
