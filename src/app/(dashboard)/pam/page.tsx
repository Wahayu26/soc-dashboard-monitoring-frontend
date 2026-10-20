'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLiveChannel } from '@/hooks/useLiveChannel';
import { DrillDownDrawer, EventDetailDrawer, type DrillTarget, severityClass } from '@/components/pam/PamDrawers';
import { 
  KeyRound, Users, MonitorSmartphone, AlertTriangle, ShieldCheck, Clock, X, 
  Search, ServerCrash, Activity, Send, CheckCircle2, ShieldAlert, Download, FileText
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function PamDashboard() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState('7d');
  const [search, setSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tableBucket, setTableBucket] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  
  // Custom range states
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Drawer states
  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);
  const [eventDetailId, setEventDetailId] = useState<number | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    const timeoutId = setTimeout(() => setDebouncedSearch(e.target.value), 500);
    return () => clearTimeout(timeoutId);
  };

  const downloadCsv = async (period: 'weekly' | 'monthly' | 'custom') => {
    try {
      if (period === 'custom' && (!customStart || !customEnd)) {
        alert('Please select both start and end dates.');
        return;
      }
      setIsDownloading(period);
      
      let urlStr = `/cyberark?action=export&period=${period}`;
      if (period === 'custom') {
        urlStr += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      
      const res = await api.get(urlStr, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cyberark_pam_report_${period}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download report', err);
      alert('Failed to download report.');
    } finally {
      setIsDownloading(null);
    }
  };

  const openPdfReport = (period: 'weekly' | 'monthly' | 'custom') => {
    if (period === 'custom' && (!customStart || !customEnd)) {
      alert('Please select both start and end dates.');
      return;
    }
    const params = new URLSearchParams({ period });
    if (period === 'custom') {
      params.set('start_date', customStart);
      params.set('end_date', customEnd);
    }
    window.open(`/pam/report?${params.toString()}`, '_blank');
  };

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['cyberark', range, debouncedSearch],
    queryFn: async () => {
      const res = await api.get(`/cyberark?action=summary&range=${range}&search=${encodeURIComponent(debouncedSearch)}`);
      return res.data;
    },
    refetchInterval: 60000,
  });

  const data = rawData?.data;

  const { data: tableData, isLoading: isTableLoading } = useQuery({
    queryKey: ['cyberark-table', range, tableBucket],
    queryFn: async () => {
      if (tableBucket) {
        const res = await api.get(`/cyberark?action=drilldown&dimension=bucket&value=${encodeURIComponent(tableBucket)}&range=${range}&limit=100`);
        return res.data?.data?.events || [];
      }
      return null;
    },
    enabled: !!tableBucket,
  });

  // Reverb Live Events subscription
  const liveStatus = useLiveChannel('soc.cyberark', 'pam.events', useCallback((payload: any) => {
    if (!payload?.events?.length) return;
    
    if (!debouncedSearch) {
      queryClient.setQueryData(['cyberark', range, debouncedSearch], (old: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['cyberark', range, debouncedSearch] });
    }
  }, [queryClient, range, debouncedSearch]));

  if (isLoading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-cyan-500 animate-spin animation-delay-150"></div>
          </div>
          <p className="text-violet-400 font-mono text-sm tracking-widest animate-pulse">
            LOADING PAM POSTURE...
          </p>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const meta = data?.meta || {};
  const logs = data?.logs || [];
  const trend = data?.panels?.trend || [];
  const topUsers = data?.panels?.users || [];
  const windows = data?.panels?.windows || {};
  
  const baseLogs = tableBucket ? (tableData || []) : logs;
  const filteredLogs = baseLogs.filter((log: any) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      (log.username || '').toLowerCase().includes(term) ||
      (log.target_address || '').toLowerCase().includes(term) ||
      (log.event_type || '').toLowerCase().includes(term) ||
      (log.message || '').toLowerCase().includes(term)
    );
  });

  const collectorHealthy = meta.collector_health?.ok !== false;

  return (
    <>
      <div className="flex flex-col gap-6 animate-fade-up pb-8 w-full">
        {/* Top Banner / Status */}
        <div className="glass-card p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-violet-500/5 blur-[100px]" />
          
          <div className="min-w-0 z-10">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-violet-400/80 mb-2">Privileged Access Management</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-100">
              CyberArk PAM posture in <span className="text-gradient">one view.</span>
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl">
              PSM service health, privileged sessions, WinRM reachability, and Telegram alert visibility.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 relative z-10 shrink-0">
            <StatusBadge 
              label="Feed" 
              value={liveStatus === 'live' ? 'LIVE' : liveStatus === 'connecting' ? 'SYNCING' : 'OFFLINE'} 
              color={liveStatus === 'live' ? 'cyan' : liveStatus === 'connecting' ? 'slate' : 'rose'} 
            />
            <StatusBadge label="Latest" value={meta.latest_time || 'N/A'} />
            <StatusBadge 
              label="Collector" 
              value={collectorHealthy ? 'HEALTHY' : 'DEGRADED'} 
              color={collectorHealthy ? 'emerald' : 'rose'} 
            />
          </div>
        </div>

        {/* Toolbar: Search & Range */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between w-full">
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search user, safe, target, session..." 
              value={search}
              onChange={handleSearchChange}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder:text-slate-500"
            />
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-1">
            {/* Preset Ranges */}
            <div className="flex gap-1 glass-card p-1 rounded-xl shrink-0">
              {['1h', 'today', '24h', '7d', '30d'].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setRange(r);
                    setShowCustomRange(false);
                    setTableBucket(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                    range === r && !showCustomRange
                      ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button 
              onClick={() => {
                setShowCustomRange(!showCustomRange);
                setTableBucket(null);
              }}
              className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all shrink-0 ${
                showCustomRange 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                  : 'bg-slate-800/50 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-slate-700/50 hover:border-emerald-500/50'
              }`}
            >
              Custom Range
            </button>

            {/* Export Actions */}
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => openPdfReport(showCustomRange ? 'custom' : (range === '7d' ? 'weekly' : range === '30d' ? 'monthly' : 'weekly'))}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/50 hover:border-rose-500/50 rounded-xl text-xs font-bold transition-all shrink-0"
              >
                <FileText size={14} /> PDF Report
              </button>
              
              <button 
                onClick={() => downloadCsv(showCustomRange ? 'custom' : (range === '7d' ? 'weekly' : range === '30d' ? 'monthly' : 'weekly'))}
                disabled={isDownloading !== null}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-violet-500/20 text-slate-300 hover:text-violet-300 border border-slate-700/50 hover:border-violet-500/50 rounded-xl text-xs font-bold transition-all shrink-0"
              >
                {isDownloading !== null ? (
                  <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Custom Range Inputs */}
        {showCustomRange && (
          <div className="flex items-center gap-3 p-3 glass-card rounded-xl animate-fade-down self-end border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Custom Date:</span>
            <input 
              type="date" 
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-slate-900 border border-slate-700/50 rounded-lg py-1.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input 
              type="date" 
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-slate-900 border border-slate-700/50 rounded-lg py-1.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        )}

        {/* Detailed KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 min-w-0">
          <MiniKpi title="Opened Sessions" value={kpi.opened_sessions || 0} subtitle={`${range} opened sessions`} />
          <MiniKpi 
            title="Unique Users" 
            value={kpi.unique_users || 0} 
            subtitle={`${kpi.human_users || 0} human / ${kpi.technical_identities || 0} technical`} 
          />
          <MiniKpi title="Correlated Sessions" value={kpi.distinct_sessions || 0} subtitle="Session ID / PSM processes" />
          <button className="text-left" onClick={() => setDrillTarget({ dimension: 'health', value: 'issue', label: 'Health Issues' })}>
            <MiniKpi title="Health Issues" value={kpi.service_down + kpi.winrm_errors || 0} subtitle="Service / WinRM issues" alert={kpi.service_down + kpi.winrm_errors > 0} hoverable />
          </button>
          <MiniKpi title="Recovered" value={kpi.recovered || 0} subtitle="Auto restart" />
          <MiniKpi title="PSM Created" value={kpi.created_sessions || 0} subtitle="Trace log" />
          <MiniKpi title="Telegram Sent" value={kpi.telegram || 0} subtitle="Alert delivery" />
        </div>

        {/* Charts & Top Users */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full min-w-0">
          {/* Trend Chart */}
          <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-4 min-w-0">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">Session Activity Trend</h3>
              <p className="text-xs text-slate-400">Created vs Closed Sessions over time (Click points to filter table)</p>
            </div>
            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} className="cursor-pointer" onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const b = e.activePayload[0].payload;
                    if (b && b.bucket_start) {
                      setTableBucket(b.bucket_start);
                    }
                  }
                }}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                    cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="created" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCreated)" activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#0f172a', strokeWidth: 2, className: 'cursor-pointer hover:r-[8px]', onClick: (e: any, payload: any) => { if (payload?.payload?.bucket_start) { setTableBucket(payload.payload.bucket_start); } } }} />
                  <Area type="monotone" dataKey="closed" stroke="#06b6d4" strokeWidth={2} fill="url(#colorClosed)" activeDot={{ r: 6, fill: '#06b6d4', stroke: '#0f172a', strokeWidth: 2, className: 'cursor-pointer hover:r-[8px]', onClick: (e: any, payload: any) => { if (payload?.payload?.bucket_start) { setTableBucket(payload.payload.bucket_start); } } }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Users */}
          <div className="glass-card p-6 flex flex-col gap-4 min-w-0">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Top Target Users</h3>
              <p className="text-xs text-slate-400">Most active privileged accounts</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 max-h-[280px]">
              {topUsers.map((u: any, idx: number) => (
                <button 
                  key={idx} 
                  onClick={() => setDrillTarget({ dimension: 'user', value: u.label, label: u.label })}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${u.identity_type === 'human' ? 'bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30 group-hover:text-cyan-300' : 'bg-violet-500/20 text-violet-400 group-hover:bg-violet-500/30 group-hover:text-violet-300'}`}>
                      {u.label ? u.label.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-sm text-slate-200 truncate group-hover:text-white transition-colors" title={u.label}>{u.label || 'Unknown'}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{u.identity_type || 'Unknown'}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded-md ml-2 border border-slate-700 shrink-0 group-hover:border-violet-500/30">
                    {u.value}
                  </span>
                </button>
              ))}
              {topUsers.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No user data available</p>}
            </div>
          </div>
        </div>

        {/* Window Summary */}
        <div className="min-w-0">
          <div className="flex justify-between items-end mb-3 px-1">
            <h3 className="text-lg font-bold text-slate-100">Window Summary</h3>
            <p className="text-xs text-slate-500 font-mono">Anchored at {meta.anchor_time}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <WindowCard title="1H" data={windows['1h']} />
            <WindowCard title="Today" data={windows['today']} />
            <WindowCard title="24H" data={windows['24h']} />
            <WindowCard title="7D" data={windows['7d']} />
          </div>
        </div>

        {/* Log Table */}
        <div className="glass-card p-6 mt-2 flex flex-col min-w-0 relative">
          {isTableLoading && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 shrink-0">
              <div className={`w-2 h-2 rounded-full ${liveStatus === 'live' ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'}`} />
              Live Audit Trail
              
              {tableBucket && (
                <button onClick={() => setTableBucket(null)} className="ml-3 px-3 py-1 bg-rose-500/20 border border-rose-500/50 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-[0_0_10px_rgba(244,63,94,0.15)] flex items-center gap-1">
                  Clear Filter <X size={12} />
                </button>
              )}
            </h3>
            
            {/* Local Table Search */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Filter table rows..." 
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-500"
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
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">User</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Target Address</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Event Type</th>
                    <th className="py-3 px-4 font-semibold whitespace-nowrap">Message</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-800/50">
                  {filteredLogs.map((log: any, idx: number) => (
                    <tr 
                      key={log.id || idx} 
                      onClick={() => setEventDetailId(Number(log.id))}
                      className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap group-hover:text-slate-300">{log.event_time}</td>
                      <td className="py-2.5 px-4 text-slate-200 font-medium max-w-[150px] truncate group-hover:text-white" title={log.username}>{log.username || '-'}</td>
                      <td className="py-2.5 px-4 text-cyan-400 font-mono text-[11px] max-w-[120px] truncate group-hover:text-cyan-300" title={log.target_address}>{log.target_address || '-'}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase border ${severityClass(log.severity)}`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs truncate max-w-[300px] group-hover:text-slate-300" title={log.message}>
                        {log.message || '-'}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                        {tableSearch ? 'No logs match your filter.' : 'No events found for this bucket.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* DRAWERS OUTSIDE ANIMATED FLEX CONTAINER */}
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
    </>
  );
}

function StatusBadge({ label, value, color = 'slate' }: { label: string, value: string, color?: string }) {
  const colorMap = {
    slate: 'bg-slate-800/60 border-slate-700 text-slate-200',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  };
  
  return (
    <div className={`px-4 py-2.5 rounded-xl border flex flex-col justify-center min-w-[140px] ${colorMap[color as keyof typeof colorMap]}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">{label}</span>
      <span className="text-sm font-black tracking-wide">{value}</span>
    </div>
  );
}

function MiniKpi({ title, value, subtitle, alert, hoverable }: any) {
  return (
    <div className={`glass-card p-4 flex flex-col h-full transition-all min-w-0 ${alert ? 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''} ${hoverable ? 'hover:border-violet-500/50 hover:bg-violet-500/5 cursor-pointer' : ''}`}>
      <h4 className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2 truncate">{title}</h4>
      <p className={`text-2xl font-black mb-1 truncate ${alert ? 'text-rose-400' : 'text-slate-100'}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-auto truncate">{subtitle}</p>
    </div>
  );
}

function WindowCard({ title, data }: any) {
  if (!data) return null;
  
  return (
    <div className="glass-card p-5 relative overflow-hidden group hover:border-cyan-500/30 transition-colors min-w-0">
      <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 transition-all" />
      <h4 className="text-slate-100 text-sm font-black tracking-wide mb-3">{title}</h4>
      <p className="text-3xl font-black text-cyan-400 mb-3">{data.total || 0}</p>
      <div className="space-y-1">
        <p className="text-[11px] text-slate-400 truncate">
          <span className="text-slate-300 font-medium">{data.opened || 0}</span> opened | <span className="text-slate-300 font-medium">{data.created || 0}</span> created | <span className="text-slate-300 font-medium">{data.closed || 0}</span> closed
        </p>
        <p className="text-[11px] text-slate-400 truncate">
          <span className="text-slate-300 font-medium">{data.unique_users || 0}</span> users | <span className="text-slate-300 font-medium">{data.distinct_sessions || 0}</span> correlated sessions
        </p>
      </div>
    </div>
  );
}




