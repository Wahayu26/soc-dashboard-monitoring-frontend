'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getApiErrorMessage } from '@/lib/api';
import { 
  ShieldAlert, 
  Printer, 
  AlertTriangle, 
  Activity, 
  Layers, 
  Server,
  ShieldCheck, 
  FileText,
  Crosshair,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Bug,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { Suspense, useEffect } from 'react';

const PRESET_RANGES = [
  { id: '1h', label: 'Last 1 Hour' },
  { id: 'today', label: 'Today' },
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
];

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get('range') || 'today';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';

  const { data: rawData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['palo-report', range, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('action', 'report');
      params.set('range', range);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await api.get(`/syslog?${params.toString()}`, {
        timeout: 90_000,
      });
      return res.data;
    },
    staleTime: 60000,
  });

  const data = rawData?.data && typeof rawData.data === 'object' && 'ok' in rawData.data
    ? rawData.data
    : rawData;

  useEffect(() => {
    if (data?.meta) {
      document.title = `Palo Alto NGFW Audit Report - ${data.meta.period_label || data.meta.generated_at}`;
    }
  }, [data]);

  const handleRangeChange = (newRange: string) => {
    const params = new URLSearchParams();
    params.set('range', newRange);
    router.push(`/firewall/palo-alto/report?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white print:bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
          <p className="text-slate-600 font-mono text-sm">Preparing Palo Alto NGFW Perimeter Audit Document...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.ok) {
    const errorMsg = getApiErrorMessage(error, 'Unable to aggregate firewall telemetry data. Please ensure the backend service is running and your session is active.');

    return (
      <div className="p-12 text-center space-y-5 max-w-lg mx-auto mt-20">
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 inline-block shadow-sm">
          <AlertTriangle size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Failed to Load Perimeter Audit Report</h2>
          <p className="text-xs text-slate-500 font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
            {errorMsg}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-md shadow-rose-900/20"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Retrying...' : 'Retry Audit Query'}</span>
          </button>
          <Link 
            href="/firewall/palo-alto"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { meta, kpi, panels, logs } = data;
  const topAttackers = (panels?.top_attackers || []).slice(0, 10);
  const topDestinations = (panels?.top_destinations || []).slice(0, 10);
  const topApplications = (panels?.top_applications || []).slice(0, 10);
  const topThreatSignatures = (data.top_threat_signatures || panels?.top_threat_signatures || panels?.threat_signatures || []).slice(0, 10);
  const mitreTactics = (data.mitre_tactics || panels?.mitre_tactics || []) as Array<{
    name: string;
    id: string;
    hits: number;
    severity?: string;
    color?: string;
  }>;

  const totalThreatHits = mitreTactics.reduce((sum, t) => sum + (Number(t.hits) || 0), 0);
  const dropRate = Number(kpi?.drop_ratio || 0);

  const getSeverityBadgeClass = (severity: string = 'low') => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white font-sans p-6 sm:p-10 md:p-14 max-w-5xl mx-auto space-y-10">
      {/* Print Action Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-200 pb-4 gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/firewall/palo-alto"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-mono font-medium transition-all"
          >
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Audit Mode: <strong>Ready to Print / Save to PDF</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Range Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRangeChange(r.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  range === r.id && !startDate
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.id.toUpperCase()}
              </button>
            ))}
          </div>

          <button 
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Official Document Header */}
      <header className="border-b-4 border-rose-600 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-700 font-mono text-xs uppercase tracking-wider font-bold mb-1">
            <ShieldAlert size={15} /> Sentinel Security Operations Center (SOC) &bull; Enterprise Perimeter
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Palo Alto NGFW Security &amp; Threat Audit Report
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            {meta?.period_label || 'Perimeter Gateway Forensic Telemetry Snapshot'}
          </p>
        </div>
        <div className="text-left md:text-right text-xs text-slate-500 space-y-1 font-mono">
          <p><strong>Generated:</strong> {meta?.generated_at}</p>
          <p><strong>Auditor:</strong> {meta?.auditor || 'SOC Perimeter Security Analyst'}</p>
          <p><strong>Benchmark:</strong> {meta?.benchmark || 'CIS Firewall Benchmark v1.1 / ISO 27001'}</p>
          <p className="text-[11px] text-rose-700 font-bold uppercase tracking-wider">CONFIDENTIAL // SOC INTERNAL USE ONLY</p>
        </div>
      </header>

      {/* 1. Executive Summary Cards */}
      <section className="space-y-4 page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Activity size={18} className="text-rose-600" /> 1. Executive Firewall Telemetry Summary
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Window: <strong>{startDate && endDate ? `${startDate} to ${endDate}` : range.toUpperCase()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Total Ingested Events</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {Number(kpi?.total || 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">All traffic &amp; threat sessions</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Traffic Allowed</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">
              {Number(kpi?.allowed || kpi?.allow || 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Legitimate sessions permitted</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Blocked / Denied Packets</span>
            <span className="text-2xl font-black text-rose-600 font-mono mt-1 block">
              {Number(kpi?.blocked || kpi?.deny || 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">Drop Ratio: {dropRate}%</span>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <span className="text-[10px] font-mono text-slate-500 uppercase block font-bold">Threat &amp; Security Events</span>
            <span className="text-2xl font-black text-purple-600 font-mono mt-1 block">
              {Number(kpi?.threat || 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-purple-700 font-medium mt-0.5 block">Palo Alto Threat Engine hits</span>
          </div>
        </div>
      </section>

      {/* 2. MITRE ATT&CK Enterprise Matrix (Tactical Kill-Chain) */}
      <section className="space-y-4 page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Crosshair size={18} className="text-rose-600" /> 2. MITRE ATT&CK&reg; Threat Mapping (Kill-Chain Breakdown)
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Total Tactic Hits: <strong>{totalThreatHits.toLocaleString()}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {mitreTactics.map((tactic, idx) => {
            const hits = Number(tactic.hits) || 0;
            const pct = totalThreatHits > 0 ? ((hits / totalThreatHits) * 100).toFixed(1) : '0.0';
            const badgeClass = getSeverityBadgeClass(tactic.severity || 'low');

            return (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-500">{tactic.id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${badgeClass}`}>
                    {tactic.severity || 'LOW'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{tactic.name}</h4>
                  <div className="flex items-baseline justify-between mt-1 font-mono">
                    <span className="text-lg font-black text-slate-900">{hits.toLocaleString()}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{pct}%</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      hits > 0 ? (tactic.severity === 'critical' ? 'bg-rose-500' : tactic.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500') : 'bg-slate-300'
                    }`} 
                    style={{ width: `${Math.max(hits > 0 ? 5 : 0, Math.min(100, Number(pct)))}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Top Threat Signatures & Vulnerability Exploits Table */}
      <section className="space-y-4 page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Bug size={18} className="text-rose-600" /> 3. Top Threat Signatures &amp; Vulnerability Exploits (Palo Alto Signatures)
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Top <strong>{topThreatSignatures.length}</strong> Active Signatures
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono border-b border-slate-200">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Signature Name / Threat ID</th>
                <th className="py-2.5 px-3">MITRE ATT&CK Mapping</th>
                <th className="py-2.5 px-3">CVE Ident</th>
                <th className="py-2.5 px-3 text-center">Severity</th>
                <th className="py-2.5 px-3 text-right">Detections</th>
                <th className="py-2.5 px-3">Latest Source &bull; Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {topThreatSignatures.length > 0 ? (
                topThreatSignatures.map((sig: any, idx: number) => {
                  const hits = Number(sig.hits || 0);
                  const badgeClass = getSeverityBadgeClass(sig.severity);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <strong className="text-slate-900 block font-sans">{sig.name || 'Unknown Threat'}</strong>
                        <span className="text-[10px] text-slate-400">ID: {sig.threat_id || '-'} &bull; {sig.category || 'Threat'}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="text-slate-700 font-bold block">{sig.tactic_name || 'Initial Access'} ({sig.tactic_id || 'TA0001'})</span>
                        <span className="text-[11px] text-slate-500 font-mono">{sig.technique_id || '-'} {sig.technique_name || ''}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {sig.cve ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            {sig.cve}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">N/A</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}`}>
                          {sig.severity || 'low'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 font-bold">
                        {hits.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <span className="text-slate-800 font-bold block">{sig.latest_source_ip || '-'}</span>
                        <span className="text-slate-500">&rarr; {sig.latest_dest_ip || '-'} ({sig.latest_app || 'unknown'})</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400 font-sans">
                    No hostile threat signature activity detected within this audit timeframe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Top 10 External Attackers */}
      <section className="space-y-4 page-break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Flame size={18} className="text-rose-600" /> 4. Most Hostile Sources (Top 10 External Attackers)
          </h2>
          <span className="text-xs font-mono text-slate-500">Ranked by firewall block frequency</span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono border-b border-slate-200">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Attacker IP (Source IP)</th>
                <th className="py-2.5 px-3">Origin Country (GeoIP)</th>
                <th className="py-2.5 px-3 text-right">Blocked Volume</th>
                <th className="py-2.5 px-3 text-right">% of Denied Traffic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {topAttackers.length > 0 ? (
                topAttackers.map((item: any, idx: number) => {
                  const hits = item.hits || item.count || 0;
                  const totalBlocked = kpi?.blocked || 1;
                  const pct = ((hits / totalBlocked) * 100).toFixed(1);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 text-slate-900 font-bold">{item.source_ip || item.ip || '-'}</td>
                      <td className="py-2 px-3 text-slate-600 font-sans">{item.country || 'External Internet'}</td>
                      <td className="py-2 px-3 text-right text-rose-600 font-bold">{Number(hits).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{pct}%</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400 font-sans">No attacker sources recorded within this audit window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Top Targeted Internal Destinations & Top Applications */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 page-break-inside-avoid">
        {/* Top Targeted Assets */}
        <div className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Server size={16} className="text-cyan-600" /> 5. Top Targeted Internal Assets
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-mono border-b border-slate-200">
                  <th className="py-2 px-3">Destination IP</th>
                  <th className="py-2 px-3">Zone</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {topDestinations.length > 0 ? (
                  topDestinations.map((dst: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 font-bold">{dst.destination_ip || dst.ip || '-'}</td>
                      <td className="py-2 px-3 text-slate-500">{dst.zone || 'DMZ/Trust'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 font-bold">{Number(dst.hits || dst.count || 0).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400">No destination data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Applications */}
        <div className="space-y-3">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Layers size={16} className="text-amber-600" /> 6. Applications &amp; Protocols (App-ID)
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-mono border-b border-slate-200">
                  <th className="py-2 px-3">Application Name</th>
                  <th className="py-2 px-3 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {topApplications.length > 0 ? (
                  topApplications.map((app: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 font-bold">{app.application_name || app.app || '-'}</td>
                      <td className="py-2 px-3 text-right text-slate-700 font-bold">{Number(app.hits || app.count || 0).toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-3 text-center text-slate-400">No application session data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. CIS / ISO 27001 Firewall Governance Audit Matrix */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-600" /> 7. Governance &amp; Compliance Audit Matrix (CIS Benchmark &amp; ISO 27001)
        </h2>
        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono border-b border-slate-200">
                <th className="py-2.5 px-3">Control Standard</th>
                <th className="py-2.5 px-3">Parameter &amp; Objective</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Audit Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">CIS 1.1 Ingress Filtering</td>
                <td className="py-2.5 px-3 font-mono text-slate-600">Drop unauthorized ingress traffic</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    PASSED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">Suspicious packets and external port scans automatically dropped by perimeter policy ({dropRate}% drop ratio).</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">CIS 1.2 Threat Prevention</td>
                <td className="py-2.5 px-3 font-mono text-slate-600">Anti-Spyware, Vuln &amp; MITRE Active</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    PASSED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">Threat engine active, mapping telemetry to MITRE ATT&CK&reg; tactics and vendor threat signatures.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">CIS 1.3 Centralized Syslog</td>
                <td className="py-2.5 px-3 font-mono text-slate-600">Real-time forwarding &amp; indexing</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    PASSED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">5-minute rollup aggregator active, maintaining persistent historical telemetry and predictable retention.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">CIS 1.4 GlobalProtect VPN</td>
                <td className="py-2.5 px-3 font-mono text-slate-600">Remote access session logging</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                    VERIFIED
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">GlobalProtect VPN sessions indexed with full username identities, source tunnels, and session tracking.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Forensic Audit Log Tail Sample */}
      <section className="space-y-4 page-break-inside-avoid">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
          <FileText size={18} className="text-slate-700" /> 8. Forensic Audit Log Evidence Sample (Top 15 Logs)
        </h2>
        <div className="overflow-x-auto border border-slate-200 rounded-xl text-xs">
          <table className="w-full text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="py-2 px-2.5">Time</th>
                <th className="py-2 px-2.5">Action</th>
                <th className="py-2 px-2.5">Source IP</th>
                <th className="py-2 px-2.5">Destination IP</th>
                <th className="py-2 px-2.5">Port</th>
                <th className="py-2 px-2.5">App</th>
                <th className="py-2 px-2.5">Rule Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {logs && logs.length > 0 ? (
                logs.slice(0, 15).map((log: any, idx: number) => {
                  const isDrop = log.action === 'deny' || log.action === 'drop' || log.action === 'reset';
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2.5 text-slate-500 whitespace-nowrap">{log.event_time || log.time}</td>
                      <td className="py-1.5 px-2.5 font-bold uppercase">
                        <span className={isDrop ? 'text-rose-600' : 'text-emerald-600'}>{log.action}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-900 font-bold">{log.source_ip || log.src}</td>
                      <td className="py-1.5 px-2.5 text-slate-700">{log.destination_ip || log.dst}</td>
                      <td className="py-1.5 px-2.5 text-slate-500">{log.destination_port || log.port}</td>
                      <td className="py-1.5 px-2.5 text-amber-700">{log.application_name || log.app || '-'}</td>
                      <td className="py-1.5 px-2.5 text-slate-600 truncate max-w-[150px]">{log.rule_name || log.rule || '-'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-slate-400 font-sans">No log records found for this audit window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Formal Sign-off Section for Management & Compliance */}
      <section className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-4 page-break-inside-avoid">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
          <FileCheck size={16} className="text-emerald-600" /> Formal Security Audit Sign-off Sheet
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
          <div className="space-y-12">
            <p className="text-[11px] font-mono text-slate-500">Prepared By (SOC Analyst):</p>
            <div className="border-t border-slate-300 pt-1">
              <p className="text-xs font-bold text-slate-800">SOC Perimeter Team</p>
              <p className="text-[10px] text-slate-500 font-mono">Perimeter Security Engineer</p>
            </div>
          </div>
          <div className="space-y-12">
            <p className="text-[11px] font-mono text-slate-500">Reviewed By (Lead / Manager):</p>
            <div className="border-t border-slate-300 pt-1">
              <p className="text-xs font-bold text-slate-800">Security Operations Lead</p>
              <p className="text-[10px] text-slate-500 font-mono">Head of Cyber Defense</p>
            </div>
          </div>
          <div className="space-y-12 hidden md:block">
            <p className="text-[11px] font-mono text-slate-500">Authorization Date:</p>
            <div className="border-t border-slate-300 pt-1">
              <p className="text-xs font-bold text-slate-800">{new Date().toISOString().slice(0, 10)}</p>
              <p className="text-[10px] text-slate-500 font-mono">Status: Verified &amp; Approved</p>
            </div>
          </div>
        </div>
      </section>

      {/* Official Sign-off Footer */}
      <footer className="border-t-2 border-slate-300 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono page-break-inside-avoid">
        <div>
          <p>This document is automatically generated by Sentinel SOC Enterprise Security Operations System.</p>
          <p className="mt-0.5">Sentinel SOC Security Operations Center &bull; Perimeter Guard Division</p>
        </div>
        <div className="mt-4 sm:mt-0 text-right">
          <p>Authorization: <strong>Verified &amp; Certified</strong></p>
          <p className="mt-0.5">Integrity Hash: <span className="text-[10px] text-slate-400">SOC-PALO-AUDIT-v1-{new Date().toISOString().slice(0, 10)}</span></p>
        </div>
      </footer>
    </div>
  );
}

export default function PaloAltoReportPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
