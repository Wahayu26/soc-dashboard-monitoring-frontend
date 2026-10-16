'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Radio,
  Activity,
  ArrowRight,
  Globe,
  MapPin,
  Clock,
  Zap,
  Server,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  ExternalLink,
  ChevronRight,
  Network,
  Lock,
  Layers,
  ArrowUpRight,
  X,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

export interface VpnSubnetInfo {
  label: string;
  cidr: string;
  sessions: number;
  unique_ips: number;
  bytes: number;
  bytes_formatted: string;
  drops: number;
}

export interface VpnUserItem {
  username: string;
  domain_user: string;
  sessions: number;
  bytes: number;
  bytes_formatted: string;
  allow_count: number;
  drop_count: number;
  unique_ips: number;
  primary_ip: string;
  latest_time: string;
  latest_rule: string;
}

export interface ImpossibleTravelAlert {
  user: string;
  origin_a: string;
  origin_b: string;
  distance_km: number;
  time_elapsed: string;
  calculated_speed_kmh: number;
  event_time: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
}

export interface VpnRecentSession {
  id: number | string;
  event_time: string;
  username: string;
  source_ip: string;
  destination_ip: string;
  application: string;
  rule: string;
  action: string;
  total_bytes: number;
  bytes_formatted?: string;
  subnet_type: string;
}

export interface GlobalProtectTelemetryData {
  kpi?: {
    active_users: number;
    total_sessions: number;
    allow_sessions: number;
    drop_sessions: number;
    drop_ratio: number;
    total_bytes: number;
    total_bytes_formatted: string;
    anomalies_count: number;
  };
  subnets?: {
    pool_30?: VpnSubnetInfo;
    pool_40?: VpnSubnetInfo;
  };
  top_users?: VpnUserItem[];
  top_destinations?: Array<{ ip: string; hits: number }>;
  top_applications?: Array<{ app: string; hits: number }>;
  impossible_travel?: ImpossibleTravelAlert[];
  recent_sessions?: VpnRecentSession[];
}

interface GlobalProtectVpnTelemetryProps {
  telemetry?: GlobalProtectTelemetryData;
  onSelectFilter?: (filter: string) => void;
  activeFilter?: string;
}

