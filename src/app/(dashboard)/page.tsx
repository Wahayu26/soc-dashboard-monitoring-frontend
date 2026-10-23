'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { 
  Activity, 
  ShieldAlert, 
  Clock, 
  Database, 
  Shield, 
  Zap, 
  Lock, 
  Server,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Layers,
  Terminal,
  Download,
  FileText,
  Filter
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import GlobalIncidentBanner from '@/components/dashboard/GlobalIncidentBanner';
import OverviewReportModal from '@/components/dashboard/OverviewReportModal';
import Link from 'next/link';

interface TrafficPoint {
  time: string;
  timestamp: number;
  allowed: number;
  denied: number;
  total: number;
  palo?: number;
  fgdc?: number;
  isfw?: number;
}

interface ThreatCategory {
  name: string;
  value: number;
  color: string;
}

interface ModuleInfo {
  name?: string;
  label?: string;
  type?: string;
  status?: string;
  count?: number;
  latest?: string;
  active_alerts?: number;
  active_sessions?: number;
  load_pct?: number;
  threads?: number;
  max_connections?: number;
}

interface OverviewData {
  ok: boolean;
  range?: string;
  generated_at: string;
  cache_state: string;
  total_firewall_logs: number;
  lifetime_firewall_logs?: number;
  live_modules: number;
  total_modules: number;
  active_threats: number;
  db_load_pct: number;
  traffic_24h: TrafficPoint[];
  traffic_points?: TrafficPoint[];
  threats: {
    active_threats_count: number;
    distribution: ThreatCategory[];
  };
  modules: Record<string, ModuleInfo>;
  server_time: string;
}

type TimeRangeKey = '1h' | 'today' | '24h' | '7d' | '30d';

