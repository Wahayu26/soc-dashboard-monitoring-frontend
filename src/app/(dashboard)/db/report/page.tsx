'use client';

import { useQuery } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { 
  Database, 
  Printer, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  HardDrive, 
  Server, 
  Clock, 
  FileText,
  CheckCircle2,
  XCircle,
  Zap,
  Lock,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';

function ReportContent() {
  const { data: rawData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['db-report'],
    queryFn: async () => {
      const res = await api.get('/db-monitor?action=report', { timeout: 90_000 });
      return res.data;
    },
    staleTime: 30000,
  });

  // Handle both { ok: true, ... } and { success: true, data: { ok: true, ... } } payload shapes
  const data = rawData?.data && typeof rawData.data === 'object' && 'ok' in rawData.data ? rawData.data : rawData;

  useEffect(() => {
    if (data?.meta) {
      document.title = `Database SOC Audit Report - ${data.meta.generated_at}`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white print:bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-slate-600 font-mono text-sm">Preparing Database SOC Audit Report...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    const errorDetails = error ? getApiErrorMessage(error) : (data?.error || data?.msg || 'Unable to gather telemetry response.');

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
        <div className="p-8 text-center space-y-5 max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-400 inline-block border border-rose-500/20">
            <AlertTriangle size={36} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Failed to Load Audit Report</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Unable to gather database fleet telemetry. Verify that the backend service is running and database hosts are reachable.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs font-mono text-rose-300 break-words">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Diagnostic Detail</span>
            {errorDetails}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/db"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back to DB Monitor</span>
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold font-mono transition-all shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              <span>{isFetching ? 'Retrying...' : 'Retry Audit Query'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { meta, kpi, servers, findings, top_queries } = data;

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white font-sans p-6 sm:p-10 md:p-14 max-w-5xl mx-auto space-y-10">
      {/* Print Action Bar (Hidden when printing) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/db"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono transition-all"
          >
            <ArrowLeft size={13} />
            <span>DB Monitor</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Status: Ready to Print / Export PDF
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Official Document Header */}
      <header className="border-b-4 border-cyan-600 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-700 font-mono text-xs uppercase tracking-wider font-bold mb-1">
            <Database size={15} /> Sentinel Security Operations Center (SOC)
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Database Observability &amp; Security Audit Report
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            {meta?.period_label || 'Enterprise Infrastructure Snapshot'}
          </p>
        </div>
        <div className="text-left md:text-right text-xs text-slate-500 space-y-1 font-mono">
          <p><strong>Generated:</strong> {meta?.generated_at}</p>
          <p><strong>Auditor:</strong> {meta?.auditor}</p>
          <p><strong>Standard:</strong> {meta?.benchmark}</p>
          <p className="text-[11px] text-slate-400">Classification: INTERNAL / STRICT CONFIDENTIAL</p>
        </div>
      </header>

      {/* Section 1: Executive Summary KPIs */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
          <Activity size={18} className="text-cyan-600" /> Database Fleet Executive Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Fleet Availability</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {kpi?.online_nodes} / {kpi?.total_nodes} <span className="text-xs text-emerald-600 font-bold">Nodes Online</span>
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Throughput</span>
            <span className="text-xl font-black text-cyan-700 mt-1 block">
              {Number(kpi?.total_qps || 0).toLocaleString()} <span className="text-xs text-slate-500 font-normal">QPS</span>
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Connections</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {kpi?.total_connections} <span className="text-xs text-slate-500 font-normal">/ {kpi?.total_max_connections}</span>
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Fleet Security Score</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {kpi?.avg_score} <span className="text-xs font-bold text-cyan-600">[GRADE {kpi?.avg_grade}]</span>
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Fleet Inventory & Performance Table */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
          <Server size={18} className="text-cyan-600" /> Instance Performance &amp; Capacity Matrix
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                <th className="p-3">Instance Name</th>
                <th className="p-3">Engine</th>
                <th className="p-3">Host : Port</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Throughput (QPS)</th>
                <th className="p-3 text-right">Connections (Active / Limit)</th>
                <th className="p-3 text-center">Buffer Hit Rate</th>
                <th className="p-3 text-center">Security Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {(servers || []).map((s: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{s.name}</td>
                  <td className="p-3 uppercase text-slate-600">{s.type}</td>
                  <td className="p-3 text-slate-500">{s.host}:{s.port}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.online ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {s.online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-800">
                    {Number(s.qps || 0).toFixed(1)}
                  </td>
                  <td className="p-3 text-right text-slate-600">
                    {s.connections} / {s.max_connections} ({s.conn_utilization_pct}%)
                  </td>
                  <td className="p-3 text-center text-slate-700">
                    {s.buffer_hit_rate}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      s.score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                      s.score >= 65 ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {s.score}/100 ({s.grade})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Security & Configuration Audit Findings */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
          <ShieldCheck size={18} className="text-cyan-600" /> Security Posture &amp; CIS Compliance Findings ({findings?.length || 0} Findings)
        </h2>
        {(!findings || findings.length === 0) ? (
          <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-3">
            <CheckCircle2 size={24} className="shrink-0" />
            <div>
              <span className="font-bold block">All Compliance Policies Passed (100% Compliant)</span>
              No deviations or configuration vulnerabilities detected across the audited database fleet.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {findings.map((f: any, idx: number) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  f.status === 'FAIL' 
                    ? 'border-rose-300 bg-rose-50/50' 
                    : 'border-amber-300 bg-amber-50/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      f.status === 'FAIL' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {f.status}
                    </span>
                    <span className="font-bold text-slate-900">{f.server}</span>
                    <span className="text-slate-500 uppercase text-[10px]">[{f.category}]</span>
                    <span className="font-sans font-bold text-slate-800">&bull; {f.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Detected Value: <strong className="text-slate-900">{f.value}</strong>
                  </div>
                </div>

                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {f.description}
                </p>

                {f.recommendation && (
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-800 font-mono">
                    <strong className="text-amber-800 block mb-0.5">💡 Remediation Guidance:</strong>
                    {f.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Top Heavy Queries Profiler Highlights */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
          <Zap size={18} className="text-cyan-600" /> Top Heavy Query Digest Summary (Performance Profiler)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono text-[11px] uppercase border-b border-slate-200">
                <th className="p-3">Rank</th>
                <th className="p-3">Instance</th>
                <th className="p-3 text-right">Exec Count</th>
                <th className="p-3 text-right">Total Time</th>
                <th className="p-3 text-right">Avg Latency</th>
                <th className="p-3">Query Statement Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {(top_queries || []).map((q: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">#{idx + 1}</td>
                  <td className="p-3 text-slate-700 font-semibold">{q.server}</td>
                  <td className="p-3 text-right">{Number(q.exec_count || 1).toLocaleString()}x</td>
                  <td className="p-3 text-right font-bold text-amber-700">
                    {Number(q.total_sec || 0).toFixed(1)}s
                  </td>
                  <td className="p-3 text-right text-slate-600">
                    {Number(q.avg_ms || 0).toFixed(1)}ms
                  </td>
                  <td className="p-3 text-slate-600 max-w-md truncate" title={q.query_text}>
                    {String(q.query_text || '').replace(/\s+/g, ' ').slice(0, 100)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formal Audit Sign-Off Footer */}
      <footer className="pt-8 border-t-2 border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500 font-mono">
        <div>
          <p>Prepared by: <strong>Security Operations Center (SOC) &amp; Database Engineering</strong></p>
          <p>Platform: Sentinel Observability &amp; Security Platform &bull; Confidential Corporate Document</p>
        </div>
        <div className="text-left sm:text-right">
          <p>Page 1 of 1 &bull; Audit Status: VERIFIED</p>
          <p className="text-[10px] text-slate-400">UUID: {Math.random().toString(36).substring(2, 12).toUpperCase()}</p>
        </div>
      </footer>
    </div>
  );
}

export default function DbReportPage() {
  return (
    <Suspense fallback={<div className="p-10 font-mono text-sm">Preparing audit report document...</div>}>
      <ReportContent />
    </Suspense>
  );
}
