'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, LogOut, Loader2, ChevronDown } from 'lucide-react';
import type { NavGroup, NavItem } from '@/lib/navigation';
import type { AuthUser } from '@/store/auth';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  groups: NavGroup[];
  activeItem?: NavItem;
  user: AuthUser | null;
  onLogout: () => void;
  loggingOut?: boolean;
}

function initials(name?: string) {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function SidebarItem({ item, activeItem, collapsed, depth = 0 }: { item: NavItem; activeItem?: NavItem; collapsed: boolean; depth?: number }) {
  const [expanded, setExpanded] = useState(() => {
    if (item.children) {
      return item.children.some(c => c.href === activeItem?.href);
    }
    return false;
  });

  useEffect(() => {
    if (item.children && item.children.some(c => c.href === activeItem?.href)) {
      setExpanded(true);
    }
  }, [activeItem, item.children]);

  const hasChildren = item.children && item.children.length > 0;
  const active = !hasChildren && activeItem?.href === item.href;
  const childActive = hasChildren && item.children!.some(c => c.href === activeItem?.href);
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <button
          onClick={() => setExpanded(!expanded)}
          title={collapsed ? item.label : undefined}
          className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${childActive && !expanded ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'} ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon size={20} className={`flex-none transition-all duration-300 group-hover:scale-110 ${childActive ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''}`} />}
            <span className={`whitespace-nowrap transition-all duration-300 ease-in-out ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
              {item.label}
            </span>
          </div>
          {!collapsed && (
            <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? 'rotate-180 text-cyan-400' : ''}`} />
          )}
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded && !collapsed ? 'max-h-[500px] mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-col gap-1 pl-4 border-l border-slate-700/50 ml-5 mt-1">
            {item.children!.map((child) => (
              <SidebarItem key={child.href || child.label} item={child} activeItem={activeItem} collapsed={collapsed} depth={depth + 1} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      id={`nav-${item.href?.replace(/\//g, '-').replace(/^-/, '') || 'overview'}`}
      href={item.href || '#'}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${active ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'} ${collapsed ? 'justify-center' : 'justify-start'}`}
    >
      {active && (
        <div className="absolute left-0 top-[15%] bottom-[15%] w-1 bg-cyan-400 rounded-r-md shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
      )}
      {Icon && <Icon size={20} className={`flex-none transition-all duration-300 group-hover:scale-110 ${active ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''}`} />}
      <span className={`whitespace-nowrap transition-all duration-300 ease-in-out ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
        {item.label}
      </span>
    </Link>
  );
}

export default function Sidebar({ collapsed, setCollapsed, groups, activeItem, user, onLogout, loggingOut }: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl transition-all duration-300 ease-in-out ${collapsed ? 'w-[80px]' : 'w-[260px]'}`}
    >
      {/* Header / Logo */}
      <div className="relative flex items-center gap-3 p-5 min-h-[80px]">
        {/* Animated SOC Logo */}
        <div className="relative flex-none w-10 h-10 flex items-center justify-center font-black text-sm rounded-xl overflow-hidden shadow-[0_0_15px_rgba(34,211,238,0.6)] group">
          {/* Animated rotating background */}
          <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,#22d3ee_360deg)] animate-[spin_3s_linear_infinite]" />
          <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,#3b82f6_360deg)] animate-[spin_2s_linear_infinite_reverse]" />
          
          {/* Inner core block */}
          <div className="absolute inset-[2px] bg-slate-900 rounded-[10px] z-0 overflow-hidden">
            {/* Pulsing inner gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 animate-pulse" />
          </div>
          
          {/* Letter animations */}
          <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-white tracking-tighter group-hover:scale-110 transition-transform flex items-center drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            <span className="animate-[pulse_2s_ease-in-out_infinite]">S</span>
            <span className="animate-[pulse_2s_ease-in-out_infinite_200ms]">O</span>
            <span className="animate-[pulse_2s_ease-in-out_infinite_400ms]">C</span>
          </span>
        </div>

        <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
          <p className="font-black text-slate-100 text-base leading-tight tracking-tight whitespace-nowrap">
            SENTINEL <span className="text-cyan-400 neon-text-cyan">SOC</span>
          </p>
        </div>

        {/* Small Floating Toggle Button on the Right Edge */}
        <button
          id="sidebar-toggle"
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-7 flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 border border-slate-600 text-slate-300 hover:text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all z-50"
        >
          <ChevronLeft size={16} className={`transition-transform duration-300 ease-in-out ${collapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      {/* Navigation (filtered by RBAC permissions) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1 custom-scrollbar overflow-x-hidden">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className={`px-3 mb-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-500 whitespace-nowrap transition-all duration-300 ease-in-out ${collapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
              {group.title}
            </div>

            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <SidebarItem key={item.href || item.label} item={item} activeItem={activeItem} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / User card + Logout */}
      <div className="p-4 border-t border-slate-700/50 flex flex-col gap-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`} title={collapsed ? user?.name : undefined}>
          <div className="flex-none w-9 h-9 rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/40 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-100">
            {initials(user?.name)}
          </div>
          <div className={`min-w-0 transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 flex-1'}`}>
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name ?? '—'}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 truncate">{user?.role ?? 'analyst'}</p>
          </div>
        </div>

        <button
          id="sidebar-logout"
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          title="Sign Out"
          className={`flex items-center justify-center gap-2 w-full rounded-xl text-sm font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all duration-300 ease-in-out disabled:opacity-60 ${collapsed ? 'p-2.5' : 'p-2.5'}`}
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'hidden' : 'inline'}`}>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
