'use client';

import { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck,
  Layers,
  Calendar,
  AlertTriangle
} from 'lucide-react';

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

interface OverviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  range: string;
  totalLogs: number;
  activeThreats: number;
  dbLoad: number;
  liveModules: number;
  totalModules: number;
  trafficData: TrafficPoint[];
  threatData: ThreatCategory[];
  modules: Record<string, ModuleInfo>;
}

export default function OverviewReportModal({
  isOpen,
  onClose,
  range,
  totalLogs,
  activeThreats,
  dbLoad,
  liveModules,
  totalModules,
  trafficData,
  threatData,
  modules,
}: OverviewReportModalProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    setIsExporting(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
      const filename = `soc-global-overview-${range}-${dateStr}.csv`;

      let csv = `sep=,\r\n`;
      csv += `CLIPAN FINANCE SOC - GLOBAL TELEMETRY OVERVIEW REPORT\r\n`;
      csv += `Generated At,${now.toISOString()}\r\n`;
      csv += `Selected Range,${range.toUpperCase()}\r\n`;
      csv += `Total Processed Logs,${totalLogs}\r\n`;
      csv += `Active Threats Detected,${activeThreats}\r\n`;
      csv += `Database Load,${dbLoad}%\r\n`;
      csv += `Active Telemetry Modules,${liveModules}/${totalModules}\r\n\r\n`;

      // Section 1: Traffic Aggregation
      csv += `=== 1. UNIFIED NETWORK TRAFFIC TELEMETRY ===\r\n`;
      csv += `Interval,Timestamp,Allowed Logs,Denied / Blocked Logs,Total Logs,Palo Alto Logs,FortiGate FGDC Logs,FortiGate ISFW Logs\r\n`;
      trafficData.forEach((pt) => {
        csv += `"${pt.time}",${pt.timestamp},${pt.allowed},${pt.denied},${pt.total},${pt.palo || 0},${pt.fgdc || 0},${pt.isfw || 0}\r\n`;
      });
      csv += `\r\n`;

      // Section 2: Threat Landscape
      csv += `=== 2. THREAT LANDSCAPE & ATTACK SURFACE ===\r\n`;
      csv += `Category,Event Count,Percentage of Attack Surface\r\n`;
      const threatSum = threatData.reduce((acc, curr) => acc + curr.value, 0) || 1;
      threatData.forEach((th) => {
        const pct = ((th.value / threatSum) * 100).toFixed(1);
        csv += `"${th.name}",${th.value},${pct}%\r\n`;
      });
      csv += `\r\n`;

      // Section 3: Modules Pipeline Status
      csv += `=== 3. TELEMETRY PIPELINE STATUS ===\r\n`;
      csv += `Module Key,Module Name,Type,Status,Total Logs / Events,Last Event Timestamp\r\n`;
      Object.entries(modules).forEach(([k, mod]) => {
        csv += `"${k}","${mod.name || k}","${mod.type || 'Security'}","${mod.status || 'online'}",${mod.count || 0},"${mod.latest || '-'}"\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('CSV generation error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPdfReport = () => {
    window.open(`/overview/report?range=${range}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Export SOC Executive Briefing
              </h3>
              <p className="text-xs text-slate-400">
                Generate tabular audit datasets or formal PDF report for range <span className="font-mono text-cyan-400 font-bold uppercase">{range}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold tracking-wider transition ${
              activeTab === 'csv'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>TABULAR CSV DATASET</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold tracking-wider transition ${
              activeTab === 'pdf'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>FORMAL EXECUTIVE AUDIT PDF</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'csv' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                  Export Dataset Preview:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase">Range</p>
                    <p className="text-sm font-bold text-white uppercase font-mono">{range}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase">Processed Logs</p>
                    <p className="text-sm font-bold text-cyan-400 font-mono">{totalLogs.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase">Active Threats</p>
                    <p className="text-sm font-bold text-rose-400 font-mono">{activeThreats.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <p className="text-[10px] text-slate-400 uppercase">Traffic Intervals</p>
                    <p className="text-sm font-bold text-emerald-400 font-mono">{trafficData.length} Points</p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1 pt-1">
                  <p>&bull; Comprehensive multi-firewall telemetry (Palo Alto, FGDC, ISFW).</p>
                  <p>&bull; 5-category threat landscape & CrowdStrike EDR incident metrics.</p>
                  <p>&bull; Infrastructure health pipeline (EDR, CyberArk PAM, Database Cluster).</p>
                </div>
              </div>

              {downloadSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>CSV generated and downloaded to your device successfully!</span>
                </div>
              )}

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadCsv}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Generating CSV...' : 'Download Tabular CSV Dataset'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Print-Ready Executive Briefing Document
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Opens an executive print view formatted for A4 PDF export with official Clipan Finance SOC classification, threat analysis summary, and analyst signature lines.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs text-slate-300 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Document Type:</span>
                    <span className="text-white">Executive SOC Cyber Briefing</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Classification:</span>
                    <span className="text-amber-400 font-semibold">TLP:AMBER / STRICTLY CONFIDENTIAL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Telemetry Target:</span>
                    <span className="text-cyan-400">Multi-Firewall + EDR + PAM + DB</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenPdfReport}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Open Document & Print to PDF</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
