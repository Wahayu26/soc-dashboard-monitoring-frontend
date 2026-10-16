'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Server,
  Network,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Search,
  ExternalLink,
  ChevronRight,
  Lock,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Download,
  Printer,
  Copy,
  Check,
  X,
  Eye,
  SlidersHorizontal,
  Clock,
  Radio,
  FileText,
  Zap,
  Cpu,
  Database,
  Globe,
  RotateCcw
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
  PieChart,
  Pie
} from 'recharts';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { FortiFgdcReportExportModal } from './FortiFgdcReportExportModal';
import { ipIntelLinks } from '@/lib/threatIntel';

// Helper for formatting byte volumes
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'PB');
}

// Hook for Draggable Modal Dialogs with Screen Boundary Protection
function useDraggableModal() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handleResetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!isDragging) return;

    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      const maxOffX = Math.max(100, (window.innerWidth / 2) - 120);
      const maxOffY = Math.max(100, (window.innerHeight / 2) - 80);

      const nextX = Math.min(maxOffX, Math.max(-maxOffX, dragRef.current.initX + deltaX));
      const nextY = Math.min(maxOffY, Math.max(-maxOffY, dragRef.current.initY + deltaY));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = originalUserSelect;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = originalUserSelect;
    };
  }, [isDragging]);

  return {
    position,
    isDragging,
    isMoved: position.x !== 0 || position.y !== 0,
    handleResetPosition,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      onDoubleClick: handleResetPosition,
      className: `cursor-grab active:cursor-grabbing select-none transition-colors ${
        isDragging ? 'cursor-grabbing' : ''
      }`,
      title: 'Hold & drag to move • Double-click to reset to center',
    },
    modalStyle: {
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
  };
}

