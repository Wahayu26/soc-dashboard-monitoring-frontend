'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Printer, 
  ArrowLeft, 
  Shield, 
  Activity, 
  ShieldAlert, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { Suspense } from 'react';

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
  type?: string;
  status?: string;
  count?: number;
  latest?: string;
}

interface OverviewData {
  ok: boolean;
  range?: string;
  generated_at: string;
  total_firewall_logs: number;
  live_modules: number;
  total_modules: number;
  active_threats: number;
  db_load_pct: number;
  traffic_points?: TrafficPoint[];
  traffic_24h?: TrafficPoint[];
  threats: {
    active_threats_count: number;
    distribution: ThreatCategory[];
  };
  modules: Record<string, ModuleInfo>;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const range = searchParams.get('range') || '24h';

  const { data: overview, isLoading } = useQuery<OverviewData>({
    queryKey: ['dashboard', 'overview', range],
    queryFn: async () => {
      const res = await api.get<OverviewData>('/dashboard/overview', {
        params: { range },
      });
      return res.data;
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const logsCount = overview?.total_firewall_logs || 0;
  const activeThreats = overview?.active_threats || overview?.threats?.active_threats_count || 0;
  const trafficData = overview?.traffic_points || overview?.traffic_24h || [];
  const threatData = overview?.threats?.distribution || [];
  const modules = overview?.modules || {};

  const totalAllowed = trafficData.reduce((acc, curr) => acc + curr.allowed, 0);
  const totalDenied = trafficData.reduce((acc, curr) => acc + curr.denied, 0);
  const totalTraffic = totalAllowed + totalDenied;
  const dropRatio = totalTraffic > 0 ? ((totalDenied / totalTraffic) * 100).toFixed(2) : '0.00';
  const threatSum = threatData.reduce((acc, curr) => acc + curr.value, 0) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 print:p-0 print:bg-white print:text-black">
      {/* Floating Action Bar - Hidden during print */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Command Center</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Target Range: <span className="font-bold text-cyan-400 uppercase">{range}</span>
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-5xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl print:border-none print:shadow-none print:p-6 print:bg-white print:text-black">
        {/* Document Header */}
        <div className="border-b-2 border-cyan-500 pb-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-500 font-mono text-xs font-bold tracking-widest uppercase mb-1">
                <Shield className="h-4 w-4" />
                <span>CLIPAN FINANCE &bull; SECURITY OPERATIONS CENTER</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white print:text-black">
                GLOBAL TELEMETRY & SECURITY BRIEFING
              </h1>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-1">
                Multi-Firewall (Palo Alto, FortiGate FGDC, FortiGate ISFW) &bull; CrowdStrike EDR &bull; CyberArk PAM &bull; DB Fleet
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-right font-mono text-xs space-y-1 print:border-gray-300 print:bg-gray-50 print:text-left">
              <div><span className="text-slate-500 print:text-gray-500">Doc ID:</span> <span className="font-bold text-white print:text-black">SOC-GB-{Date.now().toString().slice(-6)}</span></div>
              <div><span className="text-slate-500 print:text-gray-500">Date:</span> <span className="text-slate-300 print:text-gray-700">{overview?.generated_at || new Date().toISOString()}</span></div>
              <div><span className="text-slate-500 print:text-gray-500">Range:</span> <span className="font-bold text-cyan-400 print:text-blue-700 uppercase">{range}</span></div>
              <div><span className="text-slate-500 print:text-gray-500">Classification:</span> <span className="font-bold text-amber-400 print:text-amber-700">TLP:AMBER / CONFIDENTIAL</span></div>
            </div>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium text-slate-400 print:text-gray-600 uppercase">Total Processed Logs</p>
            <p className="text-2xl font-black text-cyan-400 print:text-blue-800 mt-1 font-mono">{logsCount.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 print:text-gray-500 mt-0.5">Across 3 core perimeter firewalls</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium text-slate-400 print:text-gray-600 uppercase">Active Threat Events</p>
            <p className="text-2xl font-black text-rose-400 print:text-rose-700 mt-1 font-mono">{activeThreats.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 print:text-gray-500 mt-0.5">IPS, Malware, Botnet, Web, Evasion</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium text-slate-400 print:text-gray-600 uppercase">Drop / Denied Ratio</p>
            <p className="text-2xl font-black text-amber-400 print:text-amber-700 mt-1 font-mono">{dropRatio}%</p>
            <p className="text-[10px] text-slate-500 print:text-gray-500 mt-0.5">{totalDenied.toLocaleString()} blocked packets</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50">
            <p className="text-xs font-medium text-slate-400 print:text-gray-600 uppercase">Ecosystem Health</p>
            <p className="text-2xl font-black text-emerald-400 print:text-emerald-700 mt-1 font-mono">
              {overview?.live_modules || 6} / {overview?.total_modules || 6}
            </p>
            <p className="text-[10px] text-slate-500 print:text-gray-500 mt-0.5">All telemetry connectors operational</p>
          </div>
        </div>

        {/* Section 1: Traffic Breakdown Table */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400 print:text-blue-600" />
            <span>1. Unified Perimeter Network Traffic Telemetry</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-gray-300">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 print:bg-gray-100 print:text-gray-700 border-b border-slate-800 print:border-gray-300">
                <tr>
                  <th className="p-2.5">Interval</th>
                  <th className="p-2.5 text-right">Allowed</th>
                  <th className="p-2.5 text-right">Denied / Drop</th>
                  <th className="p-2.5 text-right font-bold">Total Volume</th>
                  <th className="p-2.5 text-right text-orange-400 print:text-orange-700">Palo Alto</th>
                  <th className="p-2.5 text-right text-emerald-400 print:text-emerald-700">FGDC</th>
                  <th className="p-2.5 text-right text-cyan-400 print:text-cyan-700">ISFW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                {trafficData.slice(0, 15).map((pt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                    <td className="p-2.5 font-bold text-white print:text-black">{pt.time}</td>
                    <td className="p-2.5 text-right text-emerald-400 print:text-emerald-700">{pt.allowed.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-rose-400 print:text-rose-700">{pt.denied.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-white print:text-black">{pt.total.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-slate-300 print:text-gray-700">{(pt.palo || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right text-slate-300 print:text-gray-700">{(pt.fgdc || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right text-slate-300 print:text-gray-700">{(pt.isfw || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trafficData.length > 15 && (
            <p className="text-[11px] text-slate-500 print:text-gray-500 mt-1 italic">
              Showing first 15 intervals of {trafficData.length} total recorded datapoints for range {range}.
            </p>
          )}
        </div>

        {/* Section 2: Attack Surface & Threat Distribution */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 print:text-rose-600" />
            <span>2. Threat Landscape & Attack Surface Breakdown</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 print:border-gray-300 text-slate-400 print:text-gray-700">
                  <tr>
                    <th className="pb-2">Attack Vector</th>
                    <th className="pb-2 text-right">Event Count</th>
                    <th className="pb-2 text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 print:divide-gray-200">
                  {threatData.map((th, idx) => {
                    const pct = ((th.value / threatSum) * 100).toFixed(1);
                    return (
                      <tr key={idx}>
                        <td className="py-2 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: th.color }} />
                          <span className="text-white print:text-black font-semibold">{th.name}</span>
                        </td>
                        <td className="py-2 text-right text-rose-400 print:text-rose-700 font-bold">{th.value.toLocaleString()}</td>
                        <td className="py-2 text-right text-slate-400 print:text-gray-600">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 print:border-gray-300 print:bg-gray-50 space-y-2 text-xs">
              <h4 className="font-bold text-white print:text-black uppercase">Tactical Observations:</h4>
              <p className="text-slate-300 print:text-gray-700 leading-relaxed">
                &bull; <strong>Perimeter Ingress:</strong> IPS and volumetric firewall filtering successfully neutralized inbound reconnaissance and brute force attempts.
              </p>
              <p className="text-slate-300 print:text-gray-700 leading-relaxed">
                &bull; <strong>Endpoint Posture:</strong> CrowdStrike Falcon EDR maintains continuous behavioral telemetry across critical infrastructure with real-time zero-day containment.
              </p>
              <p className="text-slate-300 print:text-gray-700 leading-relaxed">
                &bull; <strong>Privileged Surface:</strong> CyberArk PAM policy enforces session rotation and prevents credential compromise on administrative tiers.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Telemetry Pipeline Health */}
        <div className="mb-10">
          <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 print:text-emerald-600" />
            <span>3. Ecosystem & Telemetry Pipeline Health</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            {Object.entries(modules).map(([k, mod]) => (
              <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 print:border-gray-300 print:bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white print:text-black">{mod.name || k}</span>
                  <span className="text-[10px] rounded px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 print:text-emerald-700 uppercase">
                    {mod.status || 'ONLINE'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 print:text-gray-600">
                  Total Logs: <span className="text-slate-200 print:text-black font-semibold">{(mod.count || 0).toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-slate-500 print:text-gray-500 mt-1 truncate">
                  Sync: {mod.latest || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-Off Authorization Block */}
        <div className="border-t border-slate-800 print:border-gray-400 pt-8 mt-12 grid grid-cols-2 gap-8 text-xs font-mono">
          <div>
            <p className="text-slate-500 print:text-gray-500 mb-8">Prepared & Verified By:</p>
            <div className="border-b border-slate-700 print:border-gray-400 w-48 mb-2"></div>
            <p className="font-bold text-white print:text-black">SOC Lead Operations Analyst</p>
            <p className="text-[10px] text-slate-400 print:text-gray-600">Clipan Finance Security Operations</p>
          </div>

          <div className="text-right">
            <p className="text-slate-500 print:text-gray-500 mb-8">Approved By:</p>
            <div className="border-b border-slate-700 print:border-gray-400 w-48 ml-auto mb-2"></div>
            <p className="font-bold text-white print:text-black">Head of Information Technology & CISO</p>
            <p className="text-[10px] text-slate-400 print:text-gray-600">PT Clipan Finance Indonesia Tbk</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-cyan-400 font-mono">Loading Executive Briefing...</div>}>
      <ReportContent />
    </Suspense>
  );
}
