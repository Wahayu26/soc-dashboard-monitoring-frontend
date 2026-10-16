'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Terminal, 
  Flame, 
  Globe, 
  Radio, 
  RefreshCw, 
  Download, 
  ExternalLink, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Lock, 
  AlertTriangle, 
  X, 
  Check, 
  Copy, 
  Loader2, 
  Play, 
  Pause, 
  ChevronRight, 
  Zap, 
  Eye, 
  RotateCcw, 
  GripHorizontal,
  Server,
  Cpu,
  Database,
  ArrowRight,
  FileText,
  Network
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ThreatGeoMap, type GeoPoint } from './ThreatGeoMap';
import { PaloAltoReportExportModal } from './PaloAltoReportExportModal';
import { PaloThreatIntelMatrix, type ThreatSignature, type MitreTacticItem } from './PaloThreatIntelMatrix';
import { GlobalProtectVpnTelemetry } from './GlobalProtectVpnTelemetry';
import { AppIdRiskMatrix } from './AppIdRiskMatrix';
import { ipIntelLinks, cveLink, mitreTechniqueLink } from '@/lib/threatIntel';

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

export function PaloAltoDashboard() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<'1h' | 'today' | '24h' | '7d' | '30d'>('1h');
  const [showExportModal, setShowExportModal] = useState(false);
  const [logFeedMode, setLogFeedMode] = useState<'live' | 'snapshot'>('live');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [livePaused, setLivePaused] = useState(false);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [sseStatus, setSseStatus] = useState<'connected' | 'connecting' | 'paused' | 'error'>('connecting');
  const [pausedQueueCount, setPausedQueueCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'perimeter' | 'vpn' | 'app-risk'>('perimeter');

  // Sync tab with URL query parameter on mount and when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'vpn') setActiveTab('vpn');
      else if (tabParam === 'app-risk' || tabParam === 'app-id') setActiveTab('app-risk');
      else if (tabParam === 'perimeter') setActiveTab('perimeter');
    }
  }, []);

  const handleTabChange = (newTab: 'perimeter' | 'vpn' | 'app-risk') => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // ESC key handler for inspector modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectingLog) {
        setInspectingLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingLog]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  // Query: Main Security Summary (KPI, Trend, Panels, Geo Points)
  const summaryQuery = useQuery({
    queryKey: ['palo-summary', range, debouncedSearch, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('action', 'summary');
      params.set('range', range);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeFilter) params.set('filter', activeFilter);

      const res = await api.get(`/syslog?${params.toString()}`);
      return res.data;
    },
    refetchInterval: livePaused ? false : 15000,
    placeholderData: (prev) => prev,
  });

  const hasCustomFilter = Boolean(debouncedSearch || activeFilter || page > 1);

  // Query: Paginated Filtered Logs Feed (Only executes when searching, filtering, or paginating)
  const logsQuery = useQuery({
    queryKey: ['palo-logs', range, page, debouncedSearch, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('action', 'logs');
      params.set('range', range);
      params.set('page', page.toString());
      params.set('limit', '50');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeFilter) params.set('filter', activeFilter);

      const res = await api.get(`/syslog?${params.toString()}`);
      return res.data;
    },
    enabled: hasCustomFilter,
    placeholderData: (prev) => prev,
  });

  // Query: Lightweight Real-time Live Packet Stream (Fetches latest 15 packets every 3.5s without blocking PHP)
  const liveStreamQuery = useQuery({
    queryKey: ['palo-live-stream'],
    queryFn: async () => {
      const res = await api.get('/syslog?action=live&limit=15');
      return res.data;
    },
    refetchInterval: livePaused ? false : 3500,
  });

  // Automatically merge new arriving live packets into liveEvents buffer
  useEffect(() => {
    const streamLogs = liveStreamQuery.data?.logs || liveStreamQuery.data?.latest_logs || [];
    if (streamLogs.length > 0) {
      setLiveEvents((prev) => {
        if (prev.length === 0) {
          return streamLogs.slice(0, 25);
        }
        const newLogs = streamLogs.filter((l: any) => !prev.some((p) => p.id === l.id));
        if (newLogs.length === 0) {
          return prev;
        }
        return [...newLogs, ...prev].slice(0, 30);
      });
      setSseStatus('connected');
    }
  }, [liveStreamQuery.data]);

  // Seed initial live events from summary logs if liveEvents is empty
  useEffect(() => {
    const initialLogs = summaryQuery.data?.logs || summaryQuery.data?.latest_logs || [];
    if (initialLogs.length > 0 && liveEvents.length === 0) {
      setLiveEvents(initialLogs.slice(0, 15));
      setSseStatus('connected');
    }
  }, [summaryQuery.data, liveEvents.length]);

  const summary = summaryQuery.data || {};
  const kpi = summary.kpi || summary.cards || {};
  const panels = summary.panels || {};
  const trend = (summary.trend || []) as any[];
  const geoPoints = (summary.geo_points || []) as GeoPoint[];
  const threatSignatures = (panels.top_threat_signatures || panels.threat_signatures || []) as ThreatSignature[];
  const mitreTactics = (panels.mitre_tactics || []) as MitreTacticItem[];
  const rawLogs = hasCustomFilter
    ? (logsQuery.data?.logs || [])
    : (logFeedMode === 'live'
        ? (liveEvents.length > 0 ? liveEvents : (summary.logs || []))
        : (summary.logs || []));

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['palo-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['palo-live-stream'] }),
      hasCustomFilter ? queryClient.invalidateQueries({ queryKey: ['palo-logs'] }) : Promise.resolve(),
    ]);
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (!rawLogs.length) return;
    const headers = [
      'ID',
      'Event Time',
      'Action',
      'Source IP',
      'Destination IP',
      'Port',
      'Application',
      'Rule Name',
      'Severity',
      'Country',
      'Type',
      'Total Bytes'
    ];
    const rows = rawLogs.map((l: any) => [
      l.id,
      `"${l.event_time || l.time || ''}"`,
      `"${l.action || ''}"`,
      `"${l.source_ip || l.src || ''}"`,
      `"${l.destination_ip || l.dst || ''}"`,
      l.destination_port || l.port || '',
      `"${l.application_name || l.app || ''}"`,
      `"${l.rule_name || l.rule || ''}"`,
      `"${l.severity || ''}"`,
      `"${l.country || ''}"`,
      `"${l.type || ''}"`,
      l.total_bytes || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PaloAlto_Audit_Logs_${range}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      {/* Draggable Log Inspector Modal */}
      {inspectingLog && (
        <LogInspectorModal
          log={inspectingLog}
          copiedText={copiedText}
          onCopy={handleCopy}
          onClose={() => setInspectingLog(null)}
          onFilterByIp={(ip) => {
            setActiveFilter(`source_ip:${ip}`);
            setInspectingLog(null);
          }}
          onFilterByRule={(rule) => {
            setActiveFilter(`rule_name:${rule}`);
            setInspectingLog(null);
          }}
        />
      )}

      {/* Draggable Export & Report Modal (CSV with Custom Date & Executive Audit PDF) */}
      <PaloAltoReportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        activeRange={range}
        activeFilter={activeFilter}
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-orange-300 to-amber-400">
                  Palo Alto Networks NGFW
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                  PERIMETER GATEWAY
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-slate-400 mt-1">
                <span>Telemetry: <strong className="text-slate-200">{Number(kpi.total || 0).toLocaleString()}</strong> events ({range.toUpperCase()})</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  range === '1h' 
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' 
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {range === '1h' ? 'Live Stream Window' : 'Rollup Aggregated'}
                </span>
                <span className="text-slate-600">&bull;</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Latest Event: <strong className="text-emerald-300 font-bold">{summary.meta?.latest_event_time || summary.meta?.latest_time || liveEvents[0]?.event_time || 'Streaming'}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time range switcher */}
          <div className="flex items-center bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
            {(['1h', 'today', '24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer flex items-center gap-1.5 ${
                  range === r
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {summaryQuery.isFetching && range === r && (
                  <Loader2 size={11} className="animate-spin text-rose-400" />
                )}
                <span>{r.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* SSE Live Streaming Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <div className={`w-2 h-2 rounded-full ${
              sseStatus === 'connected'
                ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                : sseStatus === 'paused'
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`} />
            <span className="text-slate-300 font-semibold text-[11px] uppercase">
              {livePaused ? 'PAUSED' : 'LIVE STREAM (3s)'}
            </span>
          </div>

          {/* Live stream toggle button */}
          <button
            type="button"
            onClick={() => setLivePaused(!livePaused)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              livePaused
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
            title={livePaused ? 'Lanjutkan live stream' : 'Jeda live stream untuk freeze investigasi'}
          >
            {livePaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{livePaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Manual sync button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={summaryQuery.isFetching}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-all cursor-pointer"
            title="Sinkronisasi data manual sekarang"
          >
            <RefreshCw size={14} className={summaryQuery.isFetching ? 'animate-spin text-cyan-400' : ''} />
          </button>

          {/* Export CSV & Executive Report Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
            title="Buka Hub Export CSV (Custom Date) & Executive PDF Report"
          >
            <FileText size={13} />
            <span>Export & Report</span>
          </button>
        </div>
      </div>

      {/* Active Filter Pill Alert Banner */}
      {activeFilter && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-200 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-rose-400" />
            <span>Filter Aktif: <b>{activeFilter}</b></span>
            <span className="text-[10px] text-slate-400">({rawLogs.length} log matched)</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter('')}
            className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
          >
            <X size={12} />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Executive Security KPI Cards (8 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard
          label="Total Events"
          value={kpi.total || 0}
          subtitle={`Range: ${range.toUpperCase()}`}
          color="slate"
          onClick={() => setActiveFilter('')}
        />
        <KpiCard
          label="Allowed Traffic"
          value={kpi.allow || kpi.allowed || 0}
          subtitle="Policy Accept"
          color="emerald"
          onClick={() => setActiveFilter('action:allow')}
        />
        <KpiCard
          label="Blocked / Deny"
          value={kpi.blocked || (kpi.deny + kpi.drop) || 0}
          subtitle="Drop / Deny / Reset"
          color="rose"
          alert={(kpi.blocked || 0) > 0}
          onClick={() => setActiveFilter('action:blocked')}
        />
        <KpiCard
          label="Threats Detected"
          value={kpi.threat || 0}
          subtitle={`Crit: ${kpi.threat_critical || 0} | High: ${kpi.threat_high || 0}`}
          color="amber"
          alert={(kpi.threat || 0) > 0}
          onClick={() => setActiveFilter('type:THREAT')}
        />
        <KpiCard
          label="Drop Ratio"
          value={`${kpi.drop_ratio || 0}%`}
          subtitle={`Baseline: ${kpi.baseline || 'NORMAL'}`}
          color="violet"
        />
        <KpiCard
          label="System Events"
          value={kpi.system || 0}
          subtitle="Daemon / Engine"
          color="cyan"
          onClick={() => setActiveFilter('type:SYSTEM')}
        />
        <KpiCard
          label="GlobalProtect"
          value={kpi.globalprotect || kpi.vpn || 0}
          subtitle="Remote VPN (Click for Telemetry)"
          color="blue"
          onClick={() => handleTabChange('vpn')}
        />
        <KpiCard
          label="Live Ingestion"
          value={summary.meta?.status === 'ok' ? 'HEALTHY' : 'SYNCED'}
          subtitle="Lag: <1s realtime"
          color="teal"
        />
      </div>

      {/* View Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => handleTabChange('perimeter')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'perimeter'
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <ShieldAlert size={14} className={activeTab === 'perimeter' ? 'text-cyan-400' : 'text-slate-500'} />
          <span>Perimeter &amp; Threat Defense</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('vpn')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer relative ${
            activeTab === 'vpn'
              ? 'bg-blue-500/15 border border-blue-500/40 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <Network size={14} className={activeTab === 'vpn' ? 'text-blue-400' : 'text-slate-500'} />
          <span>GlobalProtect VPN Telemetry</span>
          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px]">
            10.20.30/40.*
          </span>
          {(panels.globalprotect_telemetry?.impossible_travel?.length || 0) > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-0.5 -right-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('app-risk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'app-risk'
              ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
          }`}
        >
          <Layers size={14} className={activeTab === 'app-risk' ? 'text-purple-400' : 'text-slate-500'} />
          <span>App-ID Risk &amp; Shadow IT</span>
          {(panels.app_risk_matrix?.kpi?.shadow_it_alerts || 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
              {panels.app_risk_matrix?.kpi?.shadow_it_alerts} Alert
            </span>
          )}
        </button>
      </div>

      {activeTab === 'perimeter' && (
        <>
          {/* Interactive World Threat & Geo Access Map */}
          <ThreatGeoMap
            geoPoints={geoPoints}
            vpnSegmentStats={panels.vpn_segment_stats}
            activeFilter={activeFilter}
            onSelectFilter={(f) => setActiveFilter(f)}
          />

      {/* Primary Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Timeline Chart */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 shadow-xl space-y-4 lg:col-span-2 overflow-hidden backdrop-blur-md hover:border-slate-700/80 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/25 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Flame size={15} className="text-rose-400" />
                <span>Blocked / Deny / Threat Activity Trend</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Aggregated in 5-minute intervals &middot; Firewall drop &amp; threat volume surges.
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-slate-800 shadow-inner">
              5-MIN BUCKET
            </span>
          </div>

          <div className="h-64 w-full">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="paloDropGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontFamily: 'monospace' }}
                    formatter={(val: any) => [`${Number(val).toLocaleString()} Blocked Packets`, 'Volume']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fill="url(#paloDropGrad)"
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
                Collecting historical trend telemetry...
              </div>
            )}
          </div>
        </div>

        {/* Live Packet & Threat Stream Bar (SSE) */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 shadow-xl space-y-3 flex flex-col justify-between overflow-hidden backdrop-blur-md hover:border-slate-700/80 transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <h3 className="text-sm font-bold text-slate-100">Live Real-time Packet Stream</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm">
              BUFFER: {liveEvents.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-64">
            {liveEvents.length > 0 ? (
              liveEvents.map((evt: any, idx: number) => {
                const action = (evt.action || 'allow').toLowerCase();
                const isDrop = action === 'drop' || action === 'deny' || action === 'reset';

                return (
                  <div
                    key={evt.id || idx}
                    onClick={() => setInspectingLog(evt)}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-900/80 hover:-translate-y-0.5 transition-all text-xs font-mono space-y-1.5 cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 truncate">{evt.event_time || evt.time || 'Now'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isDrop
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                      }`}>
                        {evt.action}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 text-[11px]">
                      <span className="truncate text-cyan-300 font-semibold">{evt.source_ip || evt.src}</span>
                      <ArrowRight size={10} className="text-slate-600 shrink-0 mx-1 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      <span className="truncate text-slate-200">{evt.destination_ip || evt.dst}:{evt.destination_port || evt.port}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="text-amber-400/90 truncate font-sans font-medium">{evt.application_name || evt.app || 'general'}</span>
                      <span className="truncate">{evt.rule_name || evt.rule || 'rule-default'}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full py-12 flex flex-col items-center justify-center text-center text-slate-500 text-xs font-mono space-y-2">
                <Loader2 size={20} className="animate-spin text-cyan-400" />
                <span>Listening to live Palo Alto packet stream via SSE...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Attack Vectors & Analytics Drilldown Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Attacker Source IPs */}
        <ListPanel
          title="Top Attacker IPs"
          subtitle="Source IP Blocked"
          items={(panels.top_attackers || []).slice(0, 6)}
          keyLabel="source_ip"
          altKeyLabel="ip"
          countLabel="hits"
          color="rose"
          onSelect={(val: string) => setActiveFilter(`source_ip:${val}`)}
        />

        {/* Top Target Destinations */}
        <ListPanel
          title="Top Target IPs"
          subtitle="Destination IP Assets"
          items={(panels.top_destinations || []).slice(0, 6)}
          keyLabel="destination_ip"
          altKeyLabel="ip"
          countLabel="hits"
          color="amber"
          onSelect={(val: string) => setActiveFilter(`destination_ip:${val}`)}
        />

        {/* Top Applications */}
        <ListPanel
          title="Top Applications"
          subtitle="Application-ID Classification"
          items={(panels.top_apps || panels.top_applications || []).slice(0, 6)}
          keyLabel="application_name"
          altKeyLabel="app"
          countLabel="hits"
          color="cyan"
          onSelect={(val: string) => setActiveFilter(`application_name:${val}`)}
        />

        {/* Top Triggered Security Rules */}
        <ListPanel
          title="Top Triggered Rules"
          subtitle="Firewall Security Policies"
          items={(panels.top_rules || []).slice(0, 6)}
          keyLabel="rule_name"
          altKeyLabel="rule"
          countLabel="hits"
          color="violet"
          onSelect={(val: string) => setActiveFilter(`rule_name:${val}`)}
        />
      </div>

      {/* MITRE ATT&CK Matrix & Threat Signatures Section */}
      <PaloThreatIntelMatrix
        threatSignatures={threatSignatures}
        mitreTactics={mitreTactics}
        totalThreats={kpi.threat || 0}
        activeFilter={activeFilter}
        onSelectFilter={(f) => setActiveFilter(f)}
      />

      {/* Forensic Log Explorer Table */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 hover:border-slate-700/80 shadow-2xl backdrop-blur-xl space-y-4 overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Terminal size={17} className="text-cyan-400" />
              <span>Realtime Firewall Log Explorer</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Inspeksi detail paket, Application-ID, NAT rules, dan identifikasi sesi ancaman.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Stream Mode Switcher (Live vs Historical Snapshot) */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setLogFeedMode('live')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1.5 ${
                  logFeedMode === 'live' && !hasCustomFilter
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Display real-time incoming live packet feed"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${livePaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span>Live Feed ({liveEvents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLogFeedMode('snapshot')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer flex items-center gap-1.5 ${
                  logFeedMode === 'snapshot' && !hasCustomFilter
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Display historical log snapshot for ${range.toUpperCase()} range`}
              >
                <span>Snapshot ({range.toUpperCase()})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-56 sm:w-64">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search IP, app, rule, port..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Action Filter Tabs */}
            <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setActiveFilter('')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  !activeFilter ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('action:blocked')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeFilter === 'action:blocked' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Blocked
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('action:allow')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeFilter === 'action:allow' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('type:THREAT')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  activeFilter === 'type:THREAT' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Threats
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold sticky top-0 z-20 backdrop-blur-md text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Time (WIB)</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Action</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Source IP</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Destination</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Application</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Security Rule</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Severity</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800">Country</th>
                <th className="px-3.5 py-2.5 border-b border-slate-800 text-center whitespace-nowrap">Detail Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {rawLogs.map((log: any, idx: number) => {
                const action = (log.action || '').toLowerCase();
                const isDrop = action === 'drop' || action === 'deny' || action === 'reset';
                const isThreat = (log.type || '').toUpperCase() === 'THREAT';

                return (
                  <tr
                    key={log.id || idx}
                    onClick={() => setInspectingLog(log)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-3.5 py-2.5 text-slate-400">
                      <div className="flex items-center gap-2">
                        {logFeedMode === 'live' && idx === 0 && !hasCustomFilter && (
                          <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                          </span>
                        )}
                        <span>{log.event_time || log.time || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isThreat
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                          : isDrop
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isThreat ? 'bg-amber-400' : isDrop ? 'bg-rose-400' : 'bg-emerald-400'
                        }`} />
                        <span>{log.action}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-cyan-300 font-bold">{log.source_ip || log.src}</td>
                    <td className="px-3.5 py-2.5 text-slate-200">
                      {log.destination_ip || log.dst}:{log.destination_port || log.port}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-sans font-semibold">
                        {log.application_name || log.app || '-'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-300 max-w-xs truncate" title={log.rule_name || log.rule}>
                      {log.rule_name || log.rule || '-'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.severity === 'critical' || log.severity === 'high'
                          ? 'bg-rose-500/20 text-rose-300'
                          : log.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {log.severity || 'low'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-400">{log.country || '-'}</td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingLog(log);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400 text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm group/btn"
                        title="Buka Detail Log Lengkap"
                      >
                        <Eye size={12} className="text-cyan-400 group-hover/btn:scale-110 transition-transform" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rawLogs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-xs">
                    {logsQuery.isLoading ? 'Loading firewall logs...' : 'No firewall logs match the current filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
          <span>Showing page {page} ({rawLogs.length} entries)</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              Prev
            </button>
            <span className="px-2 font-bold text-cyan-300">{page}</span>
            <button
              type="button"
              disabled={rawLogs.length < 50}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {activeTab === 'vpn' && (
        <GlobalProtectVpnTelemetry
          telemetry={panels.globalprotect_telemetry}
          onSelectFilter={(f) => setActiveFilter(f)}
          activeFilter={activeFilter}
        />
      )}

      {activeTab === 'app-risk' && (
        <AppIdRiskMatrix
          data={panels.app_risk_matrix}
          onSelectFilter={(f) => setActiveFilter(f)}
          activeFilter={activeFilter}
        />
      )}
    </div>
  );
}

// KPI Metric Card Subcomponent
function KpiCard({ label, value, subtitle, color = 'slate', alert = false, onClick }: any) {
  const colorConfig: Record<string, { border: string; glow: string; text: string; topBar: string; dot: string }> = {
    slate: {
      border: 'border-slate-800/80 hover:border-slate-700',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(148,163,184,0.1)]',
      text: 'text-slate-100',
      topBar: 'bg-slate-500/50',
      dot: 'bg-slate-400',
    },
    emerald: {
      border: 'border-emerald-500/25 hover:border-emerald-500/50',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(52,211,153,0.15)]',
      text: 'text-emerald-400',
      topBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      dot: 'bg-emerald-400',
    },
    rose: {
      border: 'border-rose-500/25 hover:border-rose-500/50',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(244,63,94,0.2)]',
      text: 'text-rose-400',
      topBar: 'bg-gradient-to-r from-rose-500 to-red-400',
      dot: 'bg-rose-400',
    },
    amber: {
      border: 'border-amber-500/25 hover:border-amber-500/50',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(245,158,11,0.2)]',
      text: 'text-amber-400',
      topBar: 'bg-gradient-to-r from-amber-500 to-orange-400',
      dot: 'bg-amber-400',
    },
    violet: {
      border: 'border-violet-500/25 hover:border-violet-500/40',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(139,92,246,0.15)]',
      text: 'text-violet-400',
      topBar: 'bg-gradient-to-r from-violet-500 to-purple-400',
      dot: 'bg-violet-400',
    },
    cyan: {
      border: 'border-cyan-500/25 hover:border-cyan-500/50',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(6,182,212,0.15)]',
      text: 'text-cyan-400',
      topBar: 'bg-gradient-to-r from-cyan-500 to-blue-400',
      dot: 'bg-cyan-400',
    },
    blue: {
      border: 'border-blue-500/25 hover:border-blue-500/50',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(59,130,246,0.15)]',
      text: 'text-blue-400',
      topBar: 'bg-gradient-to-r from-blue-500 to-cyan-400',
      dot: 'bg-blue-400',
    },
    teal: {
      border: 'border-teal-500/25 hover:border-teal-500/40',
      glow: 'group-hover:shadow-[0_8px_25px_-5px_rgba(20,184,166,0.15)]',
      text: 'text-teal-400',
      topBar: 'bg-gradient-to-r from-teal-500 to-emerald-400',
      dot: 'bg-teal-400',
    },
  };

  const cfg = colorConfig[color] || colorConfig.slate;

  return (
    <div
      onClick={onClick}
      className={`group relative p-3.5 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border backdrop-blur-md transition-all duration-300 ease-out flex flex-col justify-between min-w-0 overflow-hidden ${
        cfg.border
      } ${cfg.glow} ${
        onClick ? 'cursor-pointer hover:-translate-y-1 hover:bg-slate-800/50 active:scale-[0.98]' : ''
      }`}
    >
      {/* Top micro luminous bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${cfg.topBar} opacity-70 group-hover:opacity-100 transition-opacity`} />

      {/* Header row with micro dot */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate block font-sans">
          {label}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all`} />
      </div>

      {/* Main KPI Value */}
      <span className={`text-xl font-black font-mono tracking-tight my-1 truncate block ${
        alert ? 'text-rose-400 animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' : cfg.text
      }`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>

      {/* Subtitle / Context note */}
      <span className="text-[10px] text-slate-500 font-mono truncate block group-hover:text-slate-400 transition-colors">
        {subtitle}
      </span>
    </div>
  );
}

// List Drilldown Panel Subcomponent
function ListPanel({ title, subtitle, items, keyLabel, altKeyLabel, countLabel, color = 'cyan', onSelect }: any) {
  const badgeColors: Record<string, { badge: string; bar: string; text: string }> = {
    rose: {
      badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30 group-hover/row:border-rose-500/60 group-hover/row:bg-rose-500/20',
      bar: 'bg-rose-500/10',
      text: 'group-hover/row:text-rose-300',
    },
    amber: {
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30 group-hover/row:border-amber-500/60 group-hover/row:bg-amber-500/20',
      bar: 'bg-amber-500/10',
      text: 'group-hover/row:text-amber-300',
    },
    cyan: {
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 group-hover/row:border-cyan-500/60 group-hover/row:bg-cyan-500/20',
      bar: 'bg-cyan-500/10',
      text: 'group-hover/row:text-cyan-300',
    },
    violet: {
      badge: 'bg-violet-500/10 text-violet-300 border-violet-500/30 group-hover/row:border-violet-500/60 group-hover/row:bg-violet-500/20',
      bar: 'bg-violet-500/10',
      text: 'group-hover/row:text-violet-300',
    },
  };

  const theme = badgeColors[color] || badgeColors.cyan;
  const maxCount = Math.max(...items.map((i: any) => Number(i[countLabel] || i.count || i.value || 1)), 1);

  return (
    <div className="relative p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 hover:border-slate-700 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-3 transition-all duration-300 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent pointer-events-none" />

      <div className="border-b border-slate-800/80 pb-2.5">
        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Top {items.length}</span>
        </h4>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{subtitle}</p>
      </div>

      <div className="space-y-1.5 flex-1 overflow-y-auto max-h-52 pr-1 custom-scrollbar">
        {items.map((item: any, idx: number) => {
          const val = item[keyLabel] || item[altKeyLabel] || item.label || 'Unknown';
          const count = Number(item[countLabel] || item.count || item.value || 1);
          const percent = Math.min(Math.round((count / maxCount) * 100), 100);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect && onSelect(val)}
              className="relative w-full p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-center justify-between text-xs font-mono text-left cursor-pointer group/row overflow-hidden"
            >
              <div
                className={`absolute left-0 top-0 bottom-0 ${theme.bar} transition-all duration-500 pointer-events-none rounded-l-xl`}
                style={{ width: `${percent}%` }}
              />

              <div className="relative z-10 flex items-center gap-2 truncate max-w-[150px]">
                <span className="text-[10px] text-slate-500 font-bold w-4 text-center">{idx + 1}</span>
                <span className={`truncate text-slate-300 ${theme.text} transition-colors font-medium`} title={val}>
                  {val}
                </span>
              </div>
              <div className="relative z-10 flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border font-mono transition-all ${theme.badge}`}>
                  {count.toLocaleString()}
                </span>
                <ChevronRight size={11} className="text-slate-600 group-hover/row:text-slate-300 group-hover/row:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="text-center text-slate-500 text-xs py-6 font-mono">No telemetry in this range</p>
        )}
      </div>
    </div>
  );
}

// Draggable Log Inspector Modal
function LogInspectorModal({
  log,
  copiedText,
  onCopy,
  onClose,
  onFilterByIp,
  onFilterByRule,
}: {
  log: any;
  copiedText: string | null;
  onCopy: (txt: string) => void;
  onClose: () => void;
  onFilterByIp: (ip: string) => void;
  onFilterByRule: (rule: string) => void;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-rose-500/10 border-rose-500/30 text-rose-400">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Firewall Log Inspector</span>
                  <span className="text-xs font-mono font-normal text-slate-400">
                    #{log.id || 'EVT'}
                  </span>
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
                <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
                  ESC to close
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Palo Alto Syslog Event details &amp; perimeter security forensic telemetry.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            <button
              type="button"
              onClick={() => onCopy(JSON.stringify(log, null, 2))}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
              title="Copy complete log event JSON"
            >
              {copiedText === JSON.stringify(log, null, 2) ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span className="hidden sm:inline">Copy JSON</span>
                </>
              )}
            </button>
            {isMoved && (
              <button
                type="button"
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                title="Reset posisi ke tengah"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar font-mono text-xs">
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Action</span>
              <span className={`font-bold mt-1 block uppercase ${
                log.action === 'allow' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {log.action}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Application</span>
              <span className="font-bold text-amber-300 mt-1 truncate block">
                {log.application_name || log.app || '-'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Severity</span>
              <span className="font-bold text-slate-200 mt-1 uppercase block">
                {log.severity || 'low'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Bytes</span>
              <span className="font-bold text-cyan-300 mt-1 block">
                {Number(log.total_bytes || 0).toLocaleString()} B
              </span>
            </div>
          </div>

          {/* Connection Vector Grid */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-sans">
              Connection Vector &amp; Security Policy
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 block">Source IP:</span>
                <span className="text-cyan-300 font-bold block">{log.source_ip || log.src}</span>
                <span className="text-[10px] text-slate-500">Zone: {log.from_zone || 'Unknown'} &middot; Country: {log.country || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Destination:</span>
                <span className="text-slate-200 font-bold block">{log.destination_ip || log.dst}:{log.destination_port || log.port}</span>
                <span className="text-[10px] text-slate-500">Zone: {log.to_zone || 'Unknown'} &middot; NAT: {log.nat_rule_name || 'None'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Security Policy Rule:</span>
                <span className="text-slate-300 block font-semibold">{log.rule_name || log.rule || 'None'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">TCP Flags / Session End:</span>
                <span className="text-slate-300 block">{log.tcp_flags || 'N/A'} (Reason: {log.session_end_reason || 'Normal'})</span>
              </div>
            </div>
          </div>

          {/* Threat Intelligence & MITRE Card (If Threat Event) */}
          {(log.threat_name || log.threat === 1 || String(log.type).toUpperCase() === 'THREAT') && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <ShieldAlert size={14} className="text-rose-400" />
                  <span>Threat Signature &amp; MITRE ATT&CK® Correlation</span>
                </span>
                {log.cve && (
                  <a
                    href={cveLink(log.cve)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/30 transition-colors"
                  >
                    <span>{log.cve}</span>
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Signature:</span>
                  <span className="text-slate-100 font-bold block">{log.threat_name || 'Vulnerability Detection'}</span>
                  {log.threat_id && <span className="text-[10px] text-slate-500">Threat ID: {log.threat_id}</span>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">MITRE Tactic &amp; Technique:</span>
                  <span className="text-cyan-300 font-bold block">
                    {log.mitre_technique_id ? `[${log.mitre_technique_id}] ${log.mitre_technique_name || ''}` : 'T1190 Exploit Public-Facing App'}
                  </span>
                  <span className="text-[10px] text-slate-500">Tactic: {log.mitre_tactic_name || 'Initial Access'} ({log.mitre_tactic_id || 'TA0001'})</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Threat Intel Pivot Links */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
              External Threat Intelligence Pivots ({log.source_ip || log.src}):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {ipIntelLinks(log.source_ip || log.src || '').map((ti) => (
                <a
                  key={ti.name}
                  href={ti.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                >
                  <span>{ti.name}</span>
                  <ExternalLink size={10} className="text-slate-500" />
                </a>
              ))}
            </div>
          </div>

          {/* Raw Message Log */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-400 font-sans uppercase">Raw Syslog Payload:</span>
              <button
                type="button"
                onClick={() => onCopy(log.message || '')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedText === log.message ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Raw</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-300 whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
              {log.message || 'No raw message available.'}
            </pre>
          </div>
        </div>

        {/* Footer with Pivot Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFilterByIp(log.source_ip || log.src)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
            >
              Filter Source IP
            </button>
            {log.rule_name && (
              <button
                type="button"
                onClick={() => onFilterByRule(log.rule_name)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Filter Rule
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
