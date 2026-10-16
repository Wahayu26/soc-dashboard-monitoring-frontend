'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Download,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Globe,
  Radio,
  FileText,
  Server,
  Zap,
  CheckCircle2,
  Lock,
  Network
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
  Cell
} from 'recharts';
import { FortiIsfwReportExportModal } from './FortiIsfwReportExportModal';

const PRESET_RANGES = [
  { id: '1h', label: '1 Hour' },
  { id: 'today', label: 'Today' },
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
];

interface QuickFilter {
  field: 'user' | 'src' | 'dst' | 'policy' | 'app' | 'action' | 'country' | 'severity' | 'port';
  value: string;
  label?: string;
}

export function FortiIsfwDashboard() {
  const [range, setRange] = useState<string>('today');
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'policies'>('overview');
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [search, setSearch] = useState<string>('');
  const [logFeedMode, setLogFeedMode] = useState<'live' | 'snapshot'>('live');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // 1. Fetch Summary Data (KPI, Charts, Top Ranks)
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useQuery({
    queryKey: ['forti-isfw-summary', range],
    queryFn: async () => {
      const res = await api.get(`/forti/syslog?type=summary&range=${range}`, {
        timeout: 90_000,
      });
      return res.data;
    },
    refetchInterval: logFeedMode === 'live' ? 30000 : false,
    staleTime: 15000,
  });

  // 2. Fetch Real-time Syslog Stream
  const {
    data: logsData,
    isLoading: isLogsLoading,
    isError: isLogsError,
    error: logsError,
    refetch: refetchLogs,
    isFetching: isLogsFetching,
  } = useQuery({
    queryKey: ['forti-isfw-logs', range, activeFilter?.field, activeFilter?.value, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'logs');
      params.set('range', range);
      params.set('limit', '50');

      if (activeFilter) {
        params.set('filter', activeFilter.field);
        params.set('value', activeFilter.value);
      }
      if (search) {
        params.set('q', search);
      }

      const res = await api.get(`/forti/syslog?${params.toString()}`, {
        timeout: 25_000,
      });
      return res.data;
    },
    refetchInterval: logFeedMode === 'live' ? 10000 : false,
    staleTime: 5000,
  });

  const kpi = summaryData?.kpi || {};
  const charts = summaryData?.charts || {};
  const top = summaryData?.top || {};
  const logs = logsData?.logs || [];
  const rawLatest = summaryData?.raw_latest || logsData?.raw_latest || {};

  const totalLogs = Number(kpi.total || 0);
  const allowLogs = Number(kpi.allow || 0);
  const denyLogs = Number(kpi.deny || 0);
  const dropRatio = (allowLogs + denyLogs) > 0 ? ((denyLogs / (allowLogs + denyLogs)) * 100).toFixed(1) : '0.0';

  const handleSetQuickFilter = (field: QuickFilter['field'], value: string, label?: string) => {
    setActiveFilter({ field, value, label: label || `${field}: ${value}` });
    const streamElem = document.getElementById('isfw-live-stream-section');
    if (streamElem) {
      streamElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setSearch('');
  };

  const trendChartData = useMemo(() => {
    const rawTrend = charts.trend || [];
    return rawTrend.map((t: any) => ({
      time: t.label,
      events: Number(t.total ?? t.value ?? 0),
    }));
  }, [charts.trend]);

  return (
    <div className="space-y-6">
      {/* Top Header & Telemetry Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Fortinet Security Fabric
            </span>
            <span className="text-slate-500 text-xs font-mono">•</span>
            <span className="text-xs font-mono text-slate-400">East-West Microsegmentation</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="text-emerald-400" size={26} />
            <span>FortiGate ISFW Internal Segmentation Firewall</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Zero-Trust East-West lateral movement containment, inter-VLAN access control, and deep UTM inspection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Preset Range Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                  range === r.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              refetchSummary();
              refetchLogs();
            }}
            disabled={isSummaryFetching || isLogsFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
            title="Refresh ISFW Telemetry"
          >
            <RefreshCw size={14} className={isSummaryFetching || isLogsFetching ? 'animate-spin text-emerald-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Report Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-mono font-bold transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
          >
            <Download size={14} />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Segmentation Events */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Total Segmentation Logs</span>
            <Activity size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">
            {isSummaryLoading ? '...' : totalLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Real-time Inter-VLAN Telemetry</span>
          </div>
        </div>

        {/* Inter-VLAN Allowed Traffic */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Inter-VLAN Allowed</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {isSummaryLoading ? '...' : allowLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Policy Accept / Close Sessions
          </div>
        </div>

        {/* Interzone Denied / Lateral Drops */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Interzone Denials / Drops</span>
            <ShieldAlert size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {isSummaryLoading ? '...' : denyLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-400/80 font-mono mt-1">
            Blocked Lateral Traversal ({dropRatio}%)
          </div>
        </div>

        {/* UTM Inspection Hits */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">UTM Threat Hits</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {isSummaryLoading ? '...' : Number(kpi.utm || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            AV / IPS / Web Filter Profiles
          </div>
        </div>
      </div>

      {/* Secondary KPI Strip: App Control, Web Filter, SSL Deep Inspection, Server Time */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">App Control Profiling</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {Number(kpi.app || 0).toLocaleString()}
            </span>
          </div>
          <Cpu size={18} className="text-cyan-400/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Web Filter Profiles</span>
            <span className="text-lg font-bold font-mono text-teal-400">
              {Number(kpi.web || 0).toLocaleString()}
            </span>
          </div>
          <Globe size={18} className="text-teal-400/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">SSL / TLS Anomalies</span>
            <span className="text-lg font-bold font-mono text-purple-400">
              {Number(kpi.ssl || 0).toLocaleString()}
            </span>
          </div>
          <Lock size={18} className="text-purple-400/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Ingestion Latency</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {rawLatest.ingest_lag_seconds !== undefined && rawLatest.ingest_lag_seconds !== null
                ? `${rawLatest.ingest_lag_seconds}s lag`
                : 'Sub-second'}
            </span>
          </div>
          <Clock size={18} className="text-emerald-400/60" />
        </div>
      </div>

      {/* Active Quick Filter Notification Banner */}
      {activeFilter && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-emerald-400" />
            <span className="text-slate-300">Active Segmentation Filter:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {activeFilter.label || `${activeFilter.field}: ${activeFilter.value}`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearFilter}
            className="text-xs text-slate-400 hover:text-rose-400 transition-colors underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Tab Navigation Controls */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity size={14} />
          <span>Segmentation Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'servers'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Server size={14} />
          <span>VLAN &amp; Target Topologies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'policies'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers size={14} />
          <span>Microsegmentation Policies</span>
        </button>
      </div>

      {/* Tab 1: Segmentation Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Traffic Timeline Chart */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  <span>East-West Inter-VLAN Traffic Volume Trend</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  5-minute rolling buckets of internal segmentation events across zones.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400">Live Time Series</span>
            </div>

            <div className="h-64 w-full">
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="isfwTrafficGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} fontStyle="font-mono" />
                    <YAxis stroke="#64748b" fontSize={10} fontStyle="font-mono" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      name="Logs"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#isfwTrafficGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                  Awaiting timeline data points for the selected time window...
                </div>
              )}
            </div>
          </div>

          {/* Mini Top Rankings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Policies */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers size={13} className="text-emerald-400" />
                  <span>Top ISFW Policies</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.policy || []).slice(0, 5).map((p: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('policy', p.label, `Policy: ${p.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-emerald-300 truncate max-w-[150px]">{p.label}</span>
                    <span className="text-emerald-400 font-bold">{Number(p.total ?? p.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Applications */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu size={13} className="text-cyan-400" />
                  <span>Top Applications</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.app || []).slice(0, 5).map((a: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('app', a.label, `App: ${a.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-cyan-300 truncate max-w-[150px]">{a.label}</span>
                    <span className="text-cyan-400 font-bold">{Number(a.total ?? a.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Destination Servers */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database size={13} className="text-teal-400" />
                  <span>Top Destination Nodes</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.destination || []).slice(0, 5).map((d: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('dst', d.label, `Destination: ${d.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-teal-300 truncate max-w-[150px]">{d.label}</span>
                    <span className="text-teal-400 font-bold">{Number(d.total ?? d.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Source Workloads */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Globe size={13} className="text-purple-400" />
                  <span>Top Source Workloads</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.source || []).slice(0, 5).map((s: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('src', s.label, `Source: ${s.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-purple-300 truncate max-w-[150px]">{s.label}</span>
                    <span className="text-purple-400 font-bold">{Number(s.total ?? s.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: VLAN & Target Topologies */}
      {activeTab === 'servers' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Server size={16} className="text-emerald-400" />
                <span>Inter-VLAN Destination Nodes &amp; Protected Subnets</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Core internal database farms, department file servers, and branch-to-DC target resources.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Top 10 High-Traffic Nodes</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Destination IP / Server</th>
                  <th className="py-2.5 px-3">Segment Role</th>
                  <th className="py-2.5 px-3 text-right">Session Hits</th>
                  <th className="py-2.5 px-3 text-right">Traffic Share</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {(top.destination || []).map((dest: any, idx: number) => {
                  const isSelected = activeFilter?.field === 'dst' && activeFilter.value === dest.label;
                  const destVal = Number(dest.total ?? dest.value ?? 0);
                  const share = totalLogs > 0 ? ((destVal / totalLogs) * 100).toFixed(1) : '0.0';
                  const isDb = dest.label.includes('.101.') || dest.label.includes('.103.');
                  const isDmz = dest.label.startsWith('172.') || dest.label.startsWith('192.168.');
                  return (
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-emerald-500/15 border-l-4 border-emerald-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Database size={13} />
                        </div>
                        <span className={isSelected ? 'text-emerald-200' : ''}>{dest.label}</span>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDb
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : (isDmz ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300')
                        }`}>
                          {isDb ? 'Core Database Farm' : (isDmz ? 'DMZ Application Gateway' : 'Internal Department Service')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-300">
                        {destVal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {share}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setActiveFilter(null);
                            } else {
                              handleSetQuickFilter('dst', dest.label, `Destination: ${dest.label}`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active Filter' : 'Audit Node'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Microsegmentation Policies */}
      {activeTab === 'policies' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert size={16} className="text-emerald-400" />
                <span>Internal Segmentation Security Policy Hit Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Interzone forwarding policies, zero-trust microsegmentation rules, and lateral denial metrics.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Active Rule Base</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Policy Rule Identifier</th>
                  <th className="py-2.5 px-3">Rule Type</th>
                  <th className="py-2.5 px-3 text-right">Hit Count</th>
                  <th className="py-2.5 px-3 text-right">Traffic Share</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {(top.policy || []).map((pol: any, idx: number) => {
                  const isSelected = activeFilter?.field === 'policy' && activeFilter.value === pol.label;
                  const polVal = Number(pol.total ?? pol.value ?? 0);
                  const share = totalLogs > 0 ? ((polVal / totalLogs) * 100).toFixed(1) : '0.0';
                  const isDenyPolicy = pol.label.toLowerCase().includes('deny') || pol.label.toLowerCase().includes('drop');
                  return (
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-emerald-500/15 border-l-4 border-emerald-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Layers size={13} />
                        </div>
                        <span className={isSelected ? 'text-emerald-200' : ''}>{pol.label}</span>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDenyPolicy 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isDenyPolicy ? 'Interzone Deny Rule' : 'Standard Permit Rule'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-300">
                        {polVal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {share}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                          ACTIVE RULE
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setActiveFilter(null);
                            } else {
                              handleSetQuickFilter('policy', pol.label, `Policy: ${pol.label}`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active Filter' : 'Filter Rule'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Live Syslog Stream Table */}
      <div id="isfw-live-stream-section" className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Internal Segmentation Live Syslog Stream</span>
                <span className="text-xs font-mono text-emerald-400 font-normal">
                  ({logs.length} Events Ingested)
                </span>
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Authoritative real-time packet ingestion tail direct from FortiGate ISFW cluster.
            </p>
          </div>

          {/* Stream Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switcher: Live Stream vs Snapshot */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => {
                  setLogFeedMode('live');
                  handleClearFilter();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  logFeedMode === 'live' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio size={12} className={logFeedMode === 'live' ? 'animate-pulse text-white' : ''} />
                <span>Live Feed</span>
              </button>
              <button
                type="button"
                onClick={() => setLogFeedMode('snapshot')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  logFeedMode === 'snapshot' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock size={12} />
                <span>Snapshot</span>
              </button>
            </div>

            {/* Keyword Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search IP, User, Policy, App..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Syslog Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Source Node</th>
                <th className="py-2.5 px-3">Destination Node</th>
                <th className="py-2.5 px-3">Policy Rule</th>
                <th className="py-2.5 px-3">Application</th>
                <th className="py-2.5 px-3">User / Identity</th>
                <th className="py-2.5 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {isLogsLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-emerald-400" />
                      <span>Ingesting live packets from FortiGate ISFW...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No segmentation logs matching the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log: any, idx: number) => {
                  const isDeny = (log.action || '').toLowerCase().includes('deny') ||
                    (log.action || '').toLowerCase().includes('drop') ||
                    (log.action || '').toLowerCase().includes('block');
                  return (
                    <tr
                      key={log.id || idx}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {log.log_time || log.received_time}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDeny ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetQuickFilter('src', log.srcip, `Source IP: ${log.srcip}`);
                          }}
                          className="hover:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {log.srcip}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetQuickFilter('dst', log.dstip, `Dest IP: ${log.dstip}`);
                          }}
                          className="hover:text-teal-400 hover:underline cursor-pointer"
                        >
                          {log.dstip}
                        </button>
                        {log.dstport && <span className="text-slate-500 text-[10px]">:{log.dstport}</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetQuickFilter('policy', log.policyname, `Policy: ${log.policyname}`);
                          }}
                          className="hover:text-emerald-400 hover:underline cursor-pointer truncate max-w-[140px] block"
                          title={log.policyname}
                        >
                          {log.policyname || '-'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.app ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetQuickFilter('app', log.app, `App: ${log.app}`);
                            }}
                            className="hover:text-cyan-400 hover:underline cursor-pointer"
                          >
                            {log.app}
                          </button>
                        ) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.username && log.username !== '-' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetQuickFilter('user', log.username, `User: ${log.username}`);
                            }}
                            className="hover:text-purple-400 hover:underline cursor-pointer"
                          >
                            {log.username}
                          </button>
                        ) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          title="Inspect raw event"
                        >
                          <ChevronRight size={14} />
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

      {/* Raw Event Detail Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  FortiGate ISFW Syslog Event #{selectedLog.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Timestamp</span>
                  <span className="text-slate-200">{selectedLog.log_time || selectedLog.received_time}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Action</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    (selectedLog.action || '').toLowerCase().includes('deny')
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Source IP</span>
                  <span className="text-slate-200">{selectedLog.srcip}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Destination IP &amp; Port</span>
                  <span className="text-slate-200">{selectedLog.dstip}:{selectedLog.dstport}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Policy Rule</span>
                  <span className="text-slate-200">{selectedLog.policyname || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Application</span>
                  <span className="text-slate-200">{selectedLog.app || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">User / Workload Node</span>
                  <span className="text-slate-200">{selectedLog.username || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Total Transferred</span>
                  <span className="text-slate-200">{Number(selectedLog.totalbyte || 0).toLocaleString()} bytes</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Raw Syslog Payload</span>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      <FortiIsfwReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeRange={range}
        activeFilter={activeFilter?.value || ''}
      />
    </div>
  );
}