export function GlobalProtectVpnTelemetry({
  telemetry,
  onSelectFilter,
  activeFilter,
}: GlobalProtectVpnTelemetryProps) {
  const [userSearch, setUserSearch] = useState('');
  const [activeSubnetTab, setActiveSubnetTab] = useState<'all' | '30' | '40'>('all');
  const [showSimulatedAlert, setShowSimulatedAlert] = useState(false);

  // User Audit filter targeting a specific remote worker
  const [auditUser, setAuditUser] = useState<{
    username: string;
    domain_user: string;
    primary_ip: string;
  } | null>(null);

  // Stream-specific controls
  const [streamSearch, setStreamSearch] = useState('');
  const [streamActionFilter, setStreamActionFilter] = useState<'all' | 'allow' | 'drop'>('all');
  const [streamSubnetFilter, setStreamSubnetFilter] = useState<'all' | '40' | '30'>('all');

  const kpi = telemetry?.kpi || {
    active_users: 0,
    total_sessions: 0,
    allow_sessions: 0,
    drop_sessions: 0,
    drop_ratio: 0,
    total_bytes: 0,
    total_bytes_formatted: '0 B',
    anomalies_count: 0,
  };

  const pool30 = telemetry?.subnets?.pool_30 || {
    label: 'Staff Remote VPN Pool',
    cidr: '10.20.30.0/24',
    sessions: 0,
    unique_ips: 0,
    bytes: 0,
    bytes_formatted: '0 B',
    drops: 0,
  };

  const pool40 = telemetry?.subnets?.pool_40 || {
    label: 'Branch / Cabang VPN Pool',
    cidr: '10.20.40.0/24',
    sessions: 0,
    unique_ips: 0,
    bytes: 0,
    bytes_formatted: '0 B',
    drops: 0,
  };

  const rawUsers = telemetry?.top_users || [];

  // Synchronize auditUser if activeFilter changes from parent
  useEffect(() => {
    if (!activeFilter) {
      setAuditUser(null);
    } else if (activeFilter.startsWith('username:')) {
      const uVal = activeFilter.replace('username:', '').trim();
      const cleanU = uVal.replace(/^clipan\\/i, '');
      const matched = rawUsers.find(
        (u) =>
          u.username.toLowerCase() === cleanU.toLowerCase() ||
          u.domain_user.toLowerCase() === uVal.toLowerCase()
      );
      if (matched) {
        setAuditUser({
          username: matched.username,
          domain_user: matched.domain_user,
          primary_ip: matched.primary_ip,
        });
      } else {
        setAuditUser({
          username: cleanU,
          domain_user: uVal,
          primary_ip: '',
        });
      }
    }
  }, [activeFilter, rawUsers]);

  const filteredUsers = useMemo(() => {
    return rawUsers.filter((u) => {
      if (activeSubnetTab === '30' && !u.primary_ip.startsWith('10.20.30.')) return false;
      if (activeSubnetTab === '40' && !u.primary_ip.startsWith('10.20.40.')) return false;
      if (!userSearch) return true;
      const q = userSearch.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        u.domain_user.toLowerCase().includes(q) ||
        u.primary_ip.includes(q) ||
        u.latest_rule.toLowerCase().includes(q)
      );
    });
  }, [rawUsers, userSearch, activeSubnetTab]);

  const rawAlerts = telemetry?.impossible_travel || [];
  const displayAlerts: ImpossibleTravelAlert[] = useMemo(() => {
    if (showSimulatedAlert) {
      return [
        {
          user: 'clipan\\muharjito.pradiman',
          origin_a: 'Jakarta, Indonesia (10.20.40.51 / Peer 103.165.224.213)',
          origin_b: 'Frankfurt, Germany (WAN 194.36.191.2)',
          distance_km: 11140,
          time_elapsed: '14 mins',
          calculated_speed_kmh: 47742,
          event_time: '2026-10-14 14:55:00',
          severity: 'CRITICAL',
          description:
            'User authenticated from Jakarta HQ gateway and 14 minutes later initiated VPN session from Frankfurt Germany (11,140 km apart, 47,742 km/h). Suspected hijacked credentials (MITRE ATT&CK T1078 - Valid Accounts).',
        },
        ...rawAlerts,
      ];
    }
    return rawAlerts;
  }, [rawAlerts, showSimulatedAlert]);

  const handleToggleAudit = (u: VpnUserItem) => {
    if (auditUser?.username.toLowerCase() === u.username.toLowerCase()) {
      // Toggle off
      setAuditUser(null);
      if (onSelectFilter) onSelectFilter('');
    } else {
      // Toggle on
      setAuditUser({
        username: u.username,
        domain_user: u.domain_user,
        primary_ip: u.primary_ip,
      });
      if (onSelectFilter) onSelectFilter(`username:${u.domain_user}`);

      // Smooth scroll to stream section so user sees the immediate filtered results!
      setTimeout(() => {
        const streamEl = document.getElementById('recent-vpn-stream-section');
        if (streamEl) {
          streamEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  };

  const handleAuditFromAlert = (rawUser: string) => {
    const cleanU = rawUser.replace(/^clipan\\/i, '');
    const matched = rawUsers.find(
      (u) =>
        u.username.toLowerCase() === cleanU.toLowerCase() ||
        u.domain_user.toLowerCase() === rawUser.toLowerCase()
    );
    setAuditUser({
      username: cleanU,
      domain_user: rawUser,
      primary_ip: matched?.primary_ip || '',
    });
    if (onSelectFilter) onSelectFilter(`username:${rawUser}`);
    setTimeout(() => {
      const streamEl = document.getElementById('recent-vpn-stream-section');
      if (streamEl) {
        streamEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleClearAudit = () => {
    setAuditUser(null);
    if (onSelectFilter) onSelectFilter('');
  };

  const rawRecentSessions = telemetry?.recent_sessions || [];

  const filteredRecentSessions = useMemo(() => {
    return rawRecentSessions.filter((s) => {
      // 1. Audit user filter
      if (auditUser) {
        const sUser = (s.username || '').toLowerCase();
        const aUser = auditUser.username.toLowerCase();
        const aDomain = auditUser.domain_user.toLowerCase();
        const userMatches = sUser.includes(aUser) || sUser.includes(aDomain);
        const ipMatches = Boolean(auditUser.primary_ip && auditUser.primary_ip !== '-' && s.source_ip === auditUser.primary_ip);
        if (!userMatches && !ipMatches) {
          return false;
        }
      }

      // 2. Stream status filter
      if (streamActionFilter === 'allow') {
        const act = (s.action || '').toLowerCase();
        if (act !== 'allow' && act !== 'permit' && act !== 'end') return false;
      } else if (streamActionFilter === 'drop') {
        const act = (s.action || '').toLowerCase();
        if (act !== 'drop' && act !== 'deny' && act !== 'block' && act !== 'reset') return false;
      }

      // 3. Stream subnet filter
      if (streamSubnetFilter === '40' && !s.source_ip.startsWith('10.20.40.')) return false;
      if (streamSubnetFilter === '30' && !s.source_ip.startsWith('10.20.30.')) return false;

      // 4. Stream search query
      if (streamSearch) {
        const q = streamSearch.toLowerCase();
        const match =
          (s.username || '').toLowerCase().includes(q) ||
          (s.source_ip || '').toLowerCase().includes(q) ||
          (s.destination_ip || '').toLowerCase().includes(q) ||
          (s.application || '').toLowerCase().includes(q) ||
          (s.rule || '').toLowerCase().includes(q) ||
          (s.action || '').toLowerCase().includes(q) ||
          (s.event_time || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [rawRecentSessions, auditUser, streamActionFilter, streamSubnetFilter, streamSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header Toolbar */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Network size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  GlobalProtect VPN Telemetry &amp; Velocity Monitor
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Radio size={10} className="text-blue-400 animate-pulse" />
                  <span>ACTIVE TELEMETRY</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time tracking of remote VPN worker sessions, assigned subnets (10.20.30/40.*), and credential velocity anomalies.
              </p>
            </div>
          </div>

          {/* Subnet badges & Demo Anomaly Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500">Subnets Monitored:</span>
              <span className="text-cyan-300 font-bold">10.20.30.0/24</span>
              <span className="text-slate-600">&amp;</span>
              <span className="text-blue-300 font-bold">10.20.40.0/24</span>
            </div>

            <button
              type="button"
              onClick={() => setShowSimulatedAlert((v) => !v)}
              className={`px-3 py-1 rounded-xl border text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                showSimulatedAlert
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle simulated Impossible Travel anomaly scenario for verification"
            >
              <Zap size={12} className={showSimulatedAlert ? 'text-rose-400' : 'text-slate-500'} />
              <span>{showSimulatedAlert ? 'Test Anomaly: ACTIVE' : 'Simulate Anomaly'}</span>
            </button>
          </div>
        </div>

        {/* VPN KPI Scorecards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Users size={12} className="text-cyan-400" />
              <span>Active Users</span>
            </span>
            <div className="text-xl font-bold font-mono text-cyan-300">{kpi.active_users.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500 font-mono">Distinct Authenticated</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Activity size={12} className="text-blue-400" />
              <span>Total Sessions</span>
            </span>
            <div className="text-xl font-bold font-mono text-blue-300">{kpi.total_sessions.toLocaleString()}</div>
            <span className="text-[10px] text-slate-500 font-mono">Connections logged</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>Allow vs Drop</span>
            </span>
            <div className="text-xl font-bold font-mono text-emerald-300 flex items-center gap-1.5">
              <span>{kpi.allow_sessions.toLocaleString()}</span>
              <span className="text-xs text-rose-400 font-normal">/ {kpi.drop_sessions.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Drop Ratio: <strong className={kpi.drop_ratio > 30 ? 'text-amber-400' : 'text-slate-400'}>{kpi.drop_ratio}%</strong>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-teal-400" />
              <span>VPN Volume</span>
            </span>
            <div className="text-xl font-bold font-mono text-teal-300">{kpi.total_bytes_formatted}</div>
            <span className="text-[10px] text-slate-500 font-mono">Transferred over tunnels</span>
          </div>

          <div className={`p-3.5 rounded-xl border space-y-1 col-span-2 sm:col-span-1 ${
            displayAlerts.length > 0 
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]' 
              : 'bg-slate-950/70 border-slate-800/80 text-emerald-300'
          }`}>
            <span className="text-[10.5px] font-mono uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} className={displayAlerts.length > 0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'} />
              <span>Impossible Travel</span>
            </span>
            <div className="text-xl font-bold font-mono flex items-center gap-2">
              <span>{displayAlerts.length}</span>
              {displayAlerts.length > 0 ? (
                <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ALERT
                </span>
              ) : (
                <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CLEAR
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {displayAlerts.length > 0 ? 'Velocity > 500 km/h' : 'Velocity Baseline Normal'}
            </span>
          </div>
        </div>
      </div>

      {/* Impossible Travel Alert Panel (Highlighted If Active) */}
      {displayAlerts.length > 0 ? (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-amber-950/30 border border-rose-500/40 shadow-2xl space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                <ShieldAlert size={20} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-200 flex items-center gap-2">
                  <span>Impossible Travel Geolocation Alerts</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    MITRE ATT&amp;CK T1078 (Valid Accounts)
                  </span>
                </h4>
                <p className="text-xs text-rose-300/70 font-mono">
                  Consecutive VPN sessions for single identities originating from geographically incompatible coordinates.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold animate-pulse">
              ACTION REQUIRED
            </span>
          </div>

          <div className="space-y-3">
            {displayAlerts.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white font-mono text-sm">{item.user}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {item.severity}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">• {item.event_time}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">{item.description}</p>
                  <div className="flex items-center gap-3 pt-1 text-xs font-mono text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1 text-cyan-300">
                      <MapPin size={12} className="text-cyan-400" />
                      <span>{item.origin_a}</span>
                    </div>
                    <ArrowRight size={12} className="text-slate-500" />
                    <div className="flex items-center gap-1 text-rose-300">
                      <MapPin size={12} className="text-rose-400" />
                      <span>{item.origin_b}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-amber-300">{item.distance_km.toLocaleString()} km</div>
                    <div className="text-[11px] text-rose-400 font-mono font-bold">Speed: {item.calculated_speed_kmh.toLocaleString()} km/h</div>
                    <div className="text-[10px] text-slate-500 font-mono">Elapsed: {item.time_elapsed}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAuditFromAlert(item.user)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Filter size={12} />
                      <span>Audit User</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.alert(`Active Defense: Password reset link generated & active VPN tunnel terminated for ${item.user}`);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all shadow-md cursor-pointer"
                    >
                      Lock Account
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-300 font-mono">
                Zero Impossible Travel Geolocation Violations
              </h4>
              <p className="text-[11px] text-slate-400 font-mono">
                All {kpi.active_users} active remote VPN connections are operating within safe regional transit speed (&lt;80 km/h).
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            RADAR NORMAL
          </span>
        </div>
      )}

      {/* Dual Subnet Pool Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subnet 10.20.40.0/24 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Network size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">{pool40.label}</h4>
                <span className="text-xs font-mono text-blue-400 font-bold">{pool40.cidr}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSubnetTab('40');
                setStreamSubnetFilter('40');
                if (onSelectFilter) onSelectFilter('source_ip:10.20.40.');
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Filter Subnet</span>
              <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Sessions</span>
              <div className="text-base font-bold font-mono text-blue-300">{pool40.sessions.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Unique Clients</span>
              <div className="text-base font-bold font-mono text-cyan-300">{pool40.unique_ips} IPs</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Bandwidth</span>
              <div className="text-base font-bold font-mono text-teal-300">{pool40.bytes_formatted}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1">
            <span>Policy Drops / Denies: <strong className="text-rose-400">{pool40.drops.toLocaleString()}</strong></span>
            <span className="text-slate-500">Cabang Branch Gateway Pool</span>
          </div>
        </div>

        {/* Subnet 10.20.30.0/24 */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-3 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Network size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">{pool30.label}</h4>
                <span className="text-xs font-mono text-cyan-400 font-bold">{pool30.cidr}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveSubnetTab('30');
                setStreamSubnetFilter('30');
                if (onSelectFilter) onSelectFilter('source_ip:10.20.30.');
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Filter Subnet</span>
              <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Sessions</span>
              <div className="text-base font-bold font-mono text-cyan-300">{pool30.sessions.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Unique Clients</span>
              <div className="text-base font-bold font-mono text-blue-300">{pool30.unique_ips} IPs</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Bandwidth</span>
              <div className="text-base font-bold font-mono text-teal-300">{pool30.bytes_formatted}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1">
            <span>Policy Drops / Denies: <strong className="text-rose-400">{pool30.drops.toLocaleString()}</strong></span>
            <span className="text-slate-500">Corporate Staff Remote Pool</span>
          </div>
        </div>
      </div>

      {/* Top Active VPN Users Table & Investigation */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <span>Top Active VPN Remote Workers ({filteredUsers.length})</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Ranked by session volume, allocated VPN client IP, and corporate datacenter access.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Subnet Filter Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setActiveSubnetTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeSubnetTab === 'all'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Pools
              </button>
              <button
                type="button"
                onClick={() => setActiveSubnetTab('40')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeSubnetTab === '40'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                10.20.40.*
              </button>
              <button
                type="button"
                onClick={() => setActiveSubnetTab('30')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeSubnetTab === '30'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                10.20.30.*
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search user or IP..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 w-44 font-mono"
              />
            </div>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Identity / Domain User</th>
                <th className="py-2.5 px-3">Assigned IP</th>
                <th className="py-2.5 px-3 text-right">Sessions</th>
                <th className="py-2.5 px-3 text-center">Allow / Drop</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
                <th className="py-2.5 px-3">Latest Rule</th>
                <th className="py-2.5 px-3">Latest Activity</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No active VPN users match the current search or subnet filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => {
                  const isAuditing = auditUser?.username.toLowerCase() === u.username.toLowerCase();
                  return (
                    <tr
                      key={i}
                      className={`transition-colors ${
                        isAuditing
                          ? 'bg-blue-950/40 border-l-2 border-l-blue-400'
                          : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isAuditing
                              ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                              : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                          }`}>
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-bold ${isAuditing ? 'text-blue-300' : 'text-white'}`}>{u.username}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{u.domain_user}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isAuditing
                            ? 'bg-blue-500/20 text-cyan-300 border border-blue-500/40 font-bold'
                            : 'bg-slate-950 border border-slate-800 text-blue-300'
                        }`}>
                          {u.primary_ip}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                        {u.sessions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-emerald-400 font-bold">{u.allow_count}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-rose-400 font-bold">{u.drop_count}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-teal-300 font-bold">
                        {u.bytes_formatted}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[150px]">
                        {u.latest_rule}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {u.latest_time}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAudit(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                            isAuditing
                              ? 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-[0_0_12px_rgba(59,130,246,0.6)] ring-1 ring-blue-400'
                              : 'bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300'
                          }`}
                          title={isAuditing ? 'Currently auditing this user. Click to clear' : 'Filter session stream for this user'}
                        >
                          {isAuditing ? (
                            <>
                              <CheckCircle2 size={11} className="text-white" />
                              <span>Auditing</span>
                            </>
                          ) : (
                            <span>Audit</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent VPN Traffic Session Stream */}
      <div id="recent-vpn-stream-section" className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Recent Live VPN Session Stream</span>
                <span className="text-xs font-mono text-cyan-400 font-normal">
                  ({filteredRecentSessions.length} {filteredRecentSessions.length === rawRecentSessions.length ? `Events` : `of ${rawRecentSessions.length} Events`})
                </span>
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Realtime gateway feed with client-side user audit filter, search, and action breakdown.
            </p>
          </div>

          {/* Filter Toolbar for Stream */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Subnet filter pills */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setStreamSubnetFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamSubnetFilter === 'all'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStreamSubnetFilter('40')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamSubnetFilter === '40'
                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                10.20.40.*
              </button>
              <button
                type="button"
                onClick={() => setStreamSubnetFilter('30')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamSubnetFilter === '30'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                10.20.30.*
              </button>
            </div>

            {/* Action filter pills */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setStreamActionFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamActionFilter === 'all'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStreamActionFilter('allow')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamActionFilter === 'allow'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => setStreamActionFilter('drop')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  streamActionFilter === 'drop'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Drop
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search stream..."
                value={streamSearch}
                onChange={(e) => setStreamSearch(e.target.value)}
                className="pl-8 pr-7 py-1 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-36 sm:w-44 font-mono"
              />
              {streamSearch && (
                <button
                  type="button"
                  onClick={() => setStreamSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Reset All Filters Button */}
            {(auditUser || streamSearch || streamActionFilter !== 'all' || streamSubnetFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  handleClearAudit();
                  setStreamSearch('');
                  setStreamActionFilter('all');
                  setStreamSubnetFilter('all');
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
                title="Reset all filters"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Audit User HUD Notice Banner */}
        {auditUser && (
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Eye size={13} className="animate-pulse" />
              </span>
              <span className="text-slate-400 font-semibold">Auditing VPN Worker:</span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-200 font-bold border border-blue-500/30">
                {auditUser.domain_user}
              </span>
              {auditUser.primary_ip && auditUser.primary_ip !== '-' && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Assigned IP:</span>
                  <span className="text-cyan-300 font-bold">{auditUser.primary_ip}</span>
                </>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Filtered Events:</span>
              <span className="text-emerald-400 font-bold">{filteredRecentSessions.length}</span>
            </div>

            <button
              type="button"
              onClick={handleClearAudit}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono flex items-center gap-1 self-end sm:self-auto cursor-pointer transition-all shrink-0"
            >
              <X size={12} />
              <span>Clear Audit Filter</span>
            </button>
          </div>
        )}

        {/* Scrollable Table Container */}
        <div className="max-h-[380px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
          <table className="w-full text-left text-xs font-mono relative">
            <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">VPN Client IP</th>
                <th className="py-2.5 px-3">Target Server</th>
                <th className="py-2.5 px-3">Application</th>
                <th className="py-2.5 px-3">Rule Name</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredRecentSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 space-y-2">
                    <div>No recent VPN sessions match the active audit filter or search criteria.</div>
                    {(auditUser || streamSearch || streamActionFilter !== 'all' || streamSubnetFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClearAudit();
                          setStreamSearch('');
                          setStreamActionFilter('all');
                          setStreamSubnetFilter('all');
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition-all inline-flex items-center gap-1"
                      >
                        <RotateCcw size={11} />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecentSessions.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">{s.event_time}</td>
                    <td className="py-2 px-3 font-bold text-slate-200">
                      <span className={auditUser && s.username.toLowerCase().includes(auditUser.username.toLowerCase()) ? 'text-blue-300' : ''}>
                        {s.username}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                        s.source_ip.startsWith('10.20.40.')
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          : (s.source_ip.startsWith('10.20.30.') ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'text-slate-400')
                      }`}>
                        {s.source_ip}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-cyan-300">{s.destination_ip}</td>
                    <td className="py-2 px-3 text-slate-400">{s.application}</td>
                    <td className="py-2 px-3 text-slate-400 truncate max-w-[140px]">{s.rule}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.action === 'allow' || s.action === 'end'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {s.action}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