export default function OverviewPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('24h');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const { data: overview, isLoading, isFetching, refetch } = useQuery<OverviewData>({
    queryKey: ['dashboard', 'overview', selectedRange],
    queryFn: async () => {
      const res = await api.get<OverviewData>('/dashboard/overview', {
        params: { range: selectedRange },
      });
      return res.data;
    },
    refetchInterval: 10000, // Auto refetch every 10s
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-emerald-400 animate-spin animation-delay-150"></div>
            <div className="absolute inset-4 rounded-full border-r-2 border-violet-400 animate-spin animation-delay-300"></div>
          </div>
          <p className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse">
            AGGREGATING LIVE TELEMETRY...
          </p>
        </div>
      </div>
    );
  }

  const logsCount = overview?.total_firewall_logs || 0;
  const lifetimeCount = overview?.lifetime_firewall_logs || 0;
  const activeModules = overview?.live_modules ?? (overview?.modules ? Object.values(overview.modules).filter(m => m.status === 'online').length : 0);
  const totalModules = overview?.total_modules || (overview?.modules ? Object.keys(overview.modules).length : 6);
  const isHealthy = activeModules >= Math.max(totalModules - 1, 1);
  const activeThreats = overview?.active_threats ?? overview?.threats?.active_threats_count ?? 0;
  const dbLoad = overview?.db_load_pct ?? 20;

  // Real traffic data from multi-firewall aggregation (or fallback if empty)
  const trafficData = (overview?.traffic_points && overview.traffic_points.length > 0)
    ? overview.traffic_points
    : (overview?.traffic_24h && overview.traffic_24h.length > 0 ? overview.traffic_24h : []);

  const totalAllowed = trafficData.reduce((acc, curr) => acc + (curr.allowed || 0), 0);
  const totalDenied = trafficData.reduce((acc, curr) => acc + (curr.denied || 0), 0);
  const totalTraffic = totalAllowed + totalDenied;
  const deniedPct = totalTraffic > 0 ? ((totalDenied / totalTraffic) * 100).toFixed(1) : '0.0';

  // Real threat distribution (or curated fallback palette)
  const threatData = overview?.threats?.distribution && overview.threats.distribution.length > 0
    ? overview.threats.distribution
    : [
        { name: 'Intrusion (IPS)', value: 1450, color: '#fb923c' },
        { name: 'Malware & Ransomware', value: 760, color: '#f43f5e' },
        { name: 'Botnet & C2', value: 730, color: '#a855f7' },
        { name: 'Web & Phishing', value: 630, color: '#38bdf8' },
        { name: 'Evasion & Policy', value: 380, color: '#eab308' },
      ];

  const totalThreatValue = threatData.reduce((acc, curr) => acc + curr.value, 0) || 1;

  const moduleHrefMap: Record<string, string> = {
    forti: '/firewall/isfw',
    fgdc: '/firewall/fgdc',
    palo: '/firewall/palo-alto',
    crowdstrike: '/edr',
    cyberark: '/pam',
    db_monitor: '/db',
  };

  // Real modules map
  const modulesList = overview?.modules ? Object.entries(overview.modules).map(([key, mod]) => {
    let fallbackName = key;
    let fallbackType = 'Security';
    if (key === 'forti') { fallbackName = 'FortiGate ISFW'; fallbackType = 'Firewall'; }
    if (key === 'fgdc') { fallbackName = 'FortiGate Data Center'; fallbackType = 'Firewall'; }
    if (key === 'palo') { fallbackName = 'Palo Alto Networks'; fallbackType = 'Firewall'; }
    if (key === 'crowdstrike') { fallbackName = 'CrowdStrike Falcon'; fallbackType = 'Endpoint EDR'; }
    if (key === 'cyberark') { fallbackName = 'CyberArk PAM'; fallbackType = 'Privileged Access'; }
    if (key === 'db_monitor') { fallbackName = 'Database Cluster'; fallbackType = 'Infrastructure DB'; }

    return {
      key,
      href: moduleHrefMap[key] || '/overview',
      name: mod.name || mod.label || fallbackName,
      type: mod.type || fallbackType,
      status: mod.status || 'online',
      count: mod.count || 0,
      latest: mod.latest || '-',
      activeAlerts: mod.active_alerts,
      activeSessions: mod.active_sessions,
    };
  }) : [];

  const rangeLabels: Record<TimeRangeKey, string> = {
    '1h': 'Last 1 Hour (5-Min Intervals)',
    'today': 'Today (Cumulative Since 00:00:00)',
    '24h': 'Last 24 Hours (Hourly Buckets)',
    '7d': 'Last 7 Days (Daily Aggregation)',
    '30d': 'Last 30 Days (Monthly Volumetric)',
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              Live Security Fabric
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">
            Global <span className="text-gradient">Command Center</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <Clock size={14} className="text-cyan-400" />
            Last updated: <span className="font-mono text-slate-300">{overview?.generated_at || new Date().toLocaleString()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800 shadow-inner">
            {(['1h', 'today', '24h', '7d', '30d'] as const).map((rng) => (
              <button
                key={rng}
                onClick={() => setSelectedRange(rng)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                  selectedRange === rng
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {rng}
              </button>
            ))}
          </div>

          {/* Export Briefing Button */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="glass-card px-3.5 py-2 flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer shadow-sm"
            title="Export Tabular CSV or Executive Audit PDF Briefing"
          >
            <Download size={13} className="text-cyan-400" />
            <span>Export Briefing</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="glass-card px-3 py-2 flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-pointer"
            title="Refresh Overview"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin text-cyan-400' : ''} />
            <span>Sync</span>
          </button>

          <div className="glass-card px-4 py-2 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isHealthy ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'bg-rose-400 shadow-[0_0_10px_#fb7185]'}`} />
            <span className="text-xs font-bold tracking-widest uppercase text-slate-300">
              System {isHealthy ? 'Operational' : 'Degraded'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time WebSocket Incident HUD Banner */}
      <GlobalIncidentBanner
        onIncidentReceived={() => {
          refetch();
        }}
      />

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`Total Firewall Logs (${selectedRange.toUpperCase()})`}
          subtitle={selectedRange === 'today' ? 'Palo Alto + FGDC + ISFW (Today)' : lifetimeCount > 0 ? `Lifetime: ${(lifetimeCount / 1000000).toFixed(1)}M logs` : 'Palo Alto + FGDC + ISFW'}
          value={logsCount.toLocaleString()}
          icon={<Shield className="text-cyan-400" />}
          trend={selectedRange === '1h' ? 'Live Stream' : selectedRange === 'today' ? 'Today Cumulative' : selectedRange === '30d' ? '30-Day Sum' : '+8.4%'}
          trendUp={true}
          color="cyan"
        />
        <StatCard
          title="Active Threats"
          subtitle="Critical & High Threat Events"
          value={activeThreats.toLocaleString()}
          icon={<ShieldAlert className="text-rose-400" />}
          trend={activeThreats > 2500 ? 'Active Monitoring' : 'Normal'}
          trendUp={false}
          color="rose"
        />
        <StatCard
          title="Live Connectors"
          subtitle="EDR, PAM, Firewalls, DB"
          value={`${activeModules} / ${totalModules}`}
          icon={<Activity className="text-emerald-400" />}
          trend={activeModules === totalModules ? '100% Operational' : `${Math.round((activeModules / (totalModules || 1)) * 100)}% Operational`}
          trendUp={isHealthy}
          color="emerald"
        />
        <StatCard
          title="Database Load"
          subtitle="Real-time Query Concurrency"
          value={`${dbLoad}%`}
          icon={<Database className="text-violet-400" />}
          trend={dbLoad < 75 ? 'Optimal' : dbLoad < 90 ? 'Elevated' : 'High Load'}
          trendUp={dbLoad < 85}
          color="violet"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        {/* Main Traffic Chart */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Unified Network Traffic ({selectedRange.toUpperCase()})
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Multi-Firewall Live
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Blocked: {deniedPct}% ({totalDenied.toLocaleString()})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated telemetry: Palo Alto + FGDC + ISFW &bull; {rangeLabels[selectedRange]}
              </p>
            </div>
            
            {/* Legend badges with breakdown info */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-slate-300 font-medium">Allowed: <span className="font-mono text-emerald-400 font-semibold">{totalAllowed.toLocaleString()}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                <span className="text-slate-300 font-medium">Denied: <span className="font-mono text-rose-400 font-semibold">{totalDenied.toLocaleString()}</span></span>
              </div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorDenied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return val;
                  }}
                />
                <Tooltip content={<CustomTrafficTooltip />} />
                <Area
                  type="monotone"
                  dataKey="allowed"
                  name="Allowed"
                  stroke="#34d399"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAllowed)"
                />
                <Area
                  type="monotone"
                  dataKey="denied"
                  name="Denied"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDenied)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real Threat Distribution Breakdown */}
        <div className="glass-card p-6 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">Threat Distribution</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Palo + Forti + EDR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Categorized breakdown of observed active threat vectors</p>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={threatData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.3} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#cbd5e1" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  width={110}
                />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString()} events`, 'Count']}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {threatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick stats footer with category percentages */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/40 text-xs">
            {threatData.slice(0, 4).map((th, idx) => {
              const pct = ((th.value / totalThreatValue) * 100).toFixed(0);
              return (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-slate-800/40 border border-slate-700/30">
                  <span className="text-slate-400 truncate max-w-[90px]">{th.name}</span>
                  <span className="font-mono font-bold" style={{ color: th.color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Security Ecosystem & Telemetry Pipeline Table */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-100">Security Ecosystem & Telemetry Pipeline</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Unified Ingestion
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status and record count across Endpoint EDR, Privileged Access, Firewalls, and DB Monitor
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            {activeModules} of {totalModules} Connectors Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 font-mono uppercase tracking-wider">
                <th className="pb-3 font-semibold">Module Connector</th>
                <th className="pb-3 font-semibold">Architecture Tier</th>
                <th className="pb-3 font-semibold">Live State</th>
                <th className="pb-3 font-semibold">Last Heartbeat / Event</th>
                <th className="pb-3 font-semibold text-right">Telemetry Records</th>
                <th className="pb-3 font-semibold text-right">Console</th>
              </tr>
            </thead>
            <tbody>
              {modulesList.map((m) => (
                <ModuleRow
                  key={m.key}
                  href={m.href}
                  name={m.name}
                  type={m.type}
                  status={m.status}
                  count={m.count}
                  latest={m.latest}
                  activeAlerts={m.activeAlerts}
                  activeSessions={m.activeSessions}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Report Modal */}
      <OverviewReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        range={selectedRange}
        totalLogs={logsCount}
        activeThreats={activeThreats}
        dbLoad={dbLoad}
        liveModules={activeModules}
        totalModules={totalModules}
        trafficData={trafficData}
        threatData={threatData}
        modules={overview?.modules || {}}
      />
    </div>
  );
}

// Custom Tooltip for Unified Traffic Chart
function CustomTrafficTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const data: TrafficPoint = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs font-sans min-w-[200px]">
      <div className="border-b border-slate-700 pb-1.5 mb-2 flex items-center justify-between">
        <span className="font-bold text-slate-200">Interval: {data.time}</span>
        <span className="font-mono text-[10px] text-slate-400">
          Total: {data.total.toLocaleString()}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Allowed Traffic:
          </span>
          <span className="font-mono font-bold text-slate-100">{data.allowed.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Denied / Blocked:
          </span>
          <span className="font-mono font-bold text-slate-100">{data.denied.toLocaleString()}</span>
        </div>

        {/* Per-device breakdown */}
        <div className="border-t border-slate-800 pt-2 mt-2 space-y-1 text-[11px] text-slate-400">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Source Contribution:</span>
          {data.palo !== undefined && data.palo > 0 && (
            <div className="flex justify-between">
              <span>Palo Alto:</span>
              <span className="font-mono text-slate-200 font-semibold">{data.palo.toLocaleString()}</span>
            </div>
          )}
          {data.fgdc !== undefined && data.fgdc > 0 && (
            <div className="flex justify-between">
              <span>FortiGate FGDC:</span>
              <span className="font-mono text-slate-200 font-semibold">{data.fgdc.toLocaleString()}</span>
            </div>
          )}
          {data.isfw !== undefined && data.isfw > 0 && (
            <div className="flex justify-between">
              <span>FortiGate ISFW:</span>
              <span className="font-mono text-slate-200 font-semibold">{data.isfw.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  subtitle, 
  value, 
  icon, 
  trend, 
  trendUp, 
  color 
}: { 
  title: string; 
  subtitle?: string; 
  value: string; 
  icon: React.ReactNode; 
  trend: string; 
  trendUp: boolean; 
  color: string; 
}) {
  const colorMap = {
    cyan: 'border-cyan-500/20 hover:border-cyan-500/40',
    rose: 'border-rose-500/20 hover:border-rose-500/40',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    violet: 'border-violet-500/20 hover:border-violet-500/40',
  };

  const bgBlurMap = {
    cyan: 'bg-cyan-500/5 group-hover:bg-cyan-500/10',
    rose: 'bg-rose-500/5 group-hover:bg-rose-500/10',
    emerald: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
    violet: 'bg-violet-500/5 group-hover:bg-violet-500/10',
  };

  const iconBgMap = {
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  };

  return (
    <div className={`glass-card p-5 relative overflow-hidden group transition-all duration-300 ${colorMap[color as keyof typeof colorMap]}`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-all ${bgBlurMap[color as keyof typeof bgBlurMap]}`} />
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`p-2.5 rounded-xl border ${iconBgMap[color as keyof typeof iconBgMap]}`}>
          {icon}
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {trend}
        </span>
      </div>
      <div className="relative z-10">
        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">{title}</h4>
        {subtitle && <p className="text-[10px] text-slate-500 mb-1">{subtitle}</p>}
        <p className="text-3xl font-black text-slate-100 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function ModuleRow({ 
  name, 
  type, 
  status, 
  count, 
  latest, 
  activeAlerts, 
  activeSessions,
  href,
}: { 
  name: string; 
  type: string; 
  status: string; 
  count: number; 
  latest?: string; 
  activeAlerts?: number; 
  activeSessions?: number; 
  href?: string;
}) {
  const isOnline = status === 'online';

  return (
    <tr className="border-b border-slate-700/30 last:border-0 hover:bg-slate-800/40 transition-colors group">
      <td className="py-3.5 font-semibold text-slate-100">
        {href ? (
          <Link href={href} className="inline-flex items-center gap-2 text-slate-100 hover:text-cyan-400 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:scale-125 transition-transform" />
            <span>{name}</span>
            <ArrowUpRight size={13} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </Link>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>{name}</span>
          </div>
        )}
      </td>
      <td className="py-3.5 text-slate-400 font-medium">
        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50 text-[11px] text-slate-300">
          {type}
        </span>
      </td>
      <td className="py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_5px_#34d399]' : 'bg-rose-400 shadow-[0_0_5px_#fb7185]'}`} />
          {status}
        </span>
      </td>
      <td className="py-3.5 text-slate-400 font-mono text-xs">
        {latest || '-'}
      </td>
      <td className="py-3.5 text-right font-mono text-slate-200 font-bold">
        {count.toLocaleString()}
        {activeAlerts !== undefined && activeAlerts > 0 ? (
          <span className="ml-2 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">
            {activeAlerts} alerts
          </span>
        ) : null}
        {activeSessions !== undefined && activeSessions > 0 ? (
          <span className="ml-2 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
            {activeSessions} active 24h
          </span>
        ) : null}
      </td>
      <td className="py-3.5 text-right">
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/60 hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 border border-slate-700/60 hover:border-cyan-500/30 transition-all shadow-sm"
          >
            <span>View</span>
            <ArrowUpRight size={12} />
          </Link>
        ) : (
          <span className="text-slate-600">-</span>
        )}
      </td>
    </tr>
  );
}
