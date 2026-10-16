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
  Server,
  Network
} from 'lucide-react';
import { api } from '@/lib/api';

interface FortiFgdcReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRange: string;
  activeFilter?: string;
}

export function FortiFgdcReportExportModal({
  isOpen,
  onClose,
  activeRange,
  activeFilter = '',
}: FortiFgdcReportExportModalProps) {
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

  // Handle CSV Download directly from Forti FGDC API
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setStatusMessage('Fetching Data Center firewall logs from FGDC cluster...');

    try {
      const params = new URLSearchParams();
      params.set('type', 'logs');
      params.set('range', rangeMode === 'preset' ? selectedRange : 'today');
      params.set('limit', rowLimit.toString());

      if (searchQuery) params.set('q', searchQuery);
      if (actionFilter) {
        params.set('filter', 'action');
        params.set('value', actionFilter);
      }

      const res = await api.get(`/forti/fgdc?${params.toString()}`);
      const logs = res.data?.logs || [];

      if (logs.length === 0) {
        setStatusMessage('No logs found for the selected time window.');
        setTimeout(() => setStatusMessage(null), 3000);
        setIsExportingCsv(false);
        return;
      }

      setStatusMessage(`Formatting ${logs.length} data center records to CSV...`);

      const headers = [
        'ID',
        'Log Time',
        'Received Time',
        'Action',
        'Source IP',
        'Destination IP',
        'Port',
        'Application',
        'Policy Name',
        'User/Node',
        'Level',
        'Total Bytes',
        'Type',
        'Subtype',
        'Message'
      ];

      const csvRows = [headers.join(',')];

      for (const row of logs) {
        const values = [
          row.id || '',
          `"${row.log_time || ''}"`,
          `"${row.received_time || ''}"`,
          `"${row.action || ''}"`,
          `"${row.srcip || ''}"`,
          `"${row.dstip || ''}"`,
          row.dstport || '',
          `"${(row.app || '').replace(/"/g, '""')}"`,
          `"${(row.policyname || '').replace(/"/g, '""')}"`,
          `"${(row.username || '').replace(/"/g, '""')}"`,
          `"${row.level || ''}"`,
          row.totalbyte || 0,
          `"${row.type || ''}"`,
          `"${row.subtype || ''}"`,
          `"${(row.msg || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(values.join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timeStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.setAttribute('download', `FortiGate_FGDC_Audit_Report_${timeStamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatusMessage('CSV export generated successfully!');
      setTimeout(() => {
        setStatusMessage(null);
        setIsExportingCsv(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      setStatusMessage('Failed to export CSV: ' + (err.message || 'Unknown network error'));
      setTimeout(() => setStatusMessage(null), 4000);
      setIsExportingCsv(false);
    }
  };

  // Handle Opening Printable PDF Executive Audit Report
  const handleOpenPdfReport = () => {
    const params = new URLSearchParams();
    params.set('range', rangeMode === 'preset' ? selectedRange : 'custom');
    if (rangeMode === 'custom') {
      params.set('start_date', `${startDate} ${startTime}:00`);
      params.set('end_date', `${endDate} ${endTime}:59`);
    }

    const url = `/firewall/fgdc/report?${params.toString()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Draggable Header */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleResetPosition}
          className={`p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          title="Hold & drag to move • Double-click to reset position"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Network size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                <span>Export FortiGate FGDC Audit Report</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Generate high-throughput datacenter security compliance reports (CSV / Executive PDF)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-no-drag>
            {position.x !== 0 || position.y !== 0 ? (
              <button
                type="button"
                onClick={handleResetPosition}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                title="Reset window position"
              >
                <RotateCcw size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body & Tab Switching */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Export Format Segmented Control */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setTab('csv')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === 'csv'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Download size={14} />
              <span>Raw CSV Dataset</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('pdf')}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === 'pdf'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Printer size={14} />
              <span>Executive Audit PDF</span>
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock size={13} className="text-blue-400" />
                <span>Audit Period Selection</span>
              </span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRangeMode('preset')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    rangeMode === 'preset' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  Quick Preset
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setRangeMode('custom')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    rangeMode === 'custom' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  Custom Dates
                </button>
              </div>
            </div>

            {rangeMode === 'preset' ? (
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: '1h', label: '1H' },
                  { id: 'today', label: 'Today' },
                  { id: '24h', label: '24H' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRange(r.id)}
                    className={`py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      selectedRange === r.id
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">Start Window:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">End Window:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tab 1: CSV Filters & Row Limit */}
          {tab === 'csv' && (
            <div className="space-y-3 font-mono border-t border-slate-800/80 pt-4">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter size={13} className="text-blue-400" />
                <span>Dataset Filtering &amp; Buffer Limits</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Action Filter:</span>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                  >
                    <option value="">All Actions</option>
                    <option value="accept">ACCEPT Only (Permit)</option>
                    <option value="deny">DENY / BLOCK Only</option>
                    <option value="close">CLOSE / TCP FIN</option>
                    <option value="client-rst">CLIENT RST</option>
                    <option value="server-rst">SERVER RST</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Max Row Limit:</span>
                  <select
                    value={rowLimit}
                    onChange={(e) => setRowLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
                  >
                    <option value="500">500 rows</option>
                    <option value="1000">1,000 rows (Standard)</option>
                    <option value="2500">2,500 rows</option>
                    <option value="5000">5,000 rows (Deep Audit)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">Keyword / IP Search:</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. 10.100.1 or oracle"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: PDF Description & Highlights */}
          {tab === 'pdf' && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 font-sans">
              <div className="flex items-start gap-3">
                <FileText size={22} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-slate-300 leading-relaxed text-xs">
                  <strong className="text-white block font-semibold">FortiGate FGDC Executive Governance Document:</strong>
                  <p className="text-slate-400">
                    Print-ready executive audit report covering high-throughput Data Center core telemetry, 
                    <strong> Security Policy Hit Efficiency</strong>, <strong>UTM Antivirus &amp; IPS Threat Inspection</strong>, 
                    Top Database &amp; Application Workloads, Top Core Destinations, bandwidth consumption, and 
                    <strong> ISO 27001 / PCI-DSS Data Center Segmentation</strong> compliance matrices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Message Notification */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-slate-950 border border-blue-500/40 text-blue-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
              <Loader2 size={13} className="animate-spin text-blue-400" />
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
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 cursor-pointer disabled:opacity-50"
              >
                {isExportingCsv ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                <span>{isExportingCsv ? 'Downloading...' : 'Export CSV Now'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPdfReport}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/50 cursor-pointer"
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
