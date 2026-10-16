'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Bell, Sparkles, Tv, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import type { NavItem } from '@/lib/navigation';
import type { AuthUser } from '@/store/auth';
import { useIncidentStore } from '@/store/incidentStore';
import { useTvModeStore } from '@/store/tvModeStore';
import { OmniSearchModal } from '@/components/search/OmniSearchModal';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

interface TopbarProps {
  activeItem?: NavItem;
  user: AuthUser | null;
}

export default function Topbar({ activeItem, user }: TopbarProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const unreadCount = useIncidentStore((s) => s.unreadCount);
  const { isActive: isTvModeActive, startTvMode } = useTvModeStore();

  // Live backend health indicator
  const health = useQuery({
    queryKey: ['api', 'health'],
    queryFn: async () => (await api.get('/health')).data,
    refetchInterval: 30_000,
    retry: false,
  });

  const status = health.isPending ? 'checking' : health.isError ? 'offline' : 'online';
  const pill = {
    checking: { cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400', dot: 'bg-amber-400', label: 'CHECKING' },
    online: { cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]', dot: 'bg-emerald-400 shadow-[0_0_5px_#34d399]', label: 'API ONLINE' },
    offline: { cls: 'bg-rose-500/10 border-rose-500/20 text-rose-400', dot: 'bg-rose-400', label: 'API OFFLINE' },
  }[status];

  // Global keybinding for CTRL+K / CMD+K and Slash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if already inside another text input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLaunchTvMode = () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } catch {
      // Best effort fullscreen
    }
    startTvMode();
  };

  return (
    <>
      <header className="sticky top-0 z-40 h-[80px] flex items-center justify-between px-8 border-b border-slate-800/50 bg-slate-900/60 backdrop-blur-xl relative overflow-hidden">
        {/* Decorative gradient line at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        
        {/* Decorative background flare */}
        <div className="absolute top-[-50%] left-[20%] w-[40%] h-[200%] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

        {/* Left: Title */}
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 flex items-center gap-2">
            {activeItem?.label ?? 'Dashboard'}
            {activeItem?.label && <Sparkles size={16} className="text-cyan-400" />}
          </h1>
          <p className="text-xs text-slate-400 font-medium">{activeItem?.subtitle ?? 'Security Command Center'}</p>
        </div>

        {/* Center: Global Search Bar (Interactive Trigger for OmniSearch) */}
        <div className="hidden lg:flex flex-1 max-w-xl px-8 relative z-10">
          <div
            onClick={() => setIsSearchOpen(true)}
            className="relative w-full group cursor-pointer"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-hover:text-cyan-400 transition-colors">
              <Search size={16} />
            </div>
            <input
              type="text"
              readOnly
              value=""
              placeholder="Search across all modules (IP, Host, User)..."
              className="w-full bg-slate-950/50 border border-slate-700/50 group-hover:border-cyan-500/50 group-hover:bg-slate-900/80 text-slate-200 text-sm rounded-full pl-10 pr-16 py-2 outline-none cursor-pointer transition-all duration-300 placeholder:text-slate-500 shadow-inner select-none pointer-events-none"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-[10px] font-bold text-slate-500 border border-slate-700 rounded-md px-1.5 py-0.5 bg-slate-800/50 group-hover:border-cyan-500/50 group-hover:text-cyan-400 transition-colors">
                CTRL+K
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions, TV Mode, Notifications & User */}
        <div className="flex-1 flex items-center justify-end gap-4 relative z-10">
          
          {/* TV Wall / Kiosk Mode Button */}
          <button
            onClick={handleLaunchTvMode}
            title="Launch Command Center TV Wall Mode (Fullscreen Auto-Rotation)"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
              isTvModeActive
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : 'bg-slate-800/80 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 border-slate-700/70 hover:border-cyan-500/40'
            }`}
          >
            <Tv size={15} className={isTvModeActive ? 'animate-bounce' : 'text-cyan-400'} />
            <span className="hidden sm:inline">TV WALL</span>
          </button>

          {/* Notification Bell with Dynamic Unread Badge */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            title="Incident Notifications Feed"
            className="relative p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition-all group"
          >
            <Bell size={18} className="group-hover:animate-wiggle" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white border-2 border-slate-900 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-slate-600 rounded-full border border-slate-900" />
            )}
          </button>

          {/* API Status Pill */}
          <div id="api-status" className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black tracking-wider ${pill.cls} transition-all duration-500`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${pill.dot}`} />
            {pill.label}
          </div>
          
          {/* User Info */}
          <div className="hidden md:flex flex-col text-right pl-3 border-l border-slate-700/50">
            <p className="text-sm font-bold text-slate-200 leading-tight">{user?.name}</p>
            <p className="text-[11px] font-medium text-slate-500 tracking-wide">@{user?.username}</p>
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <OmniSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationDrawer isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} />
    </>
  );
}
