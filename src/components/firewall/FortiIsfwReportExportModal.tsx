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
  Network,
  ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';

interface FortiIsfwReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRange: string;
  activeFilter?: string;
}

export function FortiIsfwReportExportModal({
  isOpen,
  onClose,
  activeRange,
  activeFilter = '',
}: FortiIsfwReportExportModalProps) {
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

  // Draggable Modal Positioning
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

  // Handle CSV Download directly from Forti ISFW API
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setStatusMessage('Fetching Internal Segmentation logs from ISFW cluster...');

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

      const res = await api.get(`/forti/syslog?${params.toString()}`);
      const logs = res.data?.logs || [];

      if (logs.length === 0) {
        setStatusMessage('No logs found for the selected time window.');
        setTimeout(() => setStatusMessage(null), 3000);
        setIsExportingCsv(false);
        return;
      }

      setStatusMessage(`Formatting ${logs.length} internal segmentation records to CSV...`);

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
      link.setAttribute('download', `FortiGate_ISFW_Audit_Report_${timeStamp}.csv`);
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

    const url = `/firewall/isfw/report?${params.toString()}`;
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
          className={`p-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          title="Hold & drag to move • Double-click to reset position"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                <span>Export FortiGate ISFW Audit Report</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  ISFW CORE
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Internal Segmentation Firewall East-West Telemetry &amp; Microsegmentation Audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1" data-no-drag>
            <button
              type="button"
              onClick={handleResetPosition}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Reset modal position"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close export modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto font-mono text-xs">
          {/* Format Tabs: CSV vs Formal PDF Report */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTab('csv')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === 'csv'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Download size={14} />
              <span>Export Raw Syslogs (CSV)</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('pdf')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                tab === 'pdf'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Printer size={14} />
              <span>Formal PDF Audit Document</span>
            </button>
          </div>

          {/* Time Window Selection */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar size={13} className="text-emerald-400" />
                <span>Audit Time Window</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRangeMode('preset')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    rangeMode === 'preset' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setRangeMode('custom')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    rangeMode === 'custom' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {rangeMode === 'preset' ? (
              <div className="grid grid-cols-5 gap-2 pt-1">
                {[
                  { id: '1h', label: '1 Hour' },
                  { id: 'today', label: 'Today' },
                  { id: '24h', label: '24 Hours' },
                  { id: '7d', label: '7 Days' },
                  { id: '30d', label: '30 Days' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRange(item.id)}
                    className={`py-2 rounded-lg border text-center transition-all cursor-pointer ${
                      selectedRange === item.id
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Clock size={11} className="text-slate-500" />
                    <span>Start Timestamp</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                    <Clock size={11} className="text-slate-500" />
                    <span>End Timestamp</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Options based on Tab */}
          {tab === 'csv' ? (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Filter size={13} className="text-emerald-400" />
                <span>CSV Ingestion Options</span>
              </span>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Action Filter</label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">All Actions (Accept + Deny)</option>
                    <option value="deny">Deny / Block / Drop Only</option>
                    <option value="accept">Accept / Allow Only</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Max Records Limit</label>
                  <select
                    value={rowLimit}
                    onChange={(e) => setRowLimit(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={200}>200 Events (Fast Stream)</option>
                    <option value={500}>500 Events</option>
                    <option value={1000}>1,000 Events (Standard Audit)</option>
                    <option value={2000}>2,000 Events (Deep Ingestion)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Log Search Query (Optional)</label>
                <input
                  type="text"
                  placeholder="Filter by IP, User, Policy Name, or App..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Printer size={15} />
                <span>High-Fidelity IT Audit Sign-Off Report</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Generates a formal, printable executive audit document formatted for ISO 27001 A.13.1 (Network Segregation) and PCI-DSS 1.3 compliance. Includes internal segmentation baseline scorecards, microsegmentation policy hit breakdown, inter-VLAN core destination topology, and executive governance sign-off fields.
              </p>
            </div>
          )}

          {/* Status Alert Banner */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <Loader2 size={14} className="animate-spin text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isExportingCsv}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors font-bold cursor-pointer"
            >
              Cancel
            </button>

            {tab === 'csv' ? (
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExportingCsv}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold transition-all shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
              >
                {isExportingCsv ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Exporting Records...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download CSV Dataset</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPdfReport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold transition-all shadow-lg shadow-blue-900/30 cursor-pointer"
              >
                <Printer size={14} />
                <span>Open Printable Audit Preview</span>
                <ExternalLink size={12} className="opacity-75" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
