'use client';

import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  Layers,
  Zap,
  Globe,
  Radio,
  ExternalLink,
  ArrowRight,
  TrendingUp,
  Cpu,
  Server,
  Lock,
  ArrowUpRight
} from 'lucide-react';

export interface AppRiskItem {
  name: string;
  risk: number;
  risk_label: string;
  category: string;
  is_shadow_it: boolean;
  sessions: number;
  bytes: number;
  bytes_formatted: string;
  allow_count: number;
  drop_count: number;
  top_source: string;
}

export interface AppRiskMatrixData {
  kpi?: {
    total_monitored_apps: number;
    critical_risk_count: number;
    high_risk_count: number;
    shadow_it_alerts: number;
    total_bytes_formatted: string;
  };
  risk_distribution?: Record<
    number,
    { level: string; count: number; bytes: number; apps: number }
  >;
  shadow_it_apps?: AppRiskItem[];
  applications?: AppRiskItem[];
}

interface AppIdRiskMatrixProps {
  data?: AppRiskMatrixData;
  onSelectFilter?: (filter: string) => void;
  activeFilter?: string;
}

export function AppIdRiskMatrix({ data, onSelectFilter, activeFilter }: AppIdRiskMatrixProps) {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | '5' | '4' | 'shadow' | '3' | '1-2'>('all');

  const kpi = data?.kpi || {
    total_monitored_apps: 0,
    critical_risk_count: 0,
    high_risk_count: 0,
    shadow_it_alerts: 0,
    total_bytes_formatted: '0 B',
  };

  const rawApps = data?.applications || [];
  const shadowItApps = data?.shadow_it_apps || [];

  const filteredApps = useMemo(() => {
    return rawApps.filter((app) => {
      if (riskFilter === '5' && app.risk !== 5) return false;
      if (riskFilter === '4' && app.risk !== 4) return false;
      if (riskFilter === '3' && app.risk !== 3) return false;
      if (riskFilter === '1-2' && app.risk > 2) return false;
      if (riskFilter === 'shadow' && !app.is_shadow_it) return false;

      if (!search) return true;
      const q = search.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.risk_label.toLowerCase().includes(q) ||
        app.top_source.includes(q)
      );
    });
  }, [rawApps, search, riskFilter]);

  const riskBadgeClass = (risk: number) => {
    switch (risk) {
      case 5:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
      case 4:
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold';
      case 3:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 2:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Layers size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Palo Alto App-ID Risk Matrix &amp; Shadow IT Detector
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Radio size={10} className="text-purple-400 animate-pulse" />
                  <span>L7 DEEP PACKET INSPECTION</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Heuristic classification of enterprise application risks (Risk 1-5), bandwidth usage, and unapproved Shadow IT tools.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
              Standard: <strong className="text-purple-300">Palo Alto App-ID Framework</strong>
            </span>
          </div>
        </div>

        {/* Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Cpu size={12} className="text-purple-400" />
              <span>Apps Monitored</span>
            </span>
            <div className="text-xl font-bold font-mono text-purple-300">{kpi.total_monitored_apps}</div>
            <span className="text-[10px] text-slate-500 font-mono">Recognized Protocols</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert size={12} className="text-rose-400" />
              <span>Critical (Risk 5)</span>
            </span>
            <div className="text-xl font-bold font-mono text-rose-400">{kpi.critical_risk_count}</div>
            <span className="text-[10px] text-slate-500 font-mono">Anonymizers / Miners</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle size={12} className="text-orange-400" />
              <span>High (Risk 4)</span>
            </span>
            <div className="text-xl font-bold font-mono text-orange-400">{kpi.high_risk_count}</div>
            <span className="text-[10px] text-slate-500 font-mono">Remote Admin / P2P</span>
          </div>

          <div className={`p-3.5 rounded-xl border space-y-1 ${
            shadowItApps.length > 0
              ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              : 'bg-slate-950/70 border-slate-800/80 text-emerald-300'
          }`}>
            <span className="text-[10.5px] font-mono uppercase tracking-wider flex items-center gap-1">
              <Flame size={12} className={shadowItApps.length > 0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'} />
              <span>Shadow IT Alerts</span>
            </span>
            <div className="text-xl font-bold font-mono">{shadowItApps.length}</div>
            <span className="text-[10px] text-slate-400 font-mono">Unapproved Tools Allowed</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10.5px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-teal-400" />
              <span>L7 Throughput</span>
            </span>
            <div className="text-xl font-bold font-mono text-teal-300">{kpi.total_bytes_formatted}</div>
            <span className="text-[10px] text-slate-500 font-mono">Total Volume Inspected</span>
          </div>
        </div>
      </div>

      {/* Shadow IT Warning Banner (If detected) */}
      {shadowItApps.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/50 via-slate-900/90 to-orange-950/40 border border-rose-500/40 shadow-2xl space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Flame size={18} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-200 flex items-center gap-2">
                  <span>Shadow IT Policy Alert Detected</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    UNAPPROVED TOOLS
                  </span>
                </h4>
                <p className="text-xs text-rose-300/80 font-mono">
                  The firewall policies are currently allowing unauthorized remote desktop, P2P, or circumvention applications.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold animate-pulse">
              SECURITY AUDIT REQUIRED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {shadowItApps.map((app, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono text-xs">{app.name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Risk {app.risk}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{app.category}</div>
                <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-800">
                  <span className="text-emerald-400 font-bold">{app.allow_count} Allowed</span>
                  <button
                    type="button"
                    onClick={() => onSelectFilter && onSelectFilter(`app:${app.name}`)}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Applications Table & Filter Toolbar */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers size={16} className="text-purple-400" />
              <span>Application Inventory ({filteredApps.length})</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Classified by Palo Alto Networks App-ID risk scoring, category, and network sessions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk filter selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setRiskFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  riskFilter === 'all'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Apps
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('5')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  riskFilter === '5'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Risk 5
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('4')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  riskFilter === '4'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Risk 4
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('shadow')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  riskFilter === 'shadow'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Shadow IT
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search app or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 w-44 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Application Name</th>
                <th className="py-2.5 px-3 text-center">Risk Level</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Shadow IT</th>
                <th className="py-2.5 px-3 text-right">Sessions</th>
                <th className="py-2.5 px-3 text-center">Allow / Drop</th>
                <th className="py-2.5 px-3 text-right">Bandwidth</th>
                <th className="py-2.5 px-3">Top Origin</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No applications match the selected risk filter or search query.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>{app.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${riskBadgeClass(app.risk)}`}>
                        Level {app.risk} ({app.risk_label})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{app.category}</td>
                    <td className="py-2.5 px-3 text-center">
                      {app.is_shadow_it ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          SHADOW IT
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px]">Standard</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                      {app.sessions.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{app.allow_count.toLocaleString()}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-rose-400 font-bold">{app.drop_count.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-teal-300 font-bold">
                      {app.bytes_formatted}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {app.top_source}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectFilter && onSelectFilter(`app:${app.name}`)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 text-[11px] font-mono transition-all cursor-pointer"
                        title="Filter logs by this application"
                      >
                        Filter
                      </button>
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
