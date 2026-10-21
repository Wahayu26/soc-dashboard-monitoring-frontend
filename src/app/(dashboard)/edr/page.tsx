'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLiveChannel } from '@/hooks/useLiveChannel';
import { DrillDownDrawer, EventDetailDrawer, type DrillTarget, severityClass } from '@/components/edr/EdrDrawers';
import { X } from 'lucide-react';
import { 
  KeyRound, Users, MonitorSmartphone, AlertTriangle, ShieldCheck, Clock, 
  Search, ServerCrash, Activity, Send, CheckCircle2, ShieldAlert, Download
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface CrowdStrikeSummaryResponse {
  success: boolean;
  data: {
    meta: any;
    kpi: any;
    panels: any;
    logs: any[];
  };
}

export default function EdrDashboard() {
  const [range, setRange] = useState('7d');
  const [search, setSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  // Use a debounced search value for the API call
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const [tableBucket, setTableBucket] = useState<string | null>(null);
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [eventDetailId, setEventDetailId] = useState<number | null>(null);


  // Simple debounce implementation
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const timeoutId = setTimeout(() => setDebouncedSearch(e.target.value), 500);
    return () => clearTimeout(timeoutId);
  };
  
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  
  // Custom range states
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const downloadReport = (period: 'weekly' | 'monthly' | 'custom') => {
    if (period === 'custom' && (!customStart || !customEnd)) {
      alert('Please select both start and end dates.');
      return;
    }
    
    const params = new URLSearchParams();
    params.set('period', period);
    if (period === 'custom') {
      params.set('start_date', customStart);
      params.set('end_date', customEnd);
    }
    window.open(`/edr/report?${params.toString()}`, '_blank');
  };
  
  const queryLimit = range === '30d' ? 300 : range === '7d' ? 200 : 100;
  const customParams = showCustomRange && customStart && customEnd ? `&start_date=${customStart}&end_date=${customEnd}` : '';

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['crowdstrike', range, debouncedSearch, showCustomRange, customStart, customEnd],
    queryFn: async () => {
      const res = await api.get<CrowdStrikeSummaryResponse>(`/crowdstrike?action=summary&range=${range}&limit=${queryLimit}&search=${encodeURIComponent(debouncedSearch)}${customParams}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const data = rawData?.data;

  const { data: tableData, isLoading: isTableLoading } = useQuery({
    queryKey: ['crowdstrike-table', range, tableBucket],
    queryFn: async () => {
      if (tableBucket) {
        const res = await api.get(`/crowdstrike?action=drilldown&dimension=bucket&value=${encodeURIComponent(tableBucket)}&range=${range}&limit=100`);
        return res.data?.data?.events || [];
      }
      return null;
    },
    enabled: !!tableBucket,
  });

  const liveStatus = useLiveChannel('soc.crowdstrike', 'edr.events', (payload: any) => {
    if (!payload?.events?.length) return;
    
    if (!debouncedSearch) {
      queryClient.setQueryData(['crowdstrike', range, debouncedSearch], (old: any) => {
        if (!old?.data) return old;
        const newLogs = [...payload.events, ...old.data.logs].slice(0, 80);
        return {
          ...old,
          data: {
            ...old.data,
            logs: newLogs,
          }
        };
      });
      queryClient.invalidateQueries({ queryKey: ['crowdstrike', range, debouncedSearch] });
    }
  });


  if (isLoading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-rose-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-orange-500 animate-spin animation-delay-150"></div>
          </div>
          <p className="text-rose-400 font-mono text-sm tracking-widest animate-pulse">
            LOADING EDR POSTURE...
          </p>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const meta = data?.meta || {};
  const logs = data?.logs || [];
  const trend = data?.panels?.trend || [];
  const topAlerts = data?.panels?.alerts || [];
  const topHosts = data?.panels?.hosts || [];
  const topMitre = data?.panels?.mitre || [];
  const windows = data?.panels?.windows || {};
  const serverProfile = windows.profiles?.find((p: any) => p.profile === 'server');
  const userProfile = windows.profiles?.find((p: any) => p.profile === 'user');
  
  const baseLogs = tableBucket ? (tableData || []) : logs;
  const filteredLogs = baseLogs.filter((log: any) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      (log.hostname || '').toLowerCase().includes(term) ||
      (log.alert_name || '').toLowerCase().includes(term) ||
      (log.severity || '').toLowerCase().includes(term) ||
      (log.tactic || '').toLowerCase().includes(term)
    );
  });

  const collectorHealthy = meta.collector?.status === 'healthy' || meta.collector?.ok === true || meta.collector_health === 'healthy';

  return (
    <>
      <div className="flex flex-col gap-6 animate-fade-up pb-8">
      {/* Top Banner / Status */}
      <div className="glass-card p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-rose-500/5 blur-[100px]" />
        
        <div>
          <p className="text-[10px] font-black tracking-[0.2em] uppercase text-rose-400/80 mb-2">Endpoint Detection & Response</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">
            CrowdStrike EDR posture in <span className="text-gradient">one view.</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xl">
            Endpoint telemetry, high-severity detections, and behavioral alerts across all hosts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 relative z-10">
          <StatusBadge label="Feed" value={liveStatus === 'live' ? 'LIVE' : liveStatus === 'connecting' ? 'SYNCING' : 'OFFLINE'} color={liveStatus === 'live' ? 'cyan' : liveStatus === 'connecting' ? 'slate' : 'rose'} />
          <StatusBadge label="Latest" value={meta.latest_time || 'N/A'} />
          <StatusBadge 
            label="Collector" 
            value={collectorHealthy ? 'HEALTHY' : 'DEGRADED'} 
            color={collectorHealthy ? 'emerald' : 'rose'} 
          />
        </div>
      </div>

      {/* Toolbar: Search & Range */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search user, safe, target, session..." 
            value={search}
            onChange={handleSearchChange}
            className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all placeholder:text-slate-500"
          />
        </div>
        
        <div className="flex gap-2 glass-card p-1.5 rounded-xl">
          {['1h', 'today', '24h', '7d', '30d'].map(r => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setTableBucket(null);
                setShowCustomRange(false);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                range === r && !showCustomRange
                  ? 'bg-orange-500/20 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {showCustomRange && (
            <div className="flex items-center gap-2 glass-card p-1 rounded-xl">
              <input 
                type="date" 
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-slate-800 border border-slate-700/50 rounded-lg py-1 px-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input 
                type="date" 
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-slate-800 border border-slate-700/50 rounded-lg py-1 px-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                onClick={() => downloadReport('custom')}
                disabled={isDownloading !== null}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg text-xs font-bold transition-all"
              >
                {isDownloading === 'custom' ? (
                  <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                Get
              </button>
            </div>
          )}
        
          <button 
            onClick={() => setShowCustomRange(!showCustomRange)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all ${
              showCustomRange 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                : 'bg-slate-800/50 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-slate-700/50 hover:border-emerald-500/50'
            }`}
          >
            Custom
          </button>

          <button 
            onClick={() => downloadReport('weekly')}
            disabled={isDownloading !== null}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/50 hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all"
          >
            {isDownloading === 'weekly' ? (
              <div className="w-4 h-4 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Weekly Report
          </button>
          
          <button 
            onClick={() => downloadReport('monthly')}
            disabled={isDownloading !== null}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-orange-500/20 text-slate-300 hover:text-orange-300 border border-slate-700/50 hover:border-orange-500/50 rounded-xl text-xs font-bold transition-all"
          >
            {isDownloading === 'monthly' ? (
              <div className="w-4 h-4 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Monthly Report
          </button>
        </div>
      </div>

      {/* Detailed KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 min-w-0">
        <MiniKpi title="Total Detections" value={kpi.total || 0} subtitle={`${range} alerts`} />
        <MiniKpi title="Critical Severity" value={kpi.severity_critical || 0} subtitle="Requires immediate action" alert={kpi.severity_critical > 0} />
        <MiniKpi title="High Severity" value={kpi.severity_high || 0} subtitle="Elevated risk" alert={kpi.severity_high > 0} />
        <MiniKpi title="Medium Severity" value={kpi.severity_medium || 0} subtitle="Investigate when possible" />
        <MiniKpi title="New Alerts" value={kpi.status_new || 0} subtitle="Unassigned tickets" />
        <MiniKpi title="Closed Alerts" value={kpi.status_closed || 0} subtitle="Resolved detections" />
      </div>

      {/* Charts & Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Trend Chart */}
        <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Detections Activity Trend</h3>
            <p className="text-xs text-slate-400">Total alerts over time across all profiles</p>
          </div>
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              
              <AreaChart data={
                // Transform data: group by bucket and sum values, sorted chronologically
                Object.values(trend.reduce((acc: any, curr: any) => {
                  const key = curr.bucket_start || curr.bucket;
                  if (!acc[key]) acc[key] = { bucket: curr.bucket, bucket_start: curr.bucket_start, total: 0 };
                  acc[key].total += parseInt(curr.value || 0, 10);
                  return acc;
                }, {})).sort((a: any, b: any) => (a.bucket_start || a.bucket).localeCompare(b.bucket_start || b.bucket))
              } margin={{ top: 10, right: 10, left: -20, bottom: 0 }} className="cursor-pointer" onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.bucket_start) {
                  setTableBucket(e.activePayload[0].payload.bucket_start);
                }
              }}>

                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="bucket" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="total" stroke="#f43f5e" strokeWidth={2} fill="url(#colorTotal)" activeDot={{ r: 6, fill: '#f43f5e', stroke: '#0f172a', strokeWidth: 2, className: 'cursor-pointer hover:r-[8px]', onClick: (e: any, payload: any) => { if (payload?.payload?.bucket_start) { setTableBucket(payload.payload.bucket_start); } } }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Hosts */}
        <div className="glass-card p-6 flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Top Hosts</h3>
            <p className="text-xs text-slate-400">Machines with most detections</p>
          </div>
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-3 max-h-[280px]">
            {topHosts.map((h: any, idx: number) => (
              <button key={idx} onClick={() => setDrillTarget({ dimension: 'hostname', value: h.label, label: h.label })} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all text-left group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-rose-500/20 text-rose-400">
                    {h.label ? h.label.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-sm text-slate-200 truncate" title={h.label}>{h.label || 'Unknown'}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md ml-2 border border-slate-700 shrink-0">
                  {h.value}
                </span>
              </button>
            ))}
            {topHosts.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No host data available</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Top MITRE Tactics */}
        <div className="glass-card p-6 flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Top MITRE Tactics</h3>
            <p className="text-xs text-slate-400">Most frequent attack tactics</p>
          </div>
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-3 max-h-[280px]">
            {topMitre.map((m: any, idx: number) => (
              <button key={idx} onClick={() => setDrillTarget({ dimension: 'tactic', value: m.label, label: m.label })} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all text-left group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-indigo-500/20 text-indigo-400">
                    {m.label ? m.label.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-sm text-slate-200 truncate" title={m.label}>{m.label || 'Unknown'}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md ml-2 border border-slate-700 shrink-0">
                  {m.value}
                </span>
              </button>
            ))}
            {topMitre.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No data available</p>}
          </div>
        </div>

        {/* Top Alerts */}
        <div className="glass-card p-6 flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Top Detections</h3>
            <p className="text-xs text-slate-400">Most frequent alert names</p>
          </div>
          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-3 max-h-[280px]">
            {topAlerts.map((a: any, idx: number) => (
              <button key={idx} onClick={() => setDrillTarget({ dimension: 'alert_name', value: a.label, label: a.label })} className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all text-left group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-fuchsia-500/20 text-fuchsia-400">
                    {a.label ? a.label.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-sm text-slate-200 truncate" title={a.label}>{a.label || 'Unknown'}</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md ml-2 border border-slate-700 shrink-0">
                  {a.value}
                </span>
              </button>
            ))}
            {topAlerts.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No data available</p>}
          </div>
        </div>
      </div>

      {/* Window Summary */}
      <div className="min-w-0">
        <div className="flex justify-between items-end mb-3 px-1">
          <h3 className="text-lg font-bold text-slate-100">Window Summary</h3>
          <p className="text-xs text-slate-500 font-mono">Anchored at {meta.anchor_time || meta.latest_time || 'now'}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <WindowCard 
            title="1H" 
            total={windows.totals?.total_1h} 
            server={serverProfile?.total_1h} 
            user={userProfile?.total_1h} 
          />
          <WindowCard 
            title="Today" 
            total={windows.totals?.total_today} 
            server={serverProfile?.total_today} 
            user={userProfile?.total_today}
            realtime={windows.totals?.realtime_today}
            telegram={windows.totals?.telegram_today}
          />
          <WindowCard 
            title="24H" 
            total={windows.totals?.total_24h} 
            server={serverProfile?.total_24h} 
            user={userProfile?.total_24h} 
          />
          <WindowCard 
            title="7D" 
            total={windows.totals?.total_7d} 
            server={serverProfile?.total_7d} 
            user={userProfile?.total_7d} 
          />
          <WindowCard 
            title="30D" 
            total={windows.totals?.total_30d} 
            server={serverProfile?.total_30d} 
            user={userProfile?.total_30d} 
          />
        </div>
      </div>

      {/* Log Table */}
      <div className="glass-card p-6 mt-2 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${liveStatus === 'live' ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'}`} />
            Live Audit Trail
            <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60">
              {tableBucket ? `Bucket: ${tableBucket}` : showCustomRange && customStart && customEnd ? `${customStart} to ${customEnd}` : range.toUpperCase()} ({filteredLogs.length} events)
            </span>
            {tableBucket && (
              <button onClick={() => setTableBucket(null)} className="ml-3 px-3 py-1 bg-rose-500/20 border border-rose-500/50 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-[0_0_10px_rgba(244,63,94,0.15)] flex items-center gap-1">
                Clear Filter <X size={12} />
              </button>
            )}
          </h3>
          
          {/* Local Table Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter table rows..." 
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>
        
        {/* Scrollable Table Container */}
        <div className="overflow-x-auto border border-slate-700/50 rounded-xl min-w-0">
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                <tr className="border-b border-slate-700/50 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Time</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Hostname</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Alert Name</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Severity</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">MITRE Tactic</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {filteredLogs.map((log: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">{log.event_time}</td>
                    <td className="py-2.5 px-4 text-slate-200 font-medium max-w-[150px] truncate" title={log.hostname}>{log.hostname || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px] max-w-[200px] truncate" title={log.alert_name}>{log.alert_name || '-'}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase border ${
                        log.severity === 'Critical' || log.severity === 'High' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        log.severity === 'Medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {log.severity || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-indigo-400 text-xs truncate max-w-[200px]" title={log.tactic}>
                      {log.tactic || '-'}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                      {tableSearch
                        ? 'No logs match your search filter.'
                        : tableBucket
                        ? `No events found for bucket ${tableBucket}.`
                        : `No audit events recorded within the selected ${showCustomRange ? 'custom date range' : range.toUpperCase()} window.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <DrillDownDrawer
        target={drillTarget}
        range={range}
        onClose={() => setDrillTarget(null)}
        onOpenEvent={setEventDetailId}
        onPivot={setDrillTarget}
      />
      <EventDetailDrawer
        eventId={eventDetailId}
        onClose={() => setEventDetailId(null)}
        onPivot={setDrillTarget}
      />
    </div>
    </>
  );

}

function StatusBadge({ label, value, color = 'slate' }: { label: string, value: string, color?: string }) {
  const colorMap = {
    slate: 'bg-slate-800/60 border-slate-700 text-slate-200',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  };
  
  return (
    <div className={`px-4 py-2.5 rounded-xl border flex flex-col justify-center min-w-[140px] ${colorMap[color as keyof typeof colorMap]}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">{label}</span>
      <span className="text-sm font-black tracking-wide">{value}</span>
    </div>
  );
}

function MiniKpi({ title, value, subtitle, alert }: any) {
  return (
    <div className={`glass-card p-4 flex flex-col min-w-0 overflow-hidden ${alert ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}`}>
      <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2 truncate" title={title}>{title}</h4>
      <p className={`text-2xl font-black mb-1 truncate ${alert ? 'text-rose-400' : 'text-slate-100'}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-auto truncate" title={subtitle}>{subtitle}</p>
    </div>
  );
}

function WindowCard({ title, total, server, user, realtime, telegram }: any) {
  return (
    <div className="glass-card p-5 relative overflow-hidden group hover:border-orange-500/30 transition-colors min-w-0">
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-orange-500/5 blur-xl group-hover:bg-orange-500/10 transition-all" />
      <h4 className="text-slate-100 text-sm font-black tracking-wide mb-3">{title}</h4>
      <p className="text-3xl font-black text-orange-400 mb-3">{total || 0}</p>
      <div className="space-y-1">
        <p className="text-[11px] text-slate-400 truncate">
          <span className="text-slate-300 font-medium">{server || 0}</span> server | <span className="text-slate-300 font-medium">{user || 0}</span> user
        </p>
        {(realtime !== undefined || telegram !== undefined) && (
          <p className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-300 font-medium">{realtime || 0}</span> realtime | <span className="text-slate-300 font-medium">{telegram || 0}</span> telegram
          </p>
        )}
      </div>
    </div>
  );
}












