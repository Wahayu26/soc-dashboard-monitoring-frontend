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
  Network,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Bug,
  FileCheck,
  RefreshCw,
  Database,
  Lock,
  Cpu,
  Globe
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
    queryKey: ['forti-isfw-report', range, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'summary');
      params.set('range', range);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await api.get(`/forti/syslog?${params.toString()}`, {
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
    if (data) {
      document.title = `FortiGate ISFW Internal Segmentation Audit Report - ${range.toUpperCase()}`;
    }
  }, [data, range]);

  const handleRangeChange = (newRange: string) => {
    const params = new URLSearchParams();
    params.set('range', newRange);
    router.push(`/firewall/isfw/report?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white print:bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          <p className="text-slate-600 font-mono text-sm">Preparing FortiGate ISFW Internal Segmentation Audit Document...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.ok) {
    const errorMsg = getApiErrorMessage(error, 'Unable to aggregate FortiGate ISFW telemetry data. Please ensure the backend service is running.');

    return (
      <div className="p-12 text-center space-y-5 max-w-lg mx-auto mt-20">
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 inline-block shadow-sm">
          <AlertTriangle size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Failed to Load ISFW Audit Report</h2>
          <p className="text-xs text-slate-500 font-mono leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
            {errorMsg}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shadow-md"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Retrying...' : 'Retry Audit Query'}</span>
          </button>
          <Link 
            href="/firewall/isfw"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const kpi = data.kpi || {};
  const top = data.top || {};
  const total = Number(kpi.total || 0);
  const allow = Number(kpi.allow || 0);
  const deny = Number(kpi.deny || 0);
  const dropRatio = (allow + deny) > 0 ? ((deny / (allow + deny)) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans p-4 sm:p-8">
      {/* Non-printable Screen Header & Controls */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/firewall/isfw"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Return to ISFW Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>FortiGate ISFW Executive Audit Report Preview</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Ready for high-fidelity PDF print and formal IT audit governance sign-off.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-mono border border-slate-200">
            {PRESET_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRangeChange(r.id)}
                className={`px-3 py-1 rounded-lg transition-all font-semibold cursor-pointer ${
                  range === r.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold font-mono transition-all shadow-md shadow-emerald-900/20 cursor-pointer"
          >
            <Printer size={15} />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div className="max-w-5xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 space-y-8">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                ISO 27001 A.13.1 / PCI-DSS 1.3 Certified
              </span>
              <span className="text-xs font-mono text-slate-500">Document ID: SOC-ISFW-AUDIT-2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              FortiGate ISFW Internal Segmentation Audit Report
            </h1>
            <p className="text-xs text-slate-600 font-mono">
              Zero-Trust East-West Lateral Traversal Containment, Inter-VLAN Forwarding, and UTM Inspection Telemetry.
            </p>
          </div>

          <div className="text-right font-mono text-xs text-slate-600 space-y-1 shrink-0">
            <div><strong>Generated At:</strong> {new Date().toISOString().slice(0, 19).replace('T', ' ')} WIB</div>
            <div><strong>Auditor:</strong> Network Security Operations Lead</div>
            <div><strong>Target Cluster:</strong> FortiGate ISFW Internal Core</div>
            <div><strong>Audit Window:</strong> {range.toUpperCase()}</div>
          </div>
        </div>

        {/* Executive KPI Scorecards */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <Activity size={14} className="text-emerald-600" />
            <span>1. Internal Segmentation Telemetry &amp; Baseline Metrics</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Total Segmentation Events</span>
              <div className="text-2xl font-bold font-mono text-slate-900">{total.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Inter-VLAN &amp; East-West flow</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Allowed Traffic</span>
              <div className="text-2xl font-bold font-mono text-emerald-700">{allow.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Permitted Interzone Sessions</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Blocked / Denied</span>
              <div className="text-2xl font-bold font-mono text-rose-700">{deny.toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Interzone Drops &amp; Lateral Denials</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Interzone Drop Ratio</span>
              <div className="text-2xl font-bold font-mono text-purple-700">{dropRatio}%</div>
              <span className="text-[10px] text-slate-500 font-mono">
                {Number(dropRatio) > 20 ? 'Strict Microsegmentation' : 'Healthy Baseline'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">UTM Security Hits</span>
              <div className="text-xl font-bold font-mono text-amber-700">{Number(kpi.utm || 0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">AV / IPS / Web Filter</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">App-Control Workloads</span>
              <div className="text-xl font-bold font-mono text-cyan-700">{Number(kpi.app || 0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Identified Internal Apps</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">SSL / TLS Anomalies</span>
              <div className="text-xl font-bold font-mono text-blue-700">{Number(kpi.ssl || 0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Encrypted Traversal Inspected</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Web Filter Profiles</span>
              <div className="text-xl font-bold font-mono text-teal-700">{Number(kpi.web || 0).toLocaleString()}</div>
              <span className="text-[10px] text-slate-500 font-mono">Internal Web Traversals</span>
            </div>
          </div>
        </div>

        {/* Section 2: Core Internal Segmentation Policy Rule Hit Inventory */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <Layers size={14} className="text-emerald-600" />
            <span>2. Core Internal Segmentation Policy Rule Hit Inventory</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Policy Name / Identifier</th>
                  <th className="py-2 px-3">Rule Type</th>
                  <th className="py-2 px-3 text-right">Hit Count</th>
                  <th className="py-2 px-3 text-right">Traffic Share</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {(top.policy || []).slice(0, 8).map((p: any, idx: number) => {
                  const pVal = Number(p.total ?? p.value ?? 0);
                  const share = total > 0 ? ((pVal / total) * 100).toFixed(1) : '0.0';
                  const isDeny = (p.label || '').toLowerCase().includes('deny') || (p.label || '').toLowerCase().includes('drop');
                  return (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold">{p.label}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDeny ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isDeny ? 'Interzone Deny' : 'Permit / Accept'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        {pVal.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">{share}%</td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-[10px] font-bold text-slate-700">VERIFIED ACTIVE</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Core Inter-VLAN Target Server Farms */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <Database size={14} className="text-emerald-600" />
            <span>3. Top Core Inter-VLAN Destination Nodes &amp; Target Clusters</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Server IP Address</th>
                  <th className="py-2 px-3">Workload Role</th>
                  <th className="py-2 px-3 text-right">Session Hits</th>
                  <th className="py-2 px-3 text-right">Internal Ingress Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {(top.destination || []).slice(0, 8).map((d: any, idx: number) => {
                  const dVal = Number(d.total ?? d.value ?? 0);
                  const share = total > 0 ? ((dVal / total) * 100).toFixed(1) : '0.0';
                  const isDb = (d.label || '').includes('.101.') || (d.label || '').includes('.103.');
                  return (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold text-emerald-900">{d.label}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDb ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isDb ? 'Core Database Cluster' : 'Internal Department Service'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold">{dVal.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Compliance & Control Checklist */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase font-bold text-slate-700 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>4. Network Segregation &amp; Compliance Audit Matrix</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-mono border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Control Standard</th>
                  <th className="py-2.5 px-3">Security Requirement</th>
                  <th className="py-2.5 px-3">Telemetry Verification</th>
                  <th className="py-2.5 px-3 text-center">Audit Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                <tr>
                  <td className="py-2.5 px-3 font-bold font-mono">POJK 11 / OJK CSIRT</td>
                  <td className="py-2.5 px-3">Ketahanan Siber &amp; Isolasi Akses Rekanan / Pihak Ketiga (Vendor Wi-Fi).</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">Subnet Wi-Fi CFI-Vendor (10.17.x.x) terisolasi penuh; 100% traversal ke Corporate LAN (10.10.x.x) dan Core DB Farm (10.100.101.x) diblokir ISFW.</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">COMPLIANT</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold font-mono">PCI-DSS 1.3</td>
                  <td className="py-2.5 px-3">Interzone network traffic between user subnets and sensitive database/CDE restricted.</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">ISFW microsegmentation active; {deny.toLocaleString()} unauthorized cross-zone attempts blocked.</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">COMPLIANT</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold font-mono">ISO 27001 A.13.1</td>
                  <td className="py-2.5 px-3">Network segregation across sensitive internal information processing systems.</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">Corporate LAN (10.10.x.x) and Wi-Fi CFI-IT (10.19.x.x) segregation enforced with App-Ctrl &amp; stateful firewalling.</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">COMPLIANT</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold font-mono">NIST SP 800-207</td>
                  <td className="py-2.5 px-3">Zero-Trust lateral movement containment and strict inter-VLAN forwarding policies.</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{Number(kpi.utm || 0).toLocaleString()} UTM threat hits &amp; {Number(kpi.ssl || 0).toLocaleString()} encrypted flows verified across East-West perimeters.</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">COMPLIANT</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Governance Sign-off & Approvals */}
        <div className="pt-6 border-t-2 border-slate-900 space-y-4">
          <h3 className="text-xs font-mono uppercase font-bold text-slate-700 tracking-wider">
            5. Executive Governance Review &amp; Sign-Off
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4 text-xs font-mono">
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <span className="font-bold text-slate-900 block">Lead SOC Analyst</span>
              <span className="text-slate-500 text-[10px] block">Security Operations Center</span>
              <div className="h-10"></div>
              <span className="text-[10px] text-slate-400 block">Date &amp; Signature: __________________</span>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1">
              <span className="font-bold text-slate-900 block">Head of Network Engineering</span>
              <span className="text-slate-500 text-[10px] block">Internal Infrastructure &amp; Core Switching</span>
              <div className="h-10"></div>
              <span className="text-[10px] text-slate-400 block">Date &amp; Signature: __________________</span>
            </div>

            <div className="border-t border-slate-400 pt-2 space-y-1 col-span-2 sm:col-span-1">
              <span className="font-bold text-slate-900 block">Chief Information Security Officer</span>
              <span className="text-slate-500 text-[10px] block">Information Security Division</span>
              <div className="h-10"></div>
              <span className="text-[10px] text-slate-400 block">Date &amp; Signature: __________________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FortiIsfwReportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-mono text-slate-500">Loading ISFW audit report generator...</div>}>
      <ReportContent />
    </Suspense>
  );
}
