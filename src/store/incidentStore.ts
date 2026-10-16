'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface IncidentItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  read?: boolean;
  metadata?: Record<string, any>;
}

interface IncidentState {
  incidents: IncidentItem[];
  unreadCount: number;
  soundEnabled: boolean;
  addIncident: (incident: IncidentItem) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleSound: () => void;
}

export const useIncidentStore = create<IncidentState>()(
  persist(
    (set, get) => ({
      incidents: [],
      unreadCount: 0,
      soundEnabled: true,

      addIncident: (incident) => {
        set((state) => {
          // Avoid exact duplicate IDs
          const filtered = state.incidents.filter((i) => i.id !== incident.id);
          const newIncident: IncidentItem = { ...incident, read: false };
          const updated = [newIncident, ...filtered].slice(0, 30);
          const unread = updated.filter((i) => !i.read).length;
          return { incidents: updated, unreadCount: unread };
        });
      },

      markAsRead: (id) => {
        set((state) => {
          const updated = state.incidents.map((i) =>
            i.id === id ? { ...i, read: true } : i
          );
          const unread = updated.filter((i) => !i.read).length;
          return { incidents: updated, unreadCount: unread };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          incidents: state.incidents.map((i) => ({ ...i, read: true })),
          unreadCount: 0,
        }));
      },

      clearAll: () => {
        set({ incidents: [], unreadCount: 0 });
      },

      toggleSound: () => {
        set((state) => ({ soundEnabled: !state.soundEnabled }));
      },
    }),
    {
      name: 'soc-incidents-vault',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        incidents: s.incidents,
        unreadCount: s.unreadCount,
        soundEnabled: s.soundEnabled,
      }),
    }
  )
);
