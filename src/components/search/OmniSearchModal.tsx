'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Search,
  X,
  Shield,
  ShieldAlert,
  Server,
  Lock,
  Database,
  Layers,
  ArrowRight,
  ExternalLink,
  Flame,
  Activity,
  Cpu,
  CornerDownLeft,
  Sparkles,
  Command,
  Loader2,
  Filter
} from 'lucide-react';

interface SearchItem {
  id: string;
  module: string;
  category: 'navigation' | 'action' | 'edr' | 'pam' | 'firewall';
  title: string;
  subtitle: string;
  badge?: string;
  severity?: string;
  timestamp?: string;
  url: string;
}

const STATIC_NAV_ITEMS: SearchItem[] = [
  {
    id: 'nav-overview',
    module: 'Command Center',
    category: 'navigation',
    title: 'Global Security Overview',
    subtitle: 'Consolidated tri-firewall traffic curves, active threats & unified telemetry',
    badge: 'CORE',
    url: '/',
  },
  {
    id: 'nav-palo',
    module: 'Palo Alto Networks',
    category: 'navigation',
    title: 'Palo Alto NGFW',
    subtitle: 'Next-Gen Firewall telemetry, Threat Prevention, App-ID & Geo Intel',
    badge: 'FIREWALL',
    url: '/firewall/palo-alto',
  },
  {
    id: 'nav-isfw',
    module: 'FortiGate ISFW',
    category: 'navigation',
    title: 'FortiGate ISFW (Internal Segmentation)',
    subtitle: 'Zero-Trust East-West lateral movement containment & inter-VLAN control',
    badge: 'FIREWALL',
    url: '/firewall/isfw',
  },
  {
    id: 'nav-fgdc',
    module: 'FortiGate FGDC',
    category: 'navigation',
    title: 'FortiGate Data Center (FGDC Edge)',
    subtitle: 'Perimeter ingress/egress filtering, drop burst tracking & edge threat surface',
    badge: 'FIREWALL',
    url: '/firewall/fgdc',
  },
  {
    id: 'nav-edr',
    module: 'CrowdStrike Falcon',
    category: 'navigation',
    title: 'CrowdStrike EDR Telemetry',
    subtitle: 'Endpoint threat detection, host telemetry, MITRE ATT&CK & containment',
    badge: 'EDR',
    url: '/edr',
  },
  {
    id: 'nav-pam',
    module: 'CyberArk PAM',
    category: 'navigation',
    title: 'CyberArk Privileged Access Manager',
    subtitle: 'Privileged session monitoring (PSM), suspicious actions & credential vault',
    badge: 'PAM',
    url: '/pam',
  },
  {
    id: 'nav-db',
    module: 'Database Cluster',
    category: 'navigation',
    title: 'DB Cluster Monitor (MySQL 10.100.108.250)',
    subtitle: 'Cluster topology, replication lag, QPS throughput & slow query inspector',
    badge: 'DATABASE',
    url: '/db',
  },
  {
    id: 'nav-report',
    module: 'Executive Briefing',
    category: 'navigation',
    title: 'Executive Report Generator',
    subtitle: 'Generate formal PDF operational briefs & CSV telemetry exports',
    badge: 'REPORTS',
    url: '/overview/report',
  },
];

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OmniSearchModal({ isOpen, onClose }: OmniSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'nav' | 'firewall' | 'edr' | 'pam'>('all');
  const [liveResults, setLiveResults] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setLiveResults([]);
    }
  }, [isOpen]);

  // Live query debouncing
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLiveResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        if (res.data?.ok && Array.isArray(res.data.items)) {
          setLiveResults(res.data.items);
        } else {
          setLiveResults([]);
        }
      } catch {
        setLiveResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Dynamic context action suggestions based on patterns
  const dynamicActions = useMemo<SearchItem[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const actions: SearchItem[] = [];

    const isIpPattern = /^(\d{1,3}\.){1,3}\d{0,3}$/.test(q);
    const isHostPattern = /^(srv|desk|lap|win|dc|pc|host|node)/i.test(q);
    const isUserPattern = /^(admin|root|svc|user|dwi|albert|sec)/i.test(q);

    if (isIpPattern) {
      actions.push(
        {
          id: `act-palo-ip`,
          module: 'Palo Alto NGFW',
          category: 'action',
          title: `Filter Palo Alto Logs for IP "${q}"`,
          subtitle: `Open Palo Alto dashboard with active IP address filter`,
          badge: 'ACTION',
          url: `/firewall/palo-alto?search=${encodeURIComponent(q)}`,
        },
        {
          id: `act-fgdc-ip`,
          module: 'FortiGate FGDC',
          category: 'action',
          title: `Inspect Perimeter Traffic for IP "${q}"`,
          subtitle: `Search North-South edge firewall logs in FGDC`,
          badge: 'ACTION',
          url: `/firewall/fgdc?search=${encodeURIComponent(q)}`,
        },
        {
          id: `act-isfw-ip`,
          module: 'FortiGate ISFW',
          category: 'action',
          title: `Analyze East-West Inter-VLAN for IP "${q}"`,
          subtitle: `Inspect segmentation policies and lateral moves in ISFW`,
          badge: 'ACTION',
          url: `/firewall/isfw?search=${encodeURIComponent(q)}`,
        }
      );
    }

    if (isHostPattern || q.length >= 3) {
      actions.push({
        id: `act-edr-host`,
        module: 'CrowdStrike EDR',
        category: 'action',
        title: `Search Hostname "${q}" in EDR`,
        subtitle: `Inspect endpoint containment, active alerts & process trees`,
        badge: 'ACTION',
        url: `/edr?search=${encodeURIComponent(q)}`,
      });
    }

    if (isUserPattern || q.length >= 3) {
      actions.push({
        id: `act-pam-user`,
        module: 'CyberArk PAM',
        category: 'action',
        title: `Audit Privileged Sessions for User "${q}"`,
        subtitle: `Check PSM traces, target servers and suspicious commands`,
        badge: 'ACTION',
        url: `/pam?search=${encodeURIComponent(q)}`,
      });
    }

    return actions;
  }, [query]);

  // Combine and filter results
  const filteredNavItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return STATIC_NAV_ITEMS;
    return STATIC_NAV_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q)
    );
  }, [query]);

  const allItems = useMemo<SearchItem[]>(() => {
    let combined: SearchItem[] = [];

    if (activeTab === 'all') {
      combined = [...dynamicActions, ...liveResults, ...filteredNavItems];
    } else if (activeTab === 'nav') {
      combined = filteredNavItems;
    } else if (activeTab === 'firewall') {
      combined = [
        ...dynamicActions.filter((a) => a.module.includes('Palo') || a.module.includes('Forti')),
        ...liveResults.filter((r) => r.category === 'firewall'),
        ...filteredNavItems.filter((n) => n.badge === 'FIREWALL'),
      ];
    } else if (activeTab === 'edr') {
      combined = [
        ...dynamicActions.filter((a) => a.module.includes('CrowdStrike')),
        ...liveResults.filter((r) => r.category === 'edr'),
        ...filteredNavItems.filter((n) => n.badge === 'EDR'),
      ];
    } else if (activeTab === 'pam') {
      combined = [
        ...dynamicActions.filter((a) => a.module.includes('CyberArk')),
        ...liveResults.filter((r) => r.category === 'pam'),
        ...filteredNavItems.filter((n) => n.badge === 'PAM'),
      ];
    }

    return combined;
  }, [activeTab, dynamicActions, liveResults, filteredNavItems]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allItems, selectedIndex]);

  const handleSelect = (item: SearchItem) => {
    onClose();
    router.push(item.url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Search Modal Box */}
      <div className="relative z-10 w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden backdrop-blur-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Glow Accent Top border */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500" />

        {/* Input Bar */}
        <div className="relative flex items-center px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <Search size={20} className="text-cyan-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search cross-module (e.g. 10.100.x.x, SRV-APP-01, admin, CVE)..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm md:text-base outline-none font-medium"
          />

          {isLoading ? (
            <Loader2 size={18} className="animate-spin text-cyan-400 shrink-0 ml-2" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
            >
              <X size={16} />
            </button>
          ) : (
            <span className="text-[11px] font-bold text-slate-500 border border-slate-700 rounded-md px-1.5 py-0.5 bg-slate-800/60 shrink-0 ml-2">
              ESC
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800/80 bg-slate-950/60 overflow-x-auto text-xs">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-2 flex items-center gap-1">
            <Filter size={12} /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Results' },
            { id: 'nav', label: 'Pages' },
            { id: 'firewall', label: 'Firewalls' },
            { id: 'edr', label: 'EDR' },
            { id: 'pam', label: 'PAM' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedIndex(0);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-3 space-y-1 divide-y divide-slate-800/30"
        >
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShieldAlert size={36} className="mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">
                No matching telemetry found for &quot;{query}&quot;
              </p>
              <p className="text-xs text-slate-600">
                Try searching an IP (e.g. 10.100), Hostname, or Privileged Username.
              </p>
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isCrit = item.severity === 'critical';
              const isHigh = item.severity === 'high';

              return (
                <div
                  key={item.id + idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] translate-x-1'
                      : 'hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    {/* Icon by category */}
                    <div
                      className={`p-2 rounded-lg shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : isCrit
                          ? 'bg-rose-500/20 text-rose-400'
                          : isHigh
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-400 group-hover:text-cyan-300'
                      }`}
                    >
                      {item.category === 'action' ? (
                        <Sparkles size={16} />
                      ) : item.category === 'edr' ? (
                        <ShieldAlert size={16} />
                      ) : item.category === 'pam' ? (
                        <Lock size={16} />
                      ) : item.category === 'firewall' ? (
                        <Shield size={16} />
                      ) : (
                        <Layers size={16} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider uppercase ${
                              item.category === 'action'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isCrit
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.timestamp && (
                          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                            {item.timestamp.slice(11, 19)}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-lg">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-400">
                      {item.module}
                    </span>
                    <CornerDownLeft
                      size={14}
                      className={`transition-opacity ${
                        isSelected ? 'opacity-100 text-cyan-400' : 'opacity-0'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Hotkeys */}
        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">
                ↑↓
              </span>{' '}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">
                ↵
              </span>{' '}
              Select
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px]">
                ESC
              </span>{' '}
              Close
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400/80 font-mono">
            <Command size={12} />
            <span>Sentinel SOC OmniSearch</span>
          </div>
        </div>
      </div>
    </div>
  );
}
