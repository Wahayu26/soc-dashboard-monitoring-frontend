'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Database, 
  Activity, 
  Server, 
  AlertCircle, 
  Clock, 
  Zap, 
  ShieldAlert, 
  Terminal, 
  Users, 
  CheckCircle2, 
  Copy, 
  Check, 
  ZapOff, 
  Loader2, 
  Eye, 
  X, 
  HardDrive,
  Search,
  Sparkles,
  PieChart,
  Layers,
  Crown,
  FileWarning,
  Flame,
  GripHorizontal,
  RotateCcw,
  Move,
  Lock,
  ShieldCheck,
  ChevronRight,
  Gauge,
  TrendingUp,
  Shield,
  Award,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Calendar,
  Bell,
  Send
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export function DbDashboard() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d' | 'custom'>('1h');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 16),
    end: new Date().toISOString().slice(0, 16),
  });
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [refreshRate, setRefreshRate] = useState<number | false>(5000);
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);
  const [confirmKillPid, setConfirmKillPid] = useState<number | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [inspectingQuery, setInspectingQuery] = useState<{ server: string; query: any } | null>(null);
  const [storageServer, setStorageServer] = useState<string | null>(null);
  const [locksServer, setLocksServer] = useState<string | null>(null);
  const [digestServer, setDigestServer] = useState<string | null>(null);
  const [digestSort, setDigestSort] = useState<'total_time' | 'exec_count' | 'avg_time' | 'reads'>('total_time');
  const [auditServer, setAuditServer] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // EXPLAIN State
  const [explainData, setExplainData] = useState<any[] | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const metrics = useQuery({
    queryKey: ['db-metrics'],
    queryFn: async () => (await api.get('/db-monitor?action=metrics')).data,
    refetchInterval: refreshRate,
  });

  const history = useQuery({
    queryKey: ['db-history', timeRange, timeRange === 'custom' ? `${customRange.start}_${customRange.end}` : ''],
    queryFn: async () => {
      const url = timeRange === 'custom'
        ? `/db-monitor?action=history&range=custom&start=${encodeURIComponent(customRange.start)}&end=${encodeURIComponent(customRange.end)}`
        : `/db-monitor?action=history&range=${timeRange}`;
      return (await api.get(url)).data;
    },
    placeholderData: (prev) => prev,
    refetchInterval: refreshRate ? 30000 : false,
  });

  const handleManualSync = async () => {
    await Promise.all([
      metrics.refetch(),
      history.refetch(),
    ]);
  };

  // Storage footprint query
  const storageQuery = useQuery({
    queryKey: ['db-storage', storageServer],
    queryFn: async () => {
      if (!storageServer) return null;
      return (await api.get(`/db-monitor?action=storage&server=${storageServer}`)).data;
    },
    enabled: !!storageServer,
    staleTime: 60000,
  });

  // Lock waits query
  const locksQuery = useQuery({
    queryKey: ['db-locks', locksServer],
    queryFn: async () => {
      if (!locksServer) return null;
      return (await api.get(`/db-monitor?action=locks&server=${locksServer}`)).data;
    },
    enabled: !!locksServer,
    refetchInterval: 3000,
  });

  // Query performance digest query (Opsi 2)
  const digestQuery = useQuery({
    queryKey: ['db-digest', digestServer, digestSort],
    queryFn: async () => {
      if (!digestServer) return null;
      return (await api.get(`/db-monitor?action=digest&server=${digestServer}&sort=${digestSort}`)).data;
    },
    enabled: !!digestServer,
  });

  // SOC Security & Configuration Audit query (Opsi 3)
  const auditQuery = useQuery({
    queryKey: ['db-audit', auditServer],
    queryFn: async () => {
      if (!auditServer) return null;
      return (await api.get(`/db-monitor?action=audit&server=${auditServer}`)).data;
    },
    enabled: !!auditServer,
  });

  const servers = (metrics.data?.servers || {}) as Record<string, any>;
  const histServers = (history.data?.history || history.data?.servers || {}) as Record<string, any>;

  // Fleet Summary KPI calculation
  const serverList = Object.entries(servers);
  const totalServers = serverList.length;
  const onlineServers = serverList.filter(([_, d]) => !d.error).length;
  const totalQps = serverList.reduce((acc, [_, d]) => acc + (!d.error ? Number(d.qps || 0) : 0), 0);
  const totalConn = serverList.reduce((acc, [_, d]) => acc + (!d.error ? Number(d.conn || 0) : 0), 0);
  const totalMaxConn = serverList.reduce((acc, [_, d]) => acc + (!d.error ? Number(d.max_conn || 0) : 0), 0);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuery(text);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const handleDownloadCsv = async (type: 'fleet_csv' | 'audit_csv' | 'digest_csv') => {
    try {
      setIsExporting(type);
      const res = await api.get(`/db-monitor?action=export&type=${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const filenames: Record<string, string> = {
        fleet_csv: `soc_db_fleet_metrics_${new Date().toISOString().slice(0, 10)}.csv`,
        audit_csv: `soc_db_security_audit_${new Date().toISOString().slice(0, 10)}.csv`,
        digest_csv: `soc_db_heavy_queries_${new Date().toISOString().slice(0, 10)}.csv`,
      };
      link.setAttribute('download', filenames[type] || 'db_report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export CSV', err);
      alert('Failed to download CSV report file.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleOpenPdfReport = () => {
    window.open('/db/report', '_blank');
  };

  const handleKill = async (server: string, pid: number) => {
    setKillingPid(pid);
    try {
      const res = await api.post('/db-monitor?action=kill', { db: server, pid });
      if (res.data?.ok) {
        setNotification({
          message: `Query PID ${pid} on server ${server} successfully terminated.`,
          type: 'success'
        });
        setConfirmKillPid(null);
        if (inspectingQuery?.query?.Id === pid) {
          setInspectingQuery(null);
        }
        await queryClient.invalidateQueries({ queryKey: ['db-metrics'] });
      } else {
        setNotification({
          message: res.data?.error || `Failed to terminate query PID ${pid}.`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setNotification({
        message: err?.response?.data?.error || `Failed to terminate query PID ${pid}.`,
        type: 'error'
      });
    } finally {
      setKillingPid(null);
      setTimeout(() => setNotification(null), 6000);
    }
  };

  const handleRunExplain = async () => {
    if (!inspectingQuery) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplainData(null);
    try {
      const res = await api.post('/db-monitor?action=explain', {
        db: inspectingQuery.server,
        db_name: inspectingQuery.query.db || '',
        sql: inspectingQuery.query.QueryString,
      });

      if (res.data?.ok) {
        if (res.data?.skipped) {
          setExplainError(res.data?.message || 'Analyzer skipped for this query pattern.');
        } else {
          setExplainData(res.data?.data || []);
        }
      } else {
        setExplainError(res.data?.error || 'Failed to execute EXPLAIN query analysis.');
      }
    } catch (err: any) {
      setExplainError(err?.response?.data?.error || err.message || 'Failed to analyze query.');
    } finally {
      setExplainLoading(false);
    }
  };

  const openInspector = (server: string, query: any) => {
    setInspectingQuery({ server, query });
    setExplainData(null);
    setExplainError(null);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-3 fade-in duration-300 max-w-md">
          <div className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
            notification.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50' 
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {notification.message}
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Storage Footprint Modal (Fitur 2) */}
      {storageServer && (
        <StorageModal 
          serverName={storageServer} 
          data={storageQuery.data} 
          isLoading={storageQuery.isLoading} 
          onClose={() => setStorageServer(null)} 
        />
      )}

      {/* Lock Waits & Blocker Tree Modal (Fitur 1) */}
      {locksServer && (
        <LockInspectorModal
          serverName={locksServer}
          data={locksQuery.data}
          isLoading={locksQuery.isLoading}
          onClose={() => setLocksServer(null)}
          onKill={(server, pid) => handleKill(server, pid)}
          killingPid={killingPid}
        />
      )}

      {/* Query Performance Digest & Profiler Modal (Opsi 2) */}
      {digestServer && (
        <QueryDigestModal
          serverName={digestServer}
          data={digestQuery.data}
          isLoading={digestQuery.isLoading}
          sortBy={digestSort}
          onSortChange={setDigestSort}
          onClose={() => setDigestServer(null)}
          onInspectQuery={(sql) => {
            setDigestServer(null);
            openInspector(digestServer, {
              Id: Math.floor(Math.random() * 900000) + 100000,
              User: 'profiler',
              db: 'production',
              Time: 0,
              State: 'Digest Profile',
              QueryString: sql,
            });
          }}
          onCopy={handleCopy}
          copiedQuery={copiedQuery}
        />
      )}

      {/* SOC Security & Configuration Audit Scorecard Modal (Opsi 3) */}
      {auditServer && (
        <SecurityAuditModal
          serverName={auditServer}
          data={auditQuery.data}
          isLoading={auditQuery.isLoading}
          onClose={() => setAuditServer(null)}
        />
      )}

      {/* Export Report & Datasets Modal (Opsi 4) */}
      {exportModalOpen && (
        <ExportReportModal
          onClose={() => setExportModalOpen(false)}
          onDownloadCsv={handleDownloadCsv}
          onOpenPdfReport={handleOpenPdfReport}
          isExporting={isExporting}
        />
      )}

      {/* Custom Date-Time Range Picker Modal */}
      {customModalOpen && (
        <CustomDateRangeModal
          initialStart={customRange.start}
          initialEnd={customRange.end}
          onClose={() => setCustomModalOpen(false)}
          onApply={(start, end) => {
            setCustomRange({ start, end });
            setTimeRange('custom');
            setCustomModalOpen(false);
          }}
        />
      )}

      {/* Telegram Alert Notification & Test Modal */}
      {telegramModalOpen && (
        <TelegramAlertModal
          onClose={() => setTelegramModalOpen(false)}
        />
      )}

      {/* Inspect Query & EXPLAIN Modal (Fitur 1) */}
      {inspectingQuery && (
        <InspectQueryModal
          inspectingQuery={inspectingQuery}
          explainData={explainData}
          explainLoading={explainLoading}
          explainError={explainError}
          copiedQuery={copiedQuery}
          confirmKillPid={confirmKillPid}
          killingPid={killingPid}
          onClose={() => setInspectingQuery(null)}
          onCopy={handleCopy}
          onRunExplain={handleRunExplain}
          onKill={handleKill}
          onConfirmKillPid={setConfirmKillPid}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500">
                Database Fleet Monitor
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">Real-time performance, query throughput, security telemetry, and storage footprint.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time range switcher */}
          <div className="flex items-center bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
            {(['1h', '24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeRange === r
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setCustomModalOpen(true)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                timeRange === 'custom'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Select custom date & time range"
            >
              <Calendar size={12} />
              <span>CUSTOM</span>
            </button>
          </div>

          {/* Active Custom Range Chip */}
          {timeRange === 'custom' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono animate-in fade-in duration-200">
              <span>{customRange.start.slice(5, 16)} ➔ {customRange.end.slice(5, 16)}</span>
              <button
                onClick={() => setTimeRange('1h')}
                className="hover:text-white p-0.5 rounded hover:bg-cyan-500/20"
                title="Reset to 1 hour"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Auto-Refresh Rate Switcher */}
          <div className="flex items-center bg-slate-900/60 p-1 border border-slate-800 rounded-xl text-xs font-mono">
            <span className="text-[10px] text-slate-500 font-bold px-2 hidden sm:inline uppercase">Rate:</span>
            {[
              { label: '5s', value: 5000 },
              { label: '15s', value: 15000 },
              { label: '30s', value: 30000 },
              { label: 'Pause', value: false },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setRefreshRate(opt.value as any)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  refreshRate === opt.value
                    ? opt.value === false
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={opt.value === false ? 'Pause auto-refresh polling' : `Refresh every ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Live Sync Status & Manual Sync Button */}
          <div className="flex items-center gap-1.5">
            <div className={`px-3 py-1.5 bg-slate-900/60 border rounded-xl flex items-center gap-2 ${
              refreshRate === false 
                ? 'border-amber-500/30 text-amber-300' 
                : 'border-slate-800 text-slate-300'
            }`}>
              {refreshRate === false ? (
                <>
                  <Pause size={12} className="text-amber-400" />
                  <span className="text-xs font-mono font-bold text-amber-400">PAUSED</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    {metrics.isFetching ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </>
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </>
                    )}
                  </span>
                  <span className="text-xs font-mono font-bold">
                    {metrics.isFetching ? 'SYNCING' : 'LIVE'}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={handleManualSync}
              className="p-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 rounded-xl transition-all cursor-pointer"
              title="Manual Sync Telemetry Now"
            >
              <RefreshCw size={13} className={metrics.isFetching ? 'animate-spin text-cyan-400' : ''} />
            </button>
          </div>

          {/* Telegram Alerts Button */}
          <button
            onClick={() => setTelegramModalOpen(true)}
            className="px-3 py-1.5 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 rounded-xl flex items-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer"
            title="Configure and test Telegram bot alert notifications"
          >
            <Bell size={13} className="text-cyan-400" />
            <span className="hidden xl:inline">Telegram Alerts</span>
          </button>

          {/* Export Report Button (Opsi 4) */}
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600 hover:to-blue-600 text-cyan-200 hover:text-white border border-cyan-500/40 rounded-xl flex items-center gap-1.5 text-xs font-mono font-bold transition-all shadow-sm shadow-cyan-950/60 cursor-pointer"
            title="Export SOC Audit Report (PDF) and tabular CSV data"
          >
            <FileText size={13} className="text-cyan-400" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Fleet Overview KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
            <Server size={13} className="text-cyan-400" />
            Monitored Fleet
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100">{totalServers}</span>
            <span className="text-xs font-medium text-slate-400">Instances</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
            <Activity size={13} className="text-emerald-400" />
            Active Fleet Status
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{onlineServers}</span>
            <span className="text-xs font-medium text-slate-400">/ {totalServers} Online</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
            <Zap size={13} className="text-amber-400" />
            Fleet Throughput
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">{totalQps.toFixed(1)}</span>
            <span className="text-xs font-medium text-slate-400">Queries / sec</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
            <HardDrive size={13} className="text-violet-400" />
            Fleet Connections
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-violet-300">{totalConn}</span>
            <span className="text-xs font-medium text-slate-400">/ {totalMaxConn || totalConn} Active</span>
          </div>
        </div>
      </div>

      {metrics.isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Activity size={32} className="text-cyan-500 animate-pulse" />
          <p className="text-slate-400 font-mono text-sm animate-pulse">CONNECTING TO DATABASE INSTANCES...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {Object.entries(servers).map(([name, data]: [string, any]) => {
            const rawHist = histServers[name];
            const serverHistory = Array.isArray(rawHist) ? rawHist : (rawHist?.series || []);
            return (
              <DbServerCard 
                key={name} 
                name={name} 
                data={data} 
                history={serverHistory}
                timeRange={timeRange}
                isFetchingHistory={history.isFetching}
                copiedQuery={copiedQuery}
                onCopy={handleCopy}
                killingPid={killingPid}
                confirmKillPid={confirmKillPid}
                onConfirmKill={setConfirmKillPid}
                onExecuteKill={handleKill}
                onInspect={(q) => openInspector(name, q)}
                onOpenStorage={() => setStorageServer(name)}
                onOpenLocks={() => setLocksServer(name)}
                onOpenDigest={() => setDigestServer(name)}
                onOpenAudit={() => setAuditServer(name)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DbServerCard({ 
  name, 
  data, 
  history, 
  timeRange, 
  isFetchingHistory,
  copiedQuery, 
  onCopy,
  killingPid,
  confirmKillPid,
  onConfirmKill,
  onExecuteKill,
  onInspect,
  onOpenStorage,
  onOpenLocks,
  onOpenDigest,
  onOpenAudit
}: { 
  name: string; 
  data: any; 
  history: any[]; 
  timeRange: string;
  isFetchingHistory?: boolean;
  copiedQuery: string | null;
  onCopy: (q: string) => void;
  killingPid: number | null;
  confirmKillPid: number | null;
  onConfirmKill: (pid: number | null) => void;
  onExecuteKill: (server: string, pid: number) => void;
  onInspect: (q: any) => void;
  onOpenStorage: () => void;
  onOpenLocks: () => void;
  onOpenDigest: () => void;
  onOpenAudit: () => void;
}) {
  const isError = !!data.error;
  const isAccessDenied = isError && String(data.msg || '').includes('Access denied');
  const isDriverMissing = isError && (String(data.msg || '').includes('could not find driver') || String(data.msg || '').includes('requires the Microsoft ODBC Driver'));

  // Fitur 3: Brute Force & Auth Anomaly Alert Detection
  const failedAuths = Number(data.aborted_connects || 0);
  const isAuthAnomaly = failedAuths >= 10;

  // Table Search and Threshold Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [threshold, setThreshold] = useState<number>(3);

  // Filter queries based on search term and threshold
  const rawQan = (data.qan || []) as any[];
  const filteredQan = rawQan.filter((q) => {
    if (q.Time < threshold) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(q.User || '').toLowerCase().includes(term) ||
      String(q.db || '').toLowerCase().includes(term) ||
      String(q.QueryString || '').toLowerCase().includes(term) ||
      String(q.Id || '').includes(term)
    );
  });

  return (
    <div className="relative group bg-slate-900/40 backdrop-blur-md border border-slate-800/60 rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)] flex flex-col justify-between">
      <div 
        className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none transition-all duration-700 ${
          isError ? 'bg-rose-500/10 group-hover:bg-rose-500/20' : 'bg-cyan-500/5 group-hover:bg-cyan-500/15'
        }`} 
      />

      <div className="relative z-10 flex flex-col h-full space-y-6">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              isError 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400'
            }`}>
              <Database size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-100 truncate">{name}</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  !isError 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${!isError ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {!isError ? 'ONLINE' : (isAccessDenied ? 'AUTH ERROR' : 'OFFLINE')}
                </span>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {data.type || 'DB'} &middot; {data.host ? `${data.host}:${data.port || (data.type === 'mssql' ? 1433 : 3306)}` : ''}
                </span>
              </div>

              {/* Action Buttons Row */}
              {!isError && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <button
                    onClick={onOpenStorage}
                    className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-mono border border-slate-700/60 inline-flex items-center gap-1 transition-all cursor-pointer"
                    title="Inspect database storage allocation & largest tables"
                  >
                    <HardDrive size={10} className="text-cyan-400" />
                    <span>Storage</span>
                  </button>

                  <button
                    onClick={onOpenLocks}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono border inline-flex items-center gap-1 transition-all cursor-pointer ${
                      (data.lock_wait_count || 0) > 0 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-bold shadow-sm shadow-rose-950/60' 
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border-slate-700/60'
                    }`}
                    title="Inspect active transaction locks & root blocker tree"
                  >
                    <Lock size={10} className={(data.lock_wait_count || 0) > 0 ? "text-rose-400" : "text-amber-400"} />
                    <span>Locks{(data.lock_wait_count || 0) > 0 ? ` (${data.lock_wait_count})` : ''}</span>
                  </button>

                  <button
                    onClick={onOpenDigest}
                    className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-violet-300 text-[10px] font-mono border border-slate-700/60 inline-flex items-center gap-1 transition-all cursor-pointer"
                    title="Inspect historical heavy query digest & execution statistics"
                  >
                    <Gauge size={10} className="text-violet-400" />
                    <span>Profiler</span>
                  </button>

                  <button
                    onClick={onOpenAudit}
                    className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 text-[10px] font-mono border border-slate-700/60 inline-flex items-center gap-1 transition-all cursor-pointer"
                    title="Audit SOC Security & Configuration Health Scorecard"
                  >
                    <ShieldCheck size={10} className="text-emerald-400" />
                    <span>Audit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {!isError && (
            <div className="shrink-0 text-right pl-3 py-1.5 px-3 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-inner min-w-fit">
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-slate-200 font-mono tracking-tight whitespace-nowrap leading-none">
                {data.qps !== undefined ? Number(data.qps).toFixed(1) : '0.0'}
              </div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-1 whitespace-nowrap">
                Queries / sec
              </div>
            </div>
          )}
        </div>

        {/* SOC Security Alert: Brute Force / Auth Failure Spike */}
        {!isError && isAuthAnomaly && (
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Flame size={15} className="text-amber-400 animate-pulse shrink-0" />
              <span>
                <strong className="text-amber-400">SOC Threat Telemetry:</strong> Detected {failedAuths} authentication failures (Auth Failures). Monitor for potential brute-force or unauthorized access attempts.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono shrink-0 ml-2">
              AUTH SPIKE
            </span>
          </div>
        )}

        {/* Lock Contention Active Alert Banner */}
        {!isError && (data.lock_wait_count || 0) > 0 && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-rose-400 shrink-0 animate-bounce" />
              <span>
                <b>Active Lock Contention:</b> Detected <b>{data.lock_wait_count} {data.lock_wait_count === 1 ? 'query' : 'queries'}</b> blocked by lock wait!
              </span>
            </div>
            <button
              onClick={onOpenLocks}
              className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white border border-rose-500/40 text-[10px] font-bold font-mono inline-flex items-center gap-1 transition-all shadow-md shadow-rose-950/60 shrink-0 cursor-pointer"
            >
              <span>Inspect Blocker Tree</span>
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        {/* Detailed Error Diagnostic Banner */}
        {isError && (
          <div className="bg-rose-950/25 border border-rose-500/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-rose-300 break-words leading-relaxed">
                  {data.msg || 'Database connection unreachable'}
                </p>
                {isAccessDenied && (
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-amber-500/20 text-xs text-amber-200/90 space-y-1 font-sans">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5">
                      <span>💡 Access Whitelist Required:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      Server <code className="text-cyan-300 font-mono">{data.host}</code> denied access for <code className="text-cyan-300 font-mono">root</code> from your client IP (<code className="text-amber-300 font-mono font-bold">10.19.0.131</code>). Grant SQL privileges on the target server to enable telemetry monitoring.
                    </p>
                  </div>
                )}
                {isDriverMissing && (
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-amber-500/20 text-xs text-amber-200/90 font-sans">
                    <p className="text-[11px] text-slate-300 leading-normal">
                      💡 MSSQL connector driver is syncing. Ensure the <code className="text-cyan-300 font-mono">php artisan serve</code> terminal is restarted to load the required driver extension.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 5 Stat Boxes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatBox 
            icon={<Server size={13}/>} 
            label="Active Conn" 
            value={data.conn || 0} 
            total={data.max_conn || data.threads || 0} 
            color="cyan" 
          />
          <StatBox 
            icon={<ShieldAlert size={13}/>} 
            label="Auth Fails" 
            value={data.aborted_connects || 0} 
            color={Number(data.aborted_connects) >= 10 ? "rose" : (Number(data.aborted_connects) > 0 ? "amber" : "emerald")} 
          />
          <StatBox 
            icon={<AlertCircle size={13}/>} 
            label="Slow Queries" 
            value={data.slow || 0} 
            color={Number(data.slow) > 0 ? "rose" : "blue"} 
          />
          <StatBox 
            icon={<Zap size={13}/>} 
            label="Deadlocks" 
            value={data.lock_waits || 0} 
            color={Number(data.lock_waits) > 0 ? "amber" : "blue"} 
          />
          <StatBox 
            icon={<Activity size={13}/>} 
            label="Threads" 
            value={data.running || 0} 
            total={data.threads || 0} 
            color="violet" 
          />
        </div>

        {/* Throughput History Chart */}
        <div className="flex-1 mt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={12} className="text-cyan-400" />
              Throughput History ({timeRange.toUpperCase()})
            </p>
            <div className="flex items-center gap-2">
              {isFetchingHistory && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  <Loader2 size={10} className="animate-spin" />
                  <span className="hidden sm:inline">syncing...</span>
                </span>
              )}
              {history.length > 0 && (
                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                  {history.length} samples
                </span>
              )}
            </div>
          </div>

          <div className="h-[140px] w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`colorQps_${name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.4} />
                  <XAxis 
                    dataKey="t" 
                    tickFormatter={(t: string) => {
                      if (timeRange === '30d' || timeRange === '7d') {
                        const parts = t.split(' ');
                        if (parts[0]) {
                          const dateParts = parts[0].split('-');
                          if (dateParts.length === 3) {
                            return `${dateParts[2]}/${dateParts[1]}`;
                          }
                        }
                        return t;
                      }
                      return t.split(' ')[1] || t;
                    }}
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    minTickGap={25}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: number) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toString()}
                    width={35}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#090d16', 
                      borderColor: '#1e293b', 
                      borderRadius: '8px', 
                      fontSize: '11px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#22d3ee', fontWeight: 600 }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '2px', fontFamily: 'monospace' }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)} QPS`, 'Throughput']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="qps" 
                    stroke="#22d3ee" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill={`url(#colorQps_${name})`} 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center border border-dashed border-slate-800/80 rounded-xl text-slate-500 text-xs font-medium">
                {isError ? 'Historical telemetry unavailable (Instance offline)' : 'Collecting historical throughput data...'}
              </div>
            )}
          </div>
        </div>

        {/* Live Query Analytics (QAN / Slow Queries) */}
        <div className="mt-4 pt-4 border-t border-slate-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal size={12} className="text-cyan-400" />
              Active Slowest Running Queries
            </p>

            {!isError && rawQan.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Search query box */}
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search query / user..."
                    className="pl-7 pr-2.5 py-1 text-[11px] bg-slate-950/80 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-36 sm:w-44"
                  />
                </div>

                {/* Threshold switcher */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
                  {[1, 3, 5, 10].map((t) => (
                    <button
                      key={t}
                      onClick={() => setThreshold(t)}
                      className={`px-1.5 py-0.5 rounded transition-all ${
                        threshold === t 
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={`Filter queries ≥ ${t}s`}
                    >
                      &ge;{t}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isError ? (
            <div className="py-3 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/20 text-center text-xs text-slate-500">
              Query telemetry paused while database instance is unreachable
            </div>
          ) : filteredQan.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/40 relative max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold sticky top-0 z-20 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 border-b border-slate-800/60 font-mono">PID</th>
                    <th className="px-3 py-2 border-b border-slate-800/60">User / DB</th>
                    <th className="px-3 py-2 border-b border-slate-800/60">Duration</th>
                    <th className="px-3 py-2 border-b border-slate-800/60 min-w-[200px]">SQL Statement</th>
                    <th className="px-3 py-2 border-b border-slate-800/60 text-right sticky right-0 bg-slate-900 z-30 shadow-[-8px_0_12px_rgba(0,0,0,0.4)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredQan.map((q: any) => {
                    const risk = detectQueryRisk(q.QueryString);
                    const isPriv = isPrivilegedUser(q.User);

                    return (
                      <tr key={q.Id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2 font-mono text-slate-400">{q.Id}</td>
                        <td className="px-3 py-2 font-medium text-cyan-300">
                          <div className="flex items-center gap-1.5">
                            {isPriv ? (
                              <span title="Privileged Superuser">
                                <Crown size={12} className="text-amber-400" />
                              </span>
                            ) : (
                              <Users size={12} className="opacity-60" />
                            )}
                            <span className={isPriv ? 'text-amber-300 font-bold' : ''}>{q.User}</span>
                            {q.db && <span className="text-slate-500 font-mono text-[10px]">({q.db})</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                            q.Time > 10 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          }`}>
                            {q.Time}s
                          </span>
                        </td>
                        <td 
                          onClick={() => onInspect(q)}
                          className="px-3 py-2 text-slate-300 font-mono truncate max-w-xs sm:max-w-sm md:max-w-md cursor-pointer hover:text-cyan-300 transition-colors"
                          title="Click to inspect query & run EXPLAIN"
                        >
                          <div className="flex items-center gap-2">
                            {q.is_blocker && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 font-sans bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse flex items-center gap-1">
                                <Lock size={9} />
                                <span>BLOCKING {q.blocking_count}</span>
                              </span>
                            )}
                            {q.blocked_by && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 font-sans bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Lock size={9} />
                                <span>BLOCKED BY #{q.blocked_by}</span>
                              </span>
                            )}
                            {risk && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 font-sans ${risk.badgeClass}`}>
                                {risk.label}
                              </span>
                            )}
                            <span className="truncate">{q.QueryString}</span>
                          </div>
                        </td>

                        {/* Sticky Action Column on Right */}
                        <td className="px-3 py-2 text-right sticky right-0 bg-slate-900/95 z-10 backdrop-blur-sm border-l border-slate-800/60 shadow-[-8px_0_12px_rgba(0,0,0,0.4)]">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inspect / EXPLAIN Button */}
                            <button
                              onClick={() => onInspect(q)}
                              className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-mono transition-all"
                              title="Inspect full SQL & run EXPLAIN"
                            >
                              <Eye size={12} />
                            </button>

                            {/* Copy Button */}
                            <button
                              onClick={() => onCopy(q.QueryString)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono inline-flex items-center gap-1 transition-all"
                              title="Copy SQL query"
                            >
                              {copiedQuery === q.QueryString ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {/* Kill Query Action Button */}
                            {killingPid === q.Id ? (
                              <button
                                disabled
                                className="px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-mono inline-flex items-center gap-1 opacity-75"
                              >
                                <Loader2 size={11} className="animate-spin" />
                                <span>Killing...</span>
                              </button>
                            ) : confirmKillPid === q.Id ? (
                              <div className="flex items-center gap-1 animate-in zoom-in-95 duration-150">
                                <button
                                  onClick={() => onExecuteKill(name, q.Id)}
                                  className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] font-mono inline-flex items-center gap-1 transition-all shadow-lg shadow-rose-900/40 animate-pulse"
                                  title="Confirm Terminate Query"
                                >
                                  <ZapOff size={11} />
                                  <span>Confirm Kill</span>
                                </button>
                                <button
                                  onClick={() => onConfirmKill(null)}
                                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-all"
                                  title="Cancel"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => onConfirmKill(q.Id)}
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/20 text-[10px] font-mono inline-flex items-center gap-1 transition-all"
                                title="Terminate this query session (KILL QUERY)"
                              >
                                <ZapOff size={11} />
                                <span>Kill</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : rawQan.length > 0 && filteredQan.length === 0 ? (
            <div className="py-3 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/20 text-center text-xs text-slate-500">
              No active queries match filter ({searchTerm ? `"${searchTerm}"` : `≥ ${threshold}s`})
            </div>
          ) : (
            <div className="py-3 px-4 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 size={15} />
                <span>All queries operating normally (0 slow queries &ge; {threshold}s)</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400/90 uppercase px-2 py-0.5 rounded bg-emerald-500/10">
                OPTIMAL
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
    // Only primary left click
    if (e.button !== 0) return;

    // Do not initiate drag if user clicks buttons, inputs, links, or elements marked with data-no-drag
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

    // Prevent accidental text selection while dragging
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      // Soft boundary clamp so the modal header stays accessible
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
      title: 'Tahan & geser untuk memindahkan • Double-click untuk reset ke tengah',
    },
    modalStyle: {
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
  };
}

// Fitur 1: Inspect Query & EXPLAIN Modal (Draggable)
function InspectQueryModal({
  inspectingQuery,
  explainData,
  explainLoading,
  explainError,
  copiedQuery,
  confirmKillPid,
  killingPid,
  onClose,
  onCopy,
  onRunExplain,
  onKill,
  onConfirmKillPid,
}: {
  inspectingQuery: { server: string; query: any };
  explainData: any[] | null;
  explainLoading: boolean;
  explainError: string | null;
  copiedQuery: string | null;
  confirmKillPid: number | null;
  killingPid: number | null;
  onClose: () => void;
  onCopy: (sql: string) => void;
  onRunExplain: () => void;
  onKill: (server: string, pid: number) => void;
  onConfirmKillPid: (pid: number | null) => void;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
      <div 
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Draggable Header */}
        <div 
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <Terminal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Query Inspector &middot; PID {inspectingQuery.query.Id}
                </h4>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Instance: <span className="text-cyan-300 font-semibold">{inspectingQuery.server}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button 
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono"
                title="Reset posisi ke tengah (atau double-click header)"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 custom-scrollbar">
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">User</span>
              <span className="font-mono text-cyan-300 font-semibold flex items-center gap-1.5 mt-0.5">
                {inspectingQuery.query.User}
                {isPrivilegedUser(inspectingQuery.query.User) && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                    PRIVILEGED
                  </span>
                )}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Database</span>
              <span className="font-mono text-slate-300 font-semibold mt-0.5 block">{inspectingQuery.query.db || 'None'}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Duration</span>
              <span className={`font-mono font-bold mt-0.5 block ${
                inspectingQuery.query.Time > 10 ? 'text-rose-400' : 'text-amber-300'
              }`}>
                {inspectingQuery.query.Time}s
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Status</span>
              <span className="font-mono text-slate-400 truncate block mt-0.5">{inspectingQuery.query.State || 'Executing'}</span>
            </div>
          </div>

          {/* SQL Query Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>SQL Statement:</span>
              <button
                onClick={() => onCopy(inspectingQuery.query.QueryString)}
                className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-mono text-[11px] transition-colors"
              >
                {copiedQuery === inspectingQuery.query.QueryString ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied to clipboard</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
              {inspectingQuery.query.QueryString}
            </div>
            {inspectingQuery.query.QueryString?.includes('?') && (
              <p className="text-[11px] text-cyan-400/90 font-sans flex items-center gap-1.5 pt-0.5">
                <Sparkles size={12} className="text-cyan-400 shrink-0" />
                <span>Query menggunakan parameter placeholder (?). Analyzer otomatis menyuntikkan sample literal runtime saat mengevaluasi EXPLAIN.</span>
              </p>
            )}
          </div>

          {/* EXPLAIN Execution Plan Section */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Query Execution Plan (EXPLAIN)
                </span>
              </div>
              <button
                onClick={onRunExplain}
                disabled={explainLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {explainLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    <span>Run EXPLAIN Analyzer</span>
                  </>
                )}
              </button>
            </div>

            {explainError && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <div>{explainError}</div>
              </div>
            )}

            {explainData && explainData.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2 border-b border-slate-800 font-mono">Table</th>
                        <th className="px-3 py-2 border-b border-slate-800">Scan Type</th>
                        <th className="px-3 py-2 border-b border-slate-800 font-mono">Index (Key)</th>
                        <th className="px-3 py-2 border-b border-slate-800">Est. Rows</th>
                        <th className="px-3 py-2 border-b border-slate-800">Extra Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {explainData.map((row: any, idx: number) => {
                        const scanType = String(row.type || row.select_type || '').toUpperCase();
                        const isFullScan = scanType === 'ALL';
                        return (
                          <tr key={idx} className="hover:bg-slate-800/20">
                            <td className="px-3 py-2 text-cyan-300 font-bold">{row.table || row.PhysicalOp || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isFullScan 
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {isFullScan ? 'FULL TABLE SCAN (ALL)' : (row.type || 'INDEX')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              {row.key ? (
                                <span className="text-amber-300">{row.key}</span>
                              ) : (
                                <span className="text-rose-400 italic">None</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-300 font-semibold">
                              {row.rows ? Number(row.rows).toLocaleString() : (row.EstimateRows || '-')}
                            </td>
                            <td className="px-3 py-2 text-slate-400 text-[10px] max-w-xs truncate" title={row.Extra || ''}>
                              {row.Extra || row.Argument || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* DBA Optimization Insight */}
                {explainData.some((r: any) => String(r.type || '').toUpperCase() === 'ALL') && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                    <span>
                      <b>Full Table Scan detected:</b> This query scans all rows sequentially without an index. Consider adding indexes on the WHERE/JOIN clause columns to optimize execution latency.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {killingPid === inspectingQuery.query.Id ? (
              <button
                disabled
                className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold inline-flex items-center gap-2 opacity-75"
              >
                <Loader2 size={13} className="animate-spin" />
                <span>Terminating...</span>
              </button>
            ) : confirmKillPid === inspectingQuery.query.Id ? (
              <button
                onClick={() => onKill(inspectingQuery.server, inspectingQuery.query.Id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-lg shadow-rose-900/40 animate-pulse"
              >
                <ZapOff size={13} />
                <span>Confirm Terminate (KILL QUERY)</span>
              </button>
            ) : (
              <button
                onClick={() => onConfirmKillPid(inspectingQuery.query.Id)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 text-xs font-bold inline-flex items-center gap-2 transition-all"
              >
                <ZapOff size={13} />
                <span>Kill Query</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fitur 2: Storage Footprint & Largest Tables Modal Component (Draggable)
function StorageModal({ 
  serverName, 
  data, 
  isLoading, 
  onClose 
}: { 
  serverName: string; 
  data: any; 
  isLoading: boolean; 
  onClose: () => void; 
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const databases = (data?.databases || []) as any[];
  const topTables = (data?.top_tables || []) as any[];

  // Calculate totals
  const totalDbMb = databases.reduce((acc, db) => acc + Number(db.total_mb || 0), 0);
  const totalEstRows = databases.reduce((acc, db) => acc + Number(db.total_rows || 0), 0);

  const formatSize = (mb: number) => {
    if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div 
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div 
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <HardDrive size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Storage Footprint & Largest Tables
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Instance: <span className="text-cyan-300 font-bold">{serverName}</span> ({data?.type?.toUpperCase() || 'DB'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button 
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono"
                title="Reset posisi ke tengah (atau double-click header)"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="text-cyan-400 animate-spin" />
            <p className="text-slate-400 text-xs font-mono animate-pulse">Scanning database schemas & table sizes...</p>
          </div>
        ) : !data?.ok ? (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 text-xs">
            {data?.error || 'Failed to load database storage allocation telemetry.'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 custom-scrollbar">
            {/* Top Storage KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Allocated Size</span>
                <span className="text-xl font-black font-mono text-cyan-300">{formatSize(totalDbMb)}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Databases</span>
                <span className="text-xl font-black font-mono text-slate-100">{databases.length}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Est. Row Population</span>
                <span className="text-xl font-black font-mono text-violet-300">
                  {totalEstRows > 0 ? (totalEstRows >= 1000000 ? `${(totalEstRows/1000000).toFixed(1)}M` : totalEstRows.toLocaleString()) : 'N/A'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Top Heavy Database</span>
                <span className="text-sm font-bold font-mono text-amber-300 truncate block mt-0.5">
                  {databases[0]?.db_name || '-'}
                </span>
              </div>
            </div>

            {/* Section 1: Database Size Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart size={13} className="text-cyan-400" />
                Database Schema Footprint ({databases.length} Schemas)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {databases.map((db, idx) => {
                  const sizeMb = Number(db.total_mb || 0);
                  const maxMb = Number(databases[0]?.total_mb || 1);
                  const pct = (sizeMb / maxMb) * 100;
                  return (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-bold text-slate-200 truncate">{db.db_name}</span>
                        <span className="font-mono text-cyan-300 font-semibold text-[11px]">{formatSize(sizeMb)}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} />
                      </div>
                      {db.total_tables && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                          <span>{db.total_tables} tables</span>
                          <span>{db.total_rows ? `${Number(db.total_rows).toLocaleString()} rows` : ''}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Top Largest Tables (MySQL / MariaDB) */}
            {topTables.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={13} className="text-violet-400" />
                  Top Heaviest Tables by Disk Footprint
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="px-3.5 py-2.5 border-b border-slate-800 font-mono">Table Name</th>
                        <th className="px-3.5 py-2.5 border-b border-slate-800">Database</th>
                        <th className="px-3.5 py-2.5 border-b border-slate-800 font-mono">Total Size</th>
                        <th className="px-3.5 py-2.5 border-b border-slate-800">Data vs Index</th>
                        <th className="px-3.5 py-2.5 border-b border-slate-800 font-mono">Est. Rows</th>
                        <th className="px-3.5 py-2.5 border-b border-slate-800">Retention Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {topTables.map((t, idx) => {
                        const totalMb = Number(t.size_mb || 0);
                        const isBloated = totalMb >= 5000; // > 5 GB
                        return (
                          <tr key={idx} className="hover:bg-slate-800/20">
                            <td className="px-3.5 py-2 text-cyan-300 font-bold">{t.table_name}</td>
                            <td className="px-3.5 py-2 text-slate-400">{t.db_name}</td>
                            <td className="px-3.5 py-2 font-black text-slate-100">{formatSize(totalMb)}</td>
                            <td className="px-3.5 py-2 text-slate-400 text-[10px]">
                              Data: <span className="text-slate-300">{formatSize(Number(t.data_mb || 0))}</span> &middot; Index: <span className="text-slate-300">{formatSize(Number(t.index_mb || 0))}</span>
                            </td>
                            <td className="px-3.5 py-2 text-violet-300 font-semibold">
                              {Number(t.est_rows || 0).toLocaleString()}
                            </td>
                            <td className="px-3.5 py-2">
                              {isBloated ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 text-[10px] font-sans font-bold inline-flex items-center gap-1">
                                  <FileWarning size={11} />
                                  <span>Large Table &gt; 5GB</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-sans font-medium">
                                  Healthy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0 text-xs text-slate-500 font-mono">
          <span className="hidden sm:inline text-[11px]">
            Tip: Klik & tahan header untuk menggeser modal ke mana saja
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helpers for Fitur 3: SOC Security & Dangerous Query Detection
function isPrivilegedUser(user: string | null | undefined): boolean {
  if (!user) return false;
  const u = user.toLowerCase();
  return u === 'root' || u === 'sa' || u === 'administrator' || u.startsWith('root@');
}

function detectQueryRisk(sql: string | null | undefined): { label: string; badgeClass: string } | null {
  if (!sql) return null;
  const s = sql.trim().toUpperCase();

  if (/^(DROP|TRUNCATE|ALTER)\b/.test(s)) {
    return {
      label: 'DDL SCHEMA',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
    };
  }

  if (/^DELETE\b/.test(s)) {
    if (!s.includes('WHERE')) {
      return {
        label: 'CRITICAL DELETE ALL',
        badgeClass: 'bg-rose-600 text-white font-black animate-pulse'
      };
    }
    return {
      label: 'DELETE DML',
      badgeClass: 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
    };
  }

  if (/^UPDATE\b/.test(s)) {
    return {
      label: 'UPDATE DML',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
    };
  }

  if (/^INSERT\b/.test(s)) {
    return {
      label: 'WRITE INSERT',
      badgeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
    };
  }

  return null;
}

function StatBox({ 
  icon, 
  label, 
  value, 
  total, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  total?: string | number; 
  color: 'cyan' | 'violet' | 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const colors = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  const hasTotal = total !== undefined && total !== null && Number(total) > 0;
  const usage = hasTotal ? (Number(value) / Number(total)) * 100 : null;

  return (
    <div 
      className={`p-2 sm:p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all hover:scale-[1.02] min-w-0 ${colors[color]}`}
      title={label}
    >
      <div className="flex items-center gap-1 opacity-80 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-tight min-w-0 overflow-hidden">
        <span className="shrink-0">{icon}</span>
        <span className="truncate whitespace-nowrap leading-none" title={label}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1 font-mono min-w-0">
        <span className="text-base sm:text-lg font-black text-slate-100 truncate">{value}</span>
        {hasTotal && (
          <span className="text-[10px] font-semibold opacity-60 shrink-0">/{total}</span>
        )}
      </div>
      {usage !== null && (
        <div className="w-full bg-slate-900/60 h-1 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full bg-current transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, usage))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Fitur 1 (Roadmap): Lock Waits & Blocker Tree Inspector Modal (Draggable)
function LockInspectorModal({
  serverName,
  data,
  isLoading,
  onClose,
  onKill,
  killingPid,
}: {
  serverName: string;
  data: any;
  isLoading: boolean;
  onClose: () => void;
  onKill: (server: string, pid: number) => void;
  killingPid: number | null;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const [confirmKillBlockerPid, setConfirmKillBlockerPid] = useState<number | null>(null);

  const totalLockWaits = Number(data?.total_lock_waits || 0);
  const rootBlockers = (data?.root_blockers || []) as any[];
  const allBlockers = (data?.all_blockers || []) as any[];
  const rawWaits = (data?.raw_waits || []) as any[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div 
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div 
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              totalLockWaits > 0 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {totalLockWaits > 0 ? <Lock size={22} className="animate-pulse" /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Lock Waits & Blocker Tree Inspector
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
                {totalLockWaits > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 animate-pulse">
                    {totalLockWaits} ACTIVE CONTENTION
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30">
                    ALL CLEAR
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Instance: <span className="text-cyan-300 font-bold">{serverName}</span> ({data?.type?.toUpperCase() || 'DB'})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button 
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono"
                title="Reset posisi ke tengah (atau double-click header)"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="text-amber-400 animate-spin" />
            <p className="text-slate-400 text-xs font-mono animate-pulse">Scanning active transaction locks & dependency trees...</p>
          </div>
        ) : !data?.ok ? (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 text-xs">
            {data?.error || 'Failed to load database lock wait telemetry.'}
          </div>
        ) : totalLockWaits === 0 ? (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 custom-scrollbar py-8 flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
              <CheckCircle2 size={42} />
            </div>
            <div className="max-w-md space-y-2">
              <h4 className="text-base font-bold text-slate-100">
                Zero Lock Contention &mdash; Database Optimal
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                No threads or transactions are blocked by locks (<span className="font-mono text-emerald-300 font-semibold">0 Lock Waits</span>, <span className="font-mono text-emerald-300 font-semibold">0 Deadlocks</span>). All queries are executing concurrently without queue contention.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mt-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Root Blockers</span>
                <span className="text-lg font-bold text-slate-200">0 Sessions</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Waiting Queries</span>
                <span className="text-lg font-bold text-slate-200">0 Queries</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Lock Contention</span>
                <span className="text-lg font-bold text-emerald-400">HEALTHY</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 custom-scrollbar">
            {/* Contention KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-rose-500/30">
                <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">Total Lock Waits</span>
                <span className="text-xl font-black font-mono text-rose-300">{totalLockWaits}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Root Blockers</span>
                <span className="text-xl font-black font-mono text-amber-300">{rootBlockers.length}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Culprit Sessions</span>
                <span className="text-xl font-black font-mono text-slate-100">{allBlockers.length}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Contention Severity</span>
                <span className="text-sm font-bold font-mono text-rose-400 uppercase mt-1 block">
                  {rawWaits.some((w: any) => Number(w.wait_age_secs) > 10) ? 'CRITICAL HIGH' : 'MODERATE'}
                </span>
              </div>
            </div>

            {/* Root Blockers Section (Biang Kerok) */}
            {rootBlockers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame size={13} className="text-rose-400 animate-pulse" />
                  Identified Root Blockers ({rootBlockers.length} Culprits)
                </h4>
                <div className="space-y-3">
                  {rootBlockers.map((b, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-mono text-xs font-bold border border-rose-500/40">
                            ROOT BLOCKER PID #{b.pid}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            User: <span className="text-slate-200 font-semibold">{b.user}</span>
                          </span>
                          <span className="text-xs text-amber-300 font-mono font-bold">
                            &bull; Memblokir {b.blocked_count} queries
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {killingPid === b.pid ? (
                            <button disabled className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-mono inline-flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" />
                              <span>Killing...</span>
                            </button>
                          ) : confirmKillBlockerPid === b.pid ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  onKill(serverName, b.pid);
                                  setConfirmKillBlockerPid(null);
                                }}
                                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-mono inline-flex items-center gap-1 shadow-lg shadow-rose-900/40 animate-pulse"
                              >
                                <ZapOff size={12} />
                                <span>Confirm Kill #{b.pid}</span>
                              </button>
                              <button
                                onClick={() => setConfirmKillBlockerPid(null)}
                                className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmKillBlockerPid(b.pid)}
                              className="px-3 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs font-mono inline-flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/60"
                              title="Terminate this root blocker to free all blocked queries"
                            >
                              <ZapOff size={12} />
                              <span>Kill Blocker (Unfreeze DB)</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Blocker SQL Query */}
                      {b.query && (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                          {b.query}
                        </div>
                      )}

                      {/* Blocked Child Threads */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[11px] font-mono text-slate-400 block mb-1.5 font-bold uppercase">
                          Threads Menunggu Giliran ({b.blocked_threads.length}):
                        </span>
                        <div className="space-y-1.5">
                          {b.blocked_threads.map((t: any, cIdx: number) => (
                            <div key={cIdx} className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-slate-500">&bull;</span>
                                <span className="text-cyan-300 font-bold">PID #{t.waiting_pid}</span>
                                <span className="text-slate-400 text-[11px]">({t.waiting_user})</span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 text-[10px] border border-amber-500/20">
                                  {t.lock_mode}
                                </span>
                                {t.query && (
                                  <span className="text-slate-400 truncate max-w-xs text-[11px]">
                                    {t.query}
                                  </span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold shrink-0 text-[11px]">
                                Menunggu {t.wait_age_secs}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete Waiting List Table */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock size={13} className="text-cyan-400" />
                Daftar Lengkap Relasi Lock Wait ({rawWaits.length} Records)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5 border-b border-slate-800 font-mono">Waiting PID</th>
                      <th className="px-3.5 py-2.5 border-b border-slate-800">Wait Duration</th>
                      <th className="px-3.5 py-2.5 border-b border-slate-800">Lock Mode</th>
                      <th className="px-3.5 py-2.5 border-b border-slate-800 font-mono">Blocked By (PID)</th>
                      <th className="px-3.5 py-2.5 border-b border-slate-800">Waiting Query Statement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {rawWaits.map((w, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="px-3.5 py-2 text-cyan-300 font-bold">#{w.waiting_pid}</td>
                        <td className="px-3.5 py-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold text-[10px]">
                            {w.wait_age_secs}s
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-300 text-[10px]">{w.waiting_lock_mode || 'LOCK_WAIT'}</td>
                        <td className="px-3.5 py-2 text-rose-400 font-bold">#{w.blocking_pid}</td>
                        <td className="px-3.5 py-2 text-slate-400 text-[10px] max-w-sm truncate" title={w.waiting_query || ''}>
                          {w.waiting_query || '(No query info)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0 text-xs text-slate-500 font-mono">
          <span className="hidden sm:inline text-[11px]">
            Tip: Matikan (Kill) Root Blocker untuk langsung membebaskan antrean database yang macet
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Fitur 2: Top Resource-Heavy Query Digest & Performance Profiler
// -------------------------------------------------------------
function QueryDigestModal({
  serverName,
  data,
  isLoading,
  sortBy,
  onSortChange,
  onClose,
  onInspectQuery,
  onCopy,
  copiedQuery,
}: {
  serverName: string;
  data: any;
  isLoading: boolean;
  sortBy: 'total_time' | 'exec_count' | 'avg_time' | 'reads';
  onSortChange: (sort: 'total_time' | 'exec_count' | 'avg_time' | 'reads') => void;
  onClose: () => void;
  onInspectQuery: (sql: string) => void;
  onCopy: (sql: string) => void;
  copiedQuery: string | null;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const [filterText, setFilterText] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const rawQueries = (data?.top_queries || []) as any[];
  const source = data?.source || 'unknown';
  const dbType = (data?.type || 'DB').toUpperCase();

  const filteredQueries = rawQueries.filter((q) => {
    if (!filterText.trim()) return true;
    const term = filterText.toLowerCase();
    return (
      String(q.query_text || '').toLowerCase().includes(term) ||
      String(q.user || '').toLowerCase().includes(term) ||
      String(q.db || '').toLowerCase().includes(term)
    );
  });

  const totalRuntimeSec = rawQueries.reduce((acc, q) => acc + (Number(q.total_sec) || 0), 0);
  const totalExecCount = rawQueries.reduce((acc, q) => acc + (Number(q.exec_count) || 0), 0);
  const maxRuntimeQuery = rawQueries.length > 0 
    ? Math.max(...rawQueries.map(q => Number(q.total_sec) || 0)) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div 
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div 
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
              <Gauge size={22} className="text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Top Heavy Query Digest &amp; Profiler
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-violet-300 bg-violet-500/20 border border-violet-500/30">
                  {rawQueries.length} PROFILES TRACKED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Instance: <span className="text-violet-300 font-bold">{serverName}</span> ({dbType}) &bull; Engine:{' '}
                <span className="text-slate-300">
                  {source === 'kernel_dmv' ? 'Kernel DMV (sys.dm_exec_query_stats)' : 'Rolling Processlist Profiler'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button 
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono"
                title="Reset posisi ke tengah (atau double-click header)"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="text-violet-400 animate-spin" />
            <p className="text-slate-400 text-xs font-mono animate-pulse">
              Aggregating query execution statistics and compiling digest profiles...
            </p>
          </div>
        ) : !data?.ok ? (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 text-xs">
            {data?.error || 'Failed to load historical query digest telemetry.'}
          </div>
        ) : rawQueries.length === 0 ? (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 custom-scrollbar py-12 flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-2">
              <Gauge size={42} />
            </div>
            <div className="max-w-md space-y-2">
              <h4 className="text-base font-bold text-slate-100">
                No Query Digest Profiles Collected Yet
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The profiler is continuously monitoring execution stats. As recurring query patterns or elevated runtimes are detected, aggregated digest metrics will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 custom-scrollbar">
            {/* Top Aggregate KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-violet-500/30">
                <span className="text-[10px] uppercase font-bold text-violet-400 block mb-1">
                  Tracked Patterns
                </span>
                <span className="text-xl font-black font-mono text-violet-300">
                  {rawQueries.length} <span className="text-xs font-normal text-slate-400">queries</span>
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Total Executions
                </span>
                <span className="text-xl font-black font-mono text-slate-100">
                  {totalExecCount.toLocaleString()}x
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Cumulative Runtime
                </span>
                <span className="text-xl font-black font-mono text-amber-300">
                  {totalRuntimeSec >= 3600
                    ? `${(totalRuntimeSec / 3600).toFixed(1)} hrs`
                    : `${totalRuntimeSec.toFixed(1)}s`}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Peak Single Query
                </span>
                <span className="text-xl font-black font-mono text-rose-400">
                  {maxRuntimeQuery.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Sort Tabs & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <span className="text-slate-500 font-mono text-[11px] mr-1 hidden sm:inline">Sort:</span>
                <button
                  onClick={() => onSortChange('total_time')}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    sortBy === 'total_time'
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock size={12} />
                  <span>Total Runtime</span>
                </button>
                <button
                  onClick={() => onSortChange('exec_count')}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    sortBy === 'exec_count'
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp size={12} />
                  <span>Frequency (Exec)</span>
                </button>
                <button
                  onClick={() => onSortChange('avg_time')}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    sortBy === 'avg_time'
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap size={12} />
                  <span>Avg Latency</span>
                </button>
                <button
                  onClick={() => onSortChange('reads')}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    sortBy === 'reads'
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <HardDrive size={12} />
                  <span>Logical I/O</span>
                </button>
              </div>

              {/* Keyword Filter Input */}
              <div className="relative max-w-xs w-full">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter query by keyword or table..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 font-mono"
                />
              </div>
            </div>

            {/* Digest Query Cards List */}
            <div className="space-y-3">
              {filteredQueries.map((q, idx) => {
                const isExpanded = expandedIndex === idx;
                const sqlText = String(q.query_text || '').trim();
                const totalSec = Number(q.total_sec || 0);
                const avgMs = Number(q.avg_ms || 0);
                const execCount = Number(q.exec_count || 1);
                const logicalReads = Number(q.logical_reads || 0);

                return (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-violet-500/40 transition-all space-y-3 group"
                  >
                    {/* Card Header & Metrics */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                          idx === 0 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                            : idx < 3
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          #{idx + 1}
                        </span>

                        {/* Executions */}
                        <div className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-200 text-xs font-mono inline-flex items-center gap-1 border border-slate-700/50">
                          <span className="text-slate-400 text-[10px]">Exec:</span>
                          <span className="font-bold text-cyan-300">{execCount.toLocaleString()}x</span>
                        </div>

                        {/* Total Runtime */}
                        <div className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-200 text-xs font-mono inline-flex items-center gap-1 border border-slate-700/50">
                          <span className="text-slate-400 text-[10px]">Total:</span>
                          <span className="font-bold text-amber-300">
                            {totalSec >= 60 ? `${(totalSec / 60).toFixed(1)}m` : `${totalSec.toFixed(1)}s`}
                          </span>
                        </div>

                        {/* Avg Latency */}
                        <div className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-200 text-xs font-mono inline-flex items-center gap-1 border border-slate-700/50">
                          <span className="text-slate-400 text-[10px]">Avg:</span>
                          <span className="font-bold text-violet-300">
                            {avgMs >= 1000 ? `${(avgMs / 1000).toFixed(2)}s` : `${avgMs.toFixed(1)}ms`}
                          </span>
                        </div>

                        {/* Logical Reads */}
                        {logicalReads > 0 && (
                          <div className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-200 text-xs font-mono inline-flex items-center gap-1 border border-slate-700/50">
                            <span className="text-slate-400 text-[10px]">Reads:</span>
                            <span className="font-bold text-emerald-300">
                              {logicalReads >= 1000000
                                ? `${(logicalReads / 1000000).toFixed(1)}M`
                                : logicalReads.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {q.last_seen && (
                          <span className="text-[10px] text-slate-500 font-mono hidden xl:inline">
                            Last: {q.last_seen}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                        <button
                          onClick={() => onCopy(sqlText)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono inline-flex items-center gap-1 transition-all border border-slate-700/60"
                          title="Copy query text"
                        >
                          {copiedQuery === sqlText ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => onInspectQuery(sqlText)}
                          className="px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600 text-violet-200 hover:text-white text-xs font-mono font-bold inline-flex items-center gap-1 transition-all border border-violet-500/40 shadow-sm shadow-violet-950/60"
                          title="Open Query Inspector to analyze execution plan (EXPLAIN)"
                        >
                          <Zap size={12} className="text-violet-300" />
                          <span>Run EXPLAIN</span>
                        </button>
                      </div>
                    </div>

                    {/* Query Snippet Body */}
                    <div className="relative rounded-lg bg-slate-900 border border-slate-800/90 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all leading-relaxed text-[11px] text-slate-200">
                        {isExpanded ? sqlText : (sqlText.slice(0, 220) + (sqlText.length > 220 ? ' ...' : ''))}
                      </pre>
                      {sqlText.length > 220 && (
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                          className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline inline-block"
                        >
                          {isExpanded ? 'Show Less' : 'View Full Query Statement'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0 text-xs text-slate-500 font-mono">
          <span className="hidden sm:inline text-[11px]">
            💡 Rekomendasi DBA: Klik <span className="text-violet-300 font-bold">[⚡ Run EXPLAIN]</span> pada query dengan runtime tinggi untuk mengaudit Index scans &amp; cost execution plan.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Fitur 3: SOC Security & Configuration Audit Scorecard
// -------------------------------------------------------------
function SecurityAuditModal({
  serverName,
  data,
  isLoading,
  onClose,
}: {
  serverName: string;
  data: any;
  isLoading: boolean;
  onClose: () => void;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PASS' | 'WARN' | 'FAIL'>('all');

  const rawChecks = (data?.checks || []) as any[];
  const score = Number(data?.score || 0);
  const grade = String(data?.grade || 'C');
  const gradeLabel = String(data?.grade_label || 'Compliance Audit');
  const summary = data?.summary || { total_checks: 0, passed: 0, warnings: 0, failed: 0 };
  const dbType = String(data?.type || 'DB').toUpperCase();

  const filteredChecks = rawChecks.filter((c) => {
    if (activeCategory !== 'all' && c.category !== activeCategory) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const getScoreTheme = (g: string) => {
    switch (g) {
      case 'A+':
      case 'A':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          bar: 'bg-emerald-500',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'B':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/30',
          bar: 'bg-cyan-500',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        };
      case 'C':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          bar: 'bg-amber-500',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      default:
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/30',
          bar: 'bg-rose-500',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
    }
  };

  const theme = getScoreTheme(grade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div 
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div 
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${theme.bg} ${theme.border} ${theme.text}`}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  SOC Security &amp; Configuration Audit Scorecard
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${theme.badge}`}>
                  GRADE {grade} ({score}/100)
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Instance: <span className="text-cyan-300 font-bold">{serverName}</span> ({dbType}) &bull; Framework:{' '}
                <span className="text-slate-300">CIS Database Benchmark &amp; ISO 27001</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button 
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono"
                title="Reset posisi ke tengah (atau double-click header)"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="text-emerald-400 animate-spin" />
            <p className="text-slate-400 text-xs font-mono animate-pulse">
              Auditing runtime security postures, buffer cache ratios, and configuration limits...
            </p>
          </div>
        ) : !data?.ok ? (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-300 text-xs">
            {data?.error || 'Failed to execute database security compliance audit.'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 custom-scrollbar">
            {/* Scorecard Hero Panel */}
            <div className={`p-5 rounded-2xl border ${theme.border} ${theme.bg} flex flex-col md:flex-row md:items-center justify-between gap-6`}>
              {/* Score Left */}
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${theme.text}`}>
                    {score}
                  </span>
                  <span className="text-lg font-bold text-slate-400 font-mono">/ 100</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-mono font-black border uppercase tracking-wider ${theme.badge}`}>
                    GRADE {grade}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    {gradeLabel}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Automated compliance evaluation across authentication integrity, buffer cache efficiency, connection headroom, audit logging, and TLS encryption.
                  </p>
                </div>
                {/* Meter bar */}
                <div className="w-full max-w-sm h-2 rounded-full bg-slate-800 overflow-hidden mt-1">
                  <div 
                    className={`h-full transition-all duration-500 ${theme.bar}`}
                    style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
                  />
                </div>
              </div>

              {/* Summary KPIs Right */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono shrink-0">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Total Checks</span>
                  <span className="text-lg font-bold text-slate-200">{summary.total_checks}</span>
                </div>
                <div 
                  onClick={() => setStatusFilter(statusFilter === 'PASS' ? 'all' : 'PASS')}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    statusFilter === 'PASS'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-emerald-500/30'
                  }`}
                  title="Click to filter passed checks"
                >
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-0.5">Passed</span>
                  <span className="text-lg font-bold text-emerald-300">{summary.passed}</span>
                </div>
                <div 
                  onClick={() => setStatusFilter(statusFilter === 'WARN' ? 'all' : 'WARN')}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    statusFilter === 'WARN'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-amber-500/30'
                  }`}
                  title="Click to filter warning checks"
                >
                  <span className="text-[10px] text-amber-400 uppercase font-bold block mb-0.5">Warnings</span>
                  <span className="text-lg font-bold text-amber-300">{summary.warnings}</span>
                </div>
                <div 
                  onClick={() => setStatusFilter(statusFilter === 'FAIL' ? 'all' : 'FAIL')}
                  className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                    statusFilter === 'FAIL'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-rose-500/30'
                  }`}
                  title="Click to filter critical checks"
                >
                  <span className="text-[10px] text-rose-400 uppercase font-bold block mb-0.5">Critical</span>
                  <span className="text-lg font-bold text-rose-300">{summary.failed}</span>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
              {[
                { id: 'all', label: 'All Categories', icon: Shield },
                { id: 'access', label: 'Access & Accounts', icon: Lock },
                { id: 'memory', label: 'Memory & Cache', icon: Gauge },
                { id: 'capacity', label: 'Connection Capacity', icon: Users },
                { id: 'logging', label: 'Logging & DR', icon: HardDrive },
                { id: 'encryption', label: 'TLS Encryption', icon: ShieldCheck },
              ].map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/50'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                    }`}
                  >
                    <IconComponent size={12} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Audit Checklist Items */}
            <div className="space-y-3">
              {filteredChecks.map((check, idx) => {
                const isPass = check.status === 'PASS';
                const isWarn = check.status === 'WARN';
                const isFail = check.status === 'FAIL';

                return (
                  <div
                    key={check.id || idx}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isPass
                        ? 'bg-slate-950/50 border-slate-800/80 hover:border-emerald-500/30'
                        : isWarn
                        ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50'
                        : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                    }`}
                  >
                    {/* Check Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {isPass ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            PASS
                          </span>
                        ) : isWarn ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={11} />
                            WARNING
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold inline-flex items-center gap-1 animate-pulse">
                            <XCircle size={11} />
                            CRITICAL
                          </span>
                        )}

                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                          {check.category}
                        </span>

                        <h5 className="text-xs sm:text-sm font-bold text-slate-100">
                          {check.title}
                        </h5>
                      </div>

                      {/* Current Value Pill */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="text-[11px] font-mono text-slate-400">Nilai:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                          isPass
                            ? 'bg-slate-900 text-emerald-300 border-emerald-500/20'
                            : isWarn
                            ? 'bg-slate-900 text-amber-300 border-amber-500/30'
                            : 'bg-slate-900 text-rose-300 border-rose-500/40'
                        }`}>
                          {check.value}
                        </span>
                      </div>
                    </div>

                    {/* Benchmark & Description */}
                    <div className="text-xs text-slate-400 leading-relaxed space-y-1">
                      <p>{check.description}</p>
                      {check.benchmark && (
                        <p className="text-[11px] font-mono text-slate-500">
                          Standar Acuan (Benchmark): <span className="text-slate-300 font-medium">{check.benchmark}</span>
                        </p>
                      )}
                    </div>

                    {/* Remediation Action Callout */}
                    {check.recommendation && (
                      <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-1 font-mono">
                        <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                          💡 Rekomendasi Remediasi DBA / SOC:
                        </span>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                          {check.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 shrink-0 text-xs text-slate-500 font-mono">
          <span className="hidden sm:inline text-[11px]">
            🛡️ Benchmark Standard: CIS Database Security Benchmark &amp; ISO 27001 Access Compliance Matrix
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Opsi 4: One-Click Export PDF & CSV SOC Database Audit Report
// -------------------------------------------------------------
function ExportReportModal({
  onClose,
  onDownloadCsv,
  onOpenPdfReport,
  isExporting,
}: {
  onClose: () => void;
  onDownloadCsv: (type: 'fleet_csv' | 'audit_csv' | 'digest_csv') => void;
  onOpenPdfReport: () => void;
  isExporting: string | null;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();

  const exportOptions = [
    {
      id: 'pdf_report',
      title: 'Executive SOC Audit Report (Print / PDF)',
      badge: 'OFFICIAL DOCUMENT',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      icon: FileText,
      iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      description:
        'Comprehensive executive report summarizing database fleet availability, per-node performance telemetry, CIS/ISO 27001 audit findings with remediation steps, and top 8 heavy queries. Ready to print or export as PDF.',
      actionType: 'pdf',
      actionLabel: 'Open Document / Print PDF',
    },
    {
      id: 'fleet_csv',
      title: 'Fleet Performance & Health Telemetry',
      badge: 'TABULAR CSV',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      icon: Server,
      iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      description:
        'Export server inventory, online/offline status, current QPS throughput, connection headroom utilization, buffer pool hit rates, aborted connection spikes, and CIS/ISO compliance scores.',
      actionType: 'csv',
      csvType: 'fleet_csv' as const,
      actionLabel: 'Download Fleet CSV',
    },
    {
      id: 'audit_csv',
      title: 'Security Hardening & Remediation Checklist',
      badge: 'CIS & ISO 27001',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description:
        'Per-instance security checklist matrix evaluating authentication (default accounts), connection limits, disaster recovery (binlogs), slow query logging, and TLS/SSL encryption with SOC/DBA remediation guidance.',
      actionType: 'csv',
      csvType: 'audit_csv' as const,
      actionLabel: 'Download Audit CSV',
    },
    {
      id: 'digest_csv',
      title: 'Heavy Query Digest & Latency Profiler',
      badge: 'DMV & PFS DIGEST',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Zap,
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      description:
        'Inventory of queries consuming the highest aggregate latency across the database fleet. Includes execution counts, total elapsed time, average latency (ms), logical reads, last observed timestamp, and parameterized SQL statements.',
      actionType: 'csv',
      csvType: 'digest_csv' as const,
      actionLabel: 'Download Digest CSV',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
              <Download size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Export SOC Audit Report &amp; Telemetry Datasets
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Select between executive printable audit documents (PDF) or raw tabular datasets (CSV/Excel).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                title="Reset position to center"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Cards */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exportOptions.map((opt) => {
              const IconComp = opt.icon;
              const isDownloading = opt.actionType === 'csv' && isExporting === opt.csvType;

              return (
                <div
                  key={opt.id}
                  className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${opt.iconColor}`}>
                        <IconComp size={20} />
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase tracking-wider ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{opt.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {opt.actionType === 'pdf' ? (
                      <button
                        onClick={onOpenPdfReport}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                      >
                        <ExternalLink size={14} />
                        <span>{opt.actionLabel}</span>
                      </button>
                    ) : (
                      <button
                        disabled={!!isExporting}
                        onClick={() => opt.csvType && onDownloadCsv(opt.csvType)}
                        className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 ${
                          isDownloading
                            ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                            : isExporting
                            ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80 hover:border-slate-600 cursor-pointer'
                        }`}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-cyan-400" />
                            <span>Mengekstrak CSV...</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span>{opt.actionLabel}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800 shrink-0 text-xs text-slate-500 font-mono">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>💡</span> File CSV menyertakan UTF-8 BOM untuk kompatibilitas otomatis dengan Microsoft Excel &amp; Spreadsheet.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all ml-auto cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Fitur Tambahan 1: Custom Date-Time Range Picker Modal (Draggable)
function CustomDateRangeModal({
  initialStart,
  initialEnd,
  onClose,
  onApply,
}: {
  initialStart: string;
  initialEnd: string;
  onClose: () => void;
  onApply: (start: string, end: string) => void;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [error, setError] = useState<string | null>(null);

  const toLocalIso = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const applyPreset = (type: string) => {
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (type === '1h') {
      s = new Date(now.getTime() - 60 * 60 * 1000);
    } else if (type === '6h') {
      s = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    } else if (type === '24h') {
      s = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (type === '7d') {
      s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (type === '30d') {
      s = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (type === 'today') {
      s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (type === 'yesterday') {
      s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (type === 'incident') {
      s = new Date('2026-10-06T00:00:00');
      e = new Date('2026-10-07T23:59:59');
    }

    setStart(toLocalIso(s));
    setEnd(toLocalIso(e));
    setError(null);
  };

  const handleApply = () => {
    if (!start || !end) {
      setError('Both start and end timestamps are required.');
      return;
    }
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (isNaN(startTime) || isNaN(endTime)) {
      setError('Invalid date/time format.');
      return;
    }
    if (startTime >= endTime) {
      setError('Start timestamp must be earlier than end timestamp.');
      return;
    }
    onApply(start, end);
  };

  const durationText = (() => {
    if (!start || !end) return null;
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diffMs) || diffMs <= 0) return null;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    const remMins = diffMins % 60;

    if (diffDays > 0) {
      return `${diffDays}d ${remHours}h ${remMins > 0 ? `${remMins}m` : ''}`.trim();
    }
    if (diffHours > 0) {
      return `${diffHours}h ${remMins > 0 ? `${remMins}m` : ''}`.trim();
    }
    return `${remMins} minutes`;
  })();

  const presets = [
    { label: 'Last 1 Hour', id: '1h' },
    { label: 'Last 6 Hours', id: '6h' },
    { label: 'Last 24 Hours', id: '24h' },
    { label: 'Last 7 Days', id: '7d' },
    { label: 'Last 30 Days', id: '30d' },
    { label: 'Today (00:00 - Now)', id: 'today' },
    { label: 'Full Yesterday', id: 'yesterday' },
    { label: 'Incident 06-07 Oct 2026', id: 'incident' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Custom Date-Time Range
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Select specific historical date &amp; time window for incident telemetry auditing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                title="Reset position to center"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 custom-scrollbar">
          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all text-center cursor-pointer truncate"
                  title={p.label}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Time Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Start Timestamp
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                End Timestamp
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Duration Indicator */}
          {durationText && (
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-cyan-300">
                <Clock size={14} className="text-cyan-400" />
                <span>Selected Window: <b>{durationText}</b></span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Downsampled auto-fit
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Hint */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1 leading-relaxed">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles size={12} className="text-cyan-400" />
              <span>SOC Flexible Telemetry:</span>
            </p>
            <p>
              The DB-Monitor backend stores up to 43,200 historical samples (30 days).
              If the selected time range has more than 720 data points, <i>LTTB downsampling</i> is applied automatically to keep chart rendering smooth and responsive.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
          >
            <Check size={14} />
            <span>Apply Time Range</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Fitur Tambahan 2: Telegram Notification Tester & Webhook Settings Modal (Draggable)
function TelegramAlertModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { isMoved, dragHandleProps, modalStyle, handleResetPosition } = useDraggableModal();
  const [tokenInput, setTokenInput] = useState('');
  const [chatIdInput, setChatIdInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const configQuery = useQuery({
    queryKey: ['telegram-config'],
    queryFn: async () => (await api.get('/db-monitor?action=telegram_config')).data,
    staleTime: 30000,
  });

  const config = configQuery.data;

  // Pre-fill chat ID if available from config
  useEffect(() => {
    if (config?.chat_id && !chatIdInput) {
      setChatIdInput(config.chat_id);
    }
  }, [config]);

  const handleSendTest = async () => {
    setIsSending(true);
    setTestResult(null);

    try {
      const payload: any = {};
      if (tokenInput.trim()) payload.token = tokenInput.trim();
      if (chatIdInput.trim()) payload.chat_id = chatIdInput.trim();

      const res = await api.post('/db-monitor?action=telegram_test', payload);
      if (res.data?.ok) {
        setTestResult({
          ok: true,
          message: res.data.message || 'Test alert notification successfully dispatched to Telegram bot!',
        });
      } else {
        setTestResult({
          ok: false,
          message: res.data?.error || 'Failed to dispatch message to Telegram.',
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.response?.data?.error || err.message || 'Failed to communicate with backend API.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyEnvSnippet = () => {
    const snippet = `# DB Monitor Telegram Alert Configuration\nDB_MONITOR_TELEGRAM_ENABLED=true\nDB_MONITOR_TELEGRAM_TOKEN="${tokenInput.trim() || 'YOUR_BOT_TOKEN'}"\nDB_MONITOR_TELEGRAM_CHAT_ID="${chatIdInput.trim() || 'YOUR_CHAT_ID'}"\nDB_MONITOR_TELEGRAM_COOLDOWN=300`;
    navigator.clipboard.writeText(snippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden">
      <div
        style={modalStyle}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div
          {...dragHandleProps}
          className={`flex items-center justify-between border-b border-slate-800 pb-4 shrink-0 ${dragHandleProps.className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-blue-500/10 border-blue-500/30 text-blue-400">
              <Bell size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Telegram Alert Bot Tester &amp; Webhook
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Test instant security incident bot alerts to the SOC team Telegram channel.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" data-no-drag>
            {isMoved && (
              <button
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                title="Reset position to center"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Center</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 custom-scrollbar">
          {/* Current Config Status Banner */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Server Integration Status
              </span>
              {configQuery.isLoading ? (
                <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Checking...
                </span>
              ) : config?.enabled ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  ACTIVE (.env)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold font-mono uppercase flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Not Configured in .env
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Bot Token</span>
                <span className="text-slate-200 font-semibold truncate block mt-0.5">
                  {config?.masked_token || (tokenInput ? `${tokenInput.slice(0, 6)}...` : 'Not configured')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Target Chat ID</span>
                <span className="text-cyan-300 font-semibold truncate block mt-0.5">
                  {config?.chat_id || chatIdInput || 'Not configured'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase block">Alert Cooldown</span>
                <span className="text-slate-200 font-semibold block mt-0.5">
                  {config?.cooldown_seconds || 300}s (5 min)
                </span>
              </div>
            </div>
          </div>

          {/* Test Ping Form */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Send size={13} className="text-cyan-400" />
              <span>Dispatch Test Notification Ping</span>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Target Chat ID / Channel ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Example: 123456789 or -100198273645 (Channel/Group)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Retrieve your Chat ID via Telegram bot <b>@userinfobot</b> or the group ID where the bot is added.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Custom Bot Token <span className="text-slate-500 font-normal">(Optional if already set in .env)</span>
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={config?.has_token ? 'Saved in .env (only fill to override)' : 'Example: 123456789:AAFg84...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  disabled={isSending || (!chatIdInput.trim() && !config?.chat_id)}
                  onClick={handleSendTest}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 ${
                    isSending
                      ? 'bg-blue-600/50 text-blue-200 border border-blue-500/30 cursor-not-allowed'
                      : !chatIdInput.trim() && !config?.chat_id
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-950/50 cursor-pointer'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>Dispatching test ping to Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send Test Alert Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 animate-in fade-in duration-200 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}>
                {testResult.ok ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">
                  {testResult.message}
                </div>
              </div>
            )}
          </div>

          {/* Active SOC Alert Policies Matrix */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={14} className="text-amber-400" />
              <span>Automated Incident Alert Policies</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950/50 border border-rose-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400">DB Node Offline</span>
                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">CRITICAL</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Instant alert dispatched immediately if a database node fails health check queries.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/50 border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300">Spike Auth Failure</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">HIGH</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Brute-force alert triggered when authentication failures exceed &gt; 10 failures/minute.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/50 border border-cyan-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">Throughput Surge</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">MEDIUM</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Surge notification dispatched if queries per second (QPS) spike 3x above moving baseline.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/50 border border-violet-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-300">Lock Contention</span>
                  <span className="px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 text-[9px] font-bold">HIGH</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Alert dispatched on deadlock encounters or blocking query chains lasting &gt; 15 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Quick .env setup guide */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Permanent .env Setup
              </span>
              <button
                type="button"
                onClick={copyEnvSnippet}
                className="text-cyan-400 hover:text-cyan-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
              >
                {copiedEnv ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Config</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono overflow-x-auto">
{`DB_MONITOR_TELEGRAM_ENABLED=true
DB_MONITOR_TELEGRAM_TOKEN="${tokenInput.trim() || 'YOUR_BOT_TOKEN'}"
DB_MONITOR_TELEGRAM_CHAT_ID="${chatIdInput.trim() || 'YOUR_CHAT_ID'}"
DB_MONITOR_TELEGRAM_COOLDOWN=300`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Default cooldown rate limit: 300 seconds between identical alerts.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}