export function FortiFgdcDashboard() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'1h' | 'today' | '24h' | '7d' | '30d'>('today');
  const [showExportModal, setShowExportModal] = useState(false);
  const [logFeedMode, setLogFeedMode] = useState<'live' | 'snapshot'>('live');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<{ field: string; value: string; label?: string } | null>(null);
  const [actionFilter, setActionFilter] = useState<'all' | 'deny' | 'accept' | 'utm'>('all');
  
  const [livePaused, setLivePaused] = useState(false);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'connecting' | 'paused' | 'error'>('connecting');

  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'policies'>('overview');

  // Sync tab with URL query parameter on mount and when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'servers') setActiveTab('servers');
      else if (tabParam === 'policies') setActiveTab('policies');
      else if (tabParam === 'overview') setActiveTab('overview');
    }
  }, []);

  const handleTabChange = (newTab: 'overview' | 'servers' | 'policies') => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Query: Main Forti FGDC Summary (KPIs, Charts, Top Dimensions)
  const summaryQuery = useQuery({
    queryKey: ['forti-fgdc-summary', range],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'summary');
      params.set('range', range);
      params.set('summary_mode', 'cache');

      const res = await api.get(`/forti/fgdc?${params.toString()}`);
      return res.data;
    },
    refetchInterval: livePaused ? false : 20000,
    placeholderData: (prev) => prev,
  });

  // Query: Filtered / Historical Logs
  const logsQuery = useQuery({
    queryKey: ['forti-fgdc-logs', range, debouncedSearch, activeFilter, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'logs');
      params.set('range', range);
      params.set('limit', '50');

      if (debouncedSearch) params.set('q', debouncedSearch);
      if (activeFilter) {
        params.set('filter', activeFilter.field);
        params.set('value', activeFilter.value);
      }
      if (actionFilter !== 'all') {
        params.set('action_filter', actionFilter);
      }

      const res = await api.get(`/forti/fgdc?${params.toString()}`);
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  // Query: Lightweight Real-time Live Packet Stream (Fetches latest 15 packets every 3.5s)
  const liveStreamQuery = useQuery({
    queryKey: ['forti-fgdc-live-stream'],
    queryFn: async () => {
      const res = await api.get('/forti/fgdc?type=logs&limit=15');
      return res.data;
    },
    refetchInterval: livePaused ? false : 3500,
  });

  // Merge arriving live packets into live buffer
  useEffect(() => {
    const streamLogs = liveStreamQuery.data?.logs || [];
    if (streamLogs.length > 0) {
      setLiveEvents((prev) => {
        if (prev.length === 0) {
          return streamLogs.slice(0, 30);
        }
        const newLogs = streamLogs.filter((l: any) => !prev.some((p) => p.id === l.id));
        if (newLogs.length === 0) {
          return prev;
        }
        return [...newLogs, ...prev].slice(0, 40);
      });
      setStreamStatus('connected');
    }
  }, [liveStreamQuery.data]);

  const summary = summaryQuery.data || {};
  const kpi = summary.kpi || {};
  const charts = summary.charts || {};
  const top = summary.top || {};
  const trend = (charts.trend || []) as any[];

  // Calculate Drop Ratio
  const totalLogs = Number(kpi.total || 0);
  const allowLogs = Number(kpi.allow || 0);
  const denyLogs = Number(kpi.deny || 0);
  const dropRatio = (allowLogs + denyLogs) > 0 
    ? ((denyLogs / (allowLogs + denyLogs)) * 100).toFixed(1) 
    : '0.0';

  const hasCustomFilter = Boolean(debouncedSearch || activeFilter || actionFilter !== 'all');

  const visibleLogs = hasCustomFilter
    ? (logsQuery.data?.logs || [])
    : (logFeedMode === 'live'
        ? (liveEvents.length > 0 ? liveEvents : (logsQuery.data?.logs || []))
        : (logsQuery.data?.logs || []));

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['forti-fgdc-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['forti-fgdc-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['forti-fgdc-live-stream'] }),
    ]);
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Quick Drilldown Helper
  const handleSetQuickFilter = (field: string, value: string, label: string) => {
    setActiveFilter({ field, value, label });
    // Smooth scroll down to logs table
    setTimeout(() => {
      document.getElementById('fgdc-live-stream-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const handleSetActionFilter = (act: 'all' | 'deny' | 'accept' | 'utm') => {
    setActionFilter(act);
    if (act !== 'all') {
      setTimeout(() => {
        document.getElementById('fgdc-live-stream-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setActionFilter('all');
    setSearch('');
    setDebouncedSearch('');
  };

  const inspectModal = useDraggableModal();

  return (
    <div className="space-y-6">
      {/* Top Header & Global Status Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Network size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>FortiGate FGDC Core Firewall</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span>DATA CENTER CORE</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                  Cluster High-Throughput
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Core Datacenter perimeter gateway, inter-VLAN segmentation policy enforcement, and UTM security telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Ingestion Health Status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${streamStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400">Stream:</span>
            <span className="text-emerald-400 font-bold uppercase">{streamStatus}</span>
            {summary.raw_latest?.ingest_lag_seconds !== undefined && (
              <span className="text-[10px] text-slate-500">
                (lag {summary.raw_latest.ingest_lag_seconds}s)
              </span>
            )}
          </div>

          {/* Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            {[
              { id: '1h', label: '1H' },
              { id: 'today', label: 'Today' },
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id as any)}
                className={`px-3 py-1 rounded-lg transition-all font-semibold cursor-pointer ${
                  range === r.id
                    ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={summaryQuery.isFetching}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh All Datacenter Metrics"
          >
            <RefreshCw size={15} className={summaryQuery.isFetching ? 'animate-spin text-blue-400' : ''} />
          </button>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold font-mono transition-all shadow-md shadow-blue-950/40 cursor-pointer"
          >
            <Printer size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Core Datacenter KPI Scorecards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard
          label="Total DC Events"
          value={totalLogs}
          subtitle={`Range: ${range.toUpperCase()}`}
          color="slate"
          onClick={() => handleClearFilter()}
        />
        <KpiCard
          label="Allowed Sessions"
          value={allowLogs}
          subtitle="Policy Accept / Close"
          color="emerald"
          onClick={() => handleSetActionFilter('accept')}
        />
        <KpiCard
          label="Blocked / Deny"
          value={denyLogs}
          subtitle="Policy Drops & Denies"
          color="rose"
          alert={denyLogs > 0}
          onClick={() => handleSetActionFilter('deny')}
        />
        <KpiCard
          label="DC Drop Ratio"
          value={`${dropRatio}%`}
          subtitle={Number(dropRatio) > 20 ? 'ELEVATED' : 'BASELINE NORMAL'}
          color="violet"
          onClick={() => handleSetActionFilter('deny')}
        />
        <KpiCard
          label="UTM Telemetry"
          value={kpi.utm || 0}
          subtitle="IPS / AV / Web Drops"
          color="amber"
          alert={(kpi.utm || 0) > 0}
          onClick={() => handleSetActionFilter('utm')}
        />
        <KpiCard
          label="App-Ctrl Hits"
          value={kpi.app || 0}
          subtitle="Identified Workloads"
          color="cyan"
          onClick={() => handleTabChange('overview')}
        />
        <KpiCard
          label="SSL / TLS Deep"
          value={kpi.ssl || 0}
          subtitle="Encrypted Sessions"
          color="blue"
        />
        <KpiCard
          label="DC Throughput"
          value={formatBytes(Number(kpi.totalbyte || 0))}
          subtitle="Bandwidth Inspected"
          color="teal"
        />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-blue-500/15 border border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <Activity size={14} className={activeTab === 'overview' ? 'text-blue-400' : 'text-slate-500'} />
          <span>Datacenter Overview &amp; Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('servers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'servers'
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <Server size={14} className={activeTab === 'servers' ? 'text-cyan-400' : 'text-slate-500'} />
          <span>Server Farm &amp; Core Destinations</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'policies'
              ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <ShieldAlert size={14} className={activeTab === 'policies' ? 'text-purple-400' : 'text-slate-500'} />
          <span>UTM Security &amp; Policy Matrix</span>
        </button>
      </div>

      {/* Tab 1: Datacenter Overview & Telemetry */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts Row: Trend Timeline & Security Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Timeline Chart */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Flame size={15} className="text-rose-400" />
                    <span>Data Center Blocked &amp; Dropped Traffic Trend</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Aggregated in 5-minute buckets &middot; Datacenter ingress drops and interzone policy denials.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                  5-MIN BUCKET
                </span>
              </div>

              <div className="h-64 w-full">
                {trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fortiDropGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#020617',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Drops / Blocks"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fill="url(#fortiDropGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                    No drop trend recorded in current sampling window.
                  </div>
                )}
              </div>
            </div>

            {/* Datacenter Security Inspection Breakdown */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-400" />
                  <span>Security Inspection Mix</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">UTM Engines</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">App-Control (Workloads)</span>
                    <span className="text-cyan-400 font-bold">{(kpi.app || 0).toLocaleString()} hits</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">UTM Security (AV / IPS)</span>
                    <span className="text-amber-400 font-bold">{(kpi.utm || 0).toLocaleString()} hits</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">SSL / TLS Deep Inspection</span>
                    <span className="text-blue-400 font-bold">{(kpi.ssl || 0).toLocaleString()} hits</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Webfilter Security</span>
                    <span className="text-emerald-400 font-bold">{(kpi.web || 0).toLocaleString()} hits</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '25%' }} />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1 mt-4">
                <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                  <Lock size={12} />
                  <span>Datacenter Segmentation Profile:</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Strict inter-VLAN inspection enabled between Application Clusters, Oracle/SQL Database Farm, and Management Tiers.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Quick Drilldown Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Policies */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-400" />
                  <span>Top Security Policies</span>
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
                    <span className="text-slate-300 group-hover:text-blue-300 truncate max-w-[150px]">{p.label}</span>
                    <span className="text-blue-400 font-bold">{Number(p.total ?? p.value ?? 0).toLocaleString()}</span>
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

            {/* Top Core Destination Servers */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database size={13} className="text-teal-400" />
                  <span>Core Target Servers</span>
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
                  <span>Top Source Nodes</span>
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

      {/* Tab 2: Server Farm & Core Destinations */}
      {activeTab === 'servers' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Server size={16} className="text-cyan-400" />
                <span>Datacenter Server Farm &amp; Core IP Destinations</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Core internal servers, database clusters, and management nodes protected behind FGDC cluster.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Top 10 High-Traffic Server Nodes</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Server Node / IP</th>
                  <th className="py-2.5 px-3">Workload Role</th>
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
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-cyan-500/15 border-l-4 border-cyan-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Database size={13} />
                        </div>
                        <span className={isSelected ? 'text-cyan-200' : ''}>{dest.label}</span>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDb
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : (isDmz ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300')
                        }`}>
                          {isDb ? 'Core Database Cluster' : (isDmz ? 'DMZ Application Gateway' : 'Internal Core Service')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
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
                              ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                              : 'bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active Filter' : 'Audit Server'}
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

      {/* Tab 3: UTM Security & Policy Matrix */}
      {activeTab === 'policies' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert size={16} className="text-purple-400" />
                <span>FortiGate Security Policy Efficiency &amp; UTM Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Datacenter security policy hit counts, interzone rule evaluation, and UTM inspection efficacy.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Security Rule Base</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Policy Rule Identifier</th>
                  <th className="py-2.5 px-3">Rule Type</th>
                  <th className="py-2.5 px-3 text-right">Hit Count</th>
                  <th className="py-2.5 px-3 text-right">Policy Share</th>
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
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-purple-500/15 border-l-4 border-purple-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Layers size={13} />
                        </div>
                        <span className={isSelected ? 'text-purple-200' : ''}>{pol.label}</span>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDenyPolicy 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isDenyPolicy ? 'Interzone Deny Rule' : 'Standard Accept Rule'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-purple-300">
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
                              ? 'bg-purple-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                              : 'bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300'
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

      {/* Interactive Live Data Center Packet Stream Table */}
      <div id="fgdc-live-stream-section" className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Data Center Firewall Live Log Stream</span>
                <span className="text-xs font-mono text-cyan-400 font-normal">
                  ({visibleLogs.length} Events Buffer)
                </span>
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Authoritative real-time packet ingestion tail direct from FortiGate FGDC cluster with 1-click drilldown inspection.
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  logFeedMode === 'live' && !hasCustomFilter
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio size={12} className={logFeedMode === 'live' && !hasCustomFilter ? 'animate-pulse text-cyan-400' : ''} />
                <span>Live Feed</span>
              </button>

              <button
                type="button"
                onClick={() => setLogFeedMode('snapshot')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  logFeedMode === 'snapshot' && !hasCustomFilter
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Snapshot ({range.toUpperCase()})</span>
              </button>
            </div>

            {/* Quick Action Filter Pills */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => handleSetActionFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleSetActionFilter('deny')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'deny' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Denied
              </button>
              <button
                type="button"
                onClick={() => handleSetActionFilter('accept')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'accept' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => handleSetActionFilter('utm')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'utm' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                UTM Only
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search IP, app, rule..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-7 py-1 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-44 font-mono"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setDebouncedSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Reset Filter Button */}
            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
                title="Reset active drilldown filters"
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter HUD Notice */}
        {hasCustomFilter && (
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center justify-between gap-3 text-xs font-mono shadow-[0_0_20px_rgba(59,130,246,0.15)] animate-in fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Filter size={13} className="animate-pulse" />
              </span>
              <span className="text-slate-400 font-semibold">Active Filter:</span>
              {activeFilter && (
                <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-200 font-bold border border-blue-500/30 flex items-center gap-1">
                  <span>{activeFilter.label || `${activeFilter.field}: ${activeFilter.value}`}</span>
                  <button
                    type="button"
                    onClick={() => setActiveFilter(null)}
                    className="hover:text-white cursor-pointer ml-1"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {actionFilter !== 'all' && (
                <span className={`px-2 py-0.5 rounded-lg font-bold border flex items-center gap-1 ${
                  actionFilter === 'deny'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : (actionFilter === 'accept' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30')
                }`}>
                  <span>Action: {actionFilter.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={() => setActionFilter('all')}
                    className="hover:text-white cursor-pointer ml-1"
                    title="Remove action filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {debouncedSearch && (
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-200 font-bold border border-cyan-500/30 flex items-center gap-1">
                  <span>Query: "{debouncedSearch}"</span>
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setDebouncedSearch(''); }}
                    className="hover:text-white cursor-pointer ml-1"
                    title="Clear query"
                  >
                    ×
                  </button>
                </span>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Matching Events:</span>
              <span className="text-emerald-400 font-bold">{visibleLogs.length}</span>
            </div>

            <button
              type="button"
              onClick={handleClearFilter}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-all"
            >
              <X size={12} />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {/* Scrollable Logs Table Container */}
        <div className="max-h-[440px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
          <table className="w-full text-left text-xs font-mono relative">
            <thead className="sticky top-0 z-10 bg-slate-950/95 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-3">Time (WIB)</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Source IP</th>
                <th className="py-2.5 px-3">Destination IP</th>
                <th className="py-2.5 px-3">Port / App</th>
                <th className="py-2.5 px-3">Policy Rule</th>
                <th className="py-2.5 px-3">Workload / Node</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
                <th className="py-2.5 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 space-y-2">
                    <div>No data center events match the current filter or search criteria.</div>
                    {hasCustomFilter && (
                      <button
                        type="button"
                        onClick={handleClearFilter}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition-all inline-flex items-center gap-1"
                      >
                        <X size={11} />
                        <span>Clear All Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log: any, idx: number) => {
                  const act = (log.action || '').toLowerCase();
                  const isDeny = act.includes('deny') || act.includes('block') || act.includes('drop');
                  const isAllow = act === 'accept' || act === 'allow' || act === 'close';
                  const isRst = act.includes('rst');

                  return (
                    <tr
                      key={log.id || idx}
                      onClick={() => setInspectingLog(log)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {log.log_time || log.received_time}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isDeny 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : (isAllow ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30')
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-blue-300">{log.srcip}</td>
                      <td className="py-2 px-3 font-semibold text-cyan-300">{log.dstip}</td>
                      <td className="py-2 px-3 text-slate-300">
                        <span>{log.dstport || '-'}</span>
                        <span className="text-slate-500 text-[10px] ml-1">({log.app || 'network'})</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[150px]">
                        {log.policyname || (log.policyid !== undefined && log.policyid !== null ? `Policy ${log.policyid}` : 'Policy 0')}
                      </td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[140px]">
                        {log.username || '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-teal-300 font-bold">
                        {formatBytes(Number(log.totalbyte || 0))}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 inline-flex items-center justify-center">
                          <Eye size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draggable Log Inspect Modal Dialog */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            style={inspectModal.modalStyle}
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div
              {...inspectModal.dragHandleProps}
              className={`p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 select-none ${
                inspectModal.isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Network size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 font-mono">
                    FGDC Datacenter Packet Inspector &bull; ID: #{inspectingLog.id}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">{inspectingLog.log_time}</span>
                </div>
              </div>

              <div className="flex items-center gap-2" data-no-drag>
                {inspectModal.isMoved && (
                  <button
                    type="button"
                    onClick={inspectModal.handleResetPosition}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    title="Reset modal position"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingLog(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Inspect Body */}
            <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
              {/* Primary Packet Tuple */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Source Ingress:</span>
                  <div className="text-blue-300 font-bold text-sm">{inspectingLog.srcip}</div>
                  <div className="text-[10px] text-slate-400">Node: {inspectingLog.username || 'Unspecified'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Destination Target:</span>
                  <div className="text-cyan-300 font-bold text-sm">{inspectingLog.dstip}:{inspectingLog.dstport}</div>
                  <div className="text-[10px] text-slate-400">App: {inspectingLog.app || 'Unknown'}</div>
                </div>
              </div>

              {/* Policy & Action Details */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Action:</span>
                  <span className="font-bold text-emerald-400 uppercase">{inspectingLog.action}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Policy:</span>
                  <span className="font-bold text-slate-200 truncate block">{inspectingLog.policyname || '-'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Bandwidth:</span>
                  <span className="font-bold text-teal-300">{formatBytes(Number(inspectingLog.totalbyte || 0))}</span>
                </div>
              </div>

              {/* Threat Intel Lookup Links */}
              {inspectingLog.srcip && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <ExternalLink size={11} />
                    <span>External Threat Intelligence Feeds (Source IP: {inspectingLog.srcip}):</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ipIntelLinks(inspectingLog.srcip).map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1 transition-all"
                      >
                        <span>{link.name}</span>
                        <ExternalLink size={10} className="opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw Message Payload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Raw Log Message Payload:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(inspectingLog.raw_message || inspectingLog.msg || JSON.stringify(inspectingLog, null, 2), 'raw')}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {copiedText === 'raw' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedText === 'raw' ? 'Copied' : 'Copy Payload'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {inspectingLog.raw_message || inspectingLog.msg || JSON.stringify(inspectingLog, null, 2)}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between" data-no-drag>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSetQuickFilter('src', inspectingLog.srcip, `Source: ${inspectingLog.srcip}`);
                    setInspectingLog(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
                >
                  Filter Source IP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSetQuickFilter('dst', inspectingLog.dstip, `Destination: ${inspectingLog.dstip}`);
                    setInspectingLog(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
                >
                  Filter Target IP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pol = inspectingLog.policyname || `Policy ${inspectingLog.policyid ?? 0}`;
                    handleSetQuickFilter('policy', pol, `Policy: ${pol}`);
                    setInspectingLog(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all cursor-pointer"
                >
                  Filter Policy
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      <FortiFgdcReportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        activeRange={range}
        activeFilter={activeFilter?.value || ''}
      />
    </div>
  );
}

// Subcomponent: KPI Metric Scorecard
function KpiCard({ label, value, subtitle, color = 'slate', alert = false, onClick }: any) {
  const colorStyles: Record<string, string> = {
    slate: 'hover:border-slate-700 text-slate-100',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400',
    rose: 'border-rose-500/20 hover:border-rose-500/40 text-rose-400',
    amber: 'border-amber-500/20 hover:border-amber-500/40 text-amber-400',
    violet: 'border-violet-500/20 hover:border-violet-500/40 text-violet-400',
    cyan: 'border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400',
    blue: 'border-blue-500/20 hover:border-blue-500/40 text-blue-400',
    teal: 'border-teal-500/20 hover:border-teal-500/40 text-teal-400',
  };

  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-2xl bg-slate-900/80 border transition-all duration-200 backdrop-blur-md ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg' : ''
      } ${colorStyles[color] || colorStyles.slate}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
        {alert && (
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-lg lg:text-xl font-bold font-mono tracking-tight text-white truncate">
          {formattedValue}
        </span>
      </div>

      {subtitle && (
        <span className="mt-0.5 text-[10px] font-mono text-slate-500 block truncate">
          {subtitle}
        </span>
      )}
    </div>
  );
}
