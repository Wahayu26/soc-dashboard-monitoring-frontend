'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Printer, 
  Calendar, 
  Clock, 
  Filter, 
  Check, 
  Loader2, 
  AlertCircle, 
  ShieldAlert, 
  ExternalLink,
  RotateCcw,
  GripHorizontal,
  Layers,
  ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';

interface PaloAltoReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRange: string;
  activeFilter?: string;
}

export function PaloAltoReportExportModal({
  isOpen,
  onClose,
  activeRange,
  activeFilter = '',
}: PaloAltoReportExportModalProps) {
  const [tab, setTab] = useState<'csv' | 'pdf'>('csv');
  const [rangeMode, setRangeMode] = useState<'preset' | 'custom'>('preset');
  const [selectedRange, setSelectedRange] = useState<string>(activeRange || 'today');
  
  // Custom Date-Time fields
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgoStr);
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(todayStr);
  const [endTime, setEndTime] = useState('23:59');

  // CSV Specific Options
  const [rowLimit, setRowLimit] = useState<number>(1000);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Draggable Modal Positioning with screen boundary limits
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
    if (target.closest('button, a, input, select, textarea, [data-no-drag]')) return;

    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handleResetPosition = () => setPosition({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      const maxOffX = Math.max(100, (window.innerWidth / 2) - 150);
      const maxOffY = Math.max(100, (window.innerHeight / 2) - 100);
      setPosition({
        x: Math.min(maxOffX, Math.max(-maxOffX, dragRef.current.initX + deltaX)),
        y: Math.min(maxOffY, Math.max(-maxOffY, dragRef.current.initY + deltaY)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // CSV Export Action Handler
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setStatusMessage('Mengumpulkan log firewall dari database...');
    try {
      const params = new URLSearchParams();
      params.set('action', 'logs');
      if (rangeMode === 'custom' && startDate) {
        params.set('start_date', `${startDate} ${startTime}:00`);
        if (endDate) params.set('end_date', `${endDate} ${endTime}:59`);
      } else {
        params.set('range', selectedRange);
      }
      params.set('limit', rowLimit.toString());
      if (actionFilter) params.set('filter', `action:${actionFilter}`);
      if (searchQuery) params.set('search', searchQuery);

      const res = await api.get(`/syslog?${params.toString()}`);
      const logs = res.data?.logs || res.data?.latest_logs || [];
      if (!logs.length) {
        setStatusMessage('No log records found for the specified filter and time window.');
        setTimeout(() => setStatusMessage(null), 4000);
        return;
      }

      setStatusMessage(`Preparing CSV file for ${logs.length.toLocaleString()} log rows...`);
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
      const rows = logs.map((l: any) => [
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
      const filename = rangeMode === 'custom'
        ? `PaloAlto_Audit_Logs_Custom_${startDate}_to_${endDate || 'now'}.csv`
        : `PaloAlto_Audit_Logs_${selectedRange}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMessage(`Successfully downloaded ${logs.length.toLocaleString()} log rows!`);
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1500);
    } catch (err) {
      setStatusMessage('Failed to export CSV. Please ensure backend connection is active.');
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // PDF Report Handler
  const handleOpenPdfReport = () => {
    const params = new URLSearchParams();
    if (rangeMode === 'custom' && startDate) {
      params.set('start_date', `${startDate} ${startTime}:00`);
      if (endDate) params.set('end_date', `${endDate} ${endTime}:59`);
    } else {
      params.set('range', selectedRange);
    }
    const url = `/firewall/palo-alto/report?${params.toString()}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header (Draggable) */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleResetPosition}
          className={`px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 cursor-grab active:cursor-grabbing select-none ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          title="Drag to reposition • Double-click to reset position"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl border shrink-0 bg-rose-500/10 border-rose-500/30 text-rose-400">
              <Download size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Export Log &amp; Audit Report Generator
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                  <GripHorizontal size={12} />
                  <span>Draggable</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Palo Alto Networks NGFW &middot; CSV Tabular &amp; Executive PDF Audit Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1" data-no-drag>
            {(position.x !== 0 || position.y !== 0) && (
              <button
                type="button"
                onClick={handleResetPosition}
                className="text-slate-400 hover:text-cyan-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all text-xs font-mono cursor-pointer"
                title="Reset position to center"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2" data-no-drag>
          <button
            type="button"
            onClick={() => setTab('csv')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'csv'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Download size={14} />
            <span>1. Export Data Tabular (CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pdf')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'pdf'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Printer size={14} />
            <span>2. Executive Audit Report (PDF)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs" data-no-drag>
          {/* Section: Telemetry Time Range Mode (Preset vs Custom) */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase font-mono tracking-wider text-slate-300 block">
              Select Telemetry Time Range Mode:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRangeMode('preset')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  rangeMode === 'preset'
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold block font-mono">Preset Range</span>
                <span className="text-[11px] text-slate-400">1H, Today, 24H, 7D, 30D</span>
              </button>
              <button
                type="button"
                onClick={() => setRangeMode('custom')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  rangeMode === 'custom'
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold block font-mono">Custom Date-Time Range</span>
                <span className="text-[11px] text-slate-400">Specify exact dates &amp; timestamps</span>
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          {rangeMode === 'preset' ? (
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-slate-400 block">Quick Presets:</span>
              <div className="grid grid-cols-5 gap-2 font-mono">
                {(['1h', 'today', '24h', '7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRange(r)}
                    className={`py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                      selectedRange === r
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-950/50'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Custom Date & Time Inputs */
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 animate-in fade-in duration-200">
              <span className="text-[11px] font-bold text-rose-300 font-mono block">
                Custom Window Parameters:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">Start Date &amp; Time (From):</span>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block">End Date &amp; Time (To):</span>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: CSV Filters & Limits */}
          {tab === 'csv' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase font-mono tracking-wider text-slate-300 block">
                Additional CSV Parameters:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Action Filter:</span>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer font-mono"
                  >
                    <option value="">All Actions (All)</option>
                    <option value="allow">ALLOW Only (Permit)</option>
                    <option value="deny">DENY / DROP Only (Blocked)</option>
                    <option value="reset">RESET Only (RST)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Max Row Limit:</span>
                  <select
                    value={rowLimit}
                    onChange={(e) => setRowLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer font-mono"
                  >
                    <option value="500">500 rows</option>
                    <option value="1000">1,000 rows (Standard)</option>
                    <option value="2500">2,500 rows</option>
                    <option value="5000">5,000 rows (Deep Audit)</option>
                    <option value="10000">10,000 rows</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Keyword / IP Search:</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. 192.168 or dns"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: PDF Description & Highlights */}
          {tab === 'pdf' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-sans">
              <div className="flex items-start gap-3">
                <FileText size={22} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-slate-300 leading-relaxed text-xs">
                  <strong className="text-white block font-semibold">Official Governance &amp; Forensic Audit Document:</strong>
                  <p className="text-slate-400">
                    Executive print-ready document (Print / Save to PDF) containing perimeter telemetry KPIs, 
                    <strong> MITRE ATT&CK&reg; Kill-Chain Mapping</strong>, <strong>Top Threat Signatures &amp; CVE Exploits</strong>, 
                    threat drop ratio analysis, Top 10 External Attackers, Top Internal Targets, App-ID, formal sign-off sheet, and 
                    <strong> CIS Palo Alto Firewall Benchmark v1.1 &amp; ISO 27001</strong> compliance audit matrix.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
              <Loader2 size={13} className="animate-spin text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0" data-no-drag>
          <span className="text-[11px] font-mono text-slate-500">
            {rangeMode === 'custom' ? `Window: ${startDate} to ${endDate || 'Now'}` : `Preset: ${selectedRange.toUpperCase()}`}
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExportingCsv}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold font-mono transition-all cursor-pointer"
            >
              Cancel
            </button>

            {tab === 'csv' ? (
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExportingCsv}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
              >
                {isExportingCsv ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>{isExportingCsv ? 'Downloading...' : 'Export CSV Now'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPdfReport}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                <Printer size={14} />
                <span>Open Audit PDF (Print Ready)</span>
                <ExternalLink size={12} className="opacity-70" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
