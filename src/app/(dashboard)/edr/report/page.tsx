'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ShieldCheck, Calendar, Activity, Users, Server, Printer, AlertTriangle } from 'lucide-react';
import { Suspense, useEffect } from 'react';

function ReportContent() {
  const searchParams = useSearchParams();
  const period = searchParams.get('period') || 'weekly';
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['crowdstrike-report', period, startDate, endDate],
    queryFn: async () => {
      const qs = new URLSearchParams({ action: 'report', period });
      if (startDate && endDate) {
        qs.set('start_date', startDate);
        qs.set('end_date', endDate);
      }
      return (await api.get(`/crowdstrike?${qs.toString()}`)).data?.data;
    },
    staleTime: 60000,
  });

  const data = rawData;

  useEffect(() => {
    if (data) {
      document.title = `CrowdStrike EDR Report - ${data.meta.period_label}`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white print:bg-white">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-10 text-red-500">Failed to load report.</div>;
  }

  const { meta, kpi, daily, users, hosts, alerts, severity, mitre, profiles } = data;
  const incidents = data.incidents || [];

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white font-sans p-8 md:p-12 max-w-5xl mx-auto">
      {/* Print button (hidden when printing) */}
      <div className="mb-8 flex justify-end print:hidden">
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold shadow-lg transition-all"
        >
          <Printer size={18} /> Print to PDF
        </button>
      </div>

      {/* Header */}
      <header className="border-b-4 border-violet-600 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">CrowdStrike EDR Security Report</h1>
          <p className="text-lg text-slate-600 font-medium">{meta.period_label}</p>
        </div>
        <div className="text-right text-sm text-slate-500 space-y-1">
          <p><strong>Generated:</strong> {meta.generated_at}</p>
          <p><strong>Source:</strong> {meta.source}</p>
          <p className="font-mono text-xs">{meta.from} to {meta.to}</p>
        </div>
      </header>

      {/* Executive Summary KPIs */}
      <section className="mb-10 page-break-inside-avoid">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
          <Activity size={20} className="text-violet-600" /> Executive Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiBox label="Total Detections" value={kpi.total || 0} />
          <KpiBox label="Critical Severity" value={kpi.critical || 0} alert={(kpi.critical || 0) > 0} />
          <KpiBox label="High Severity" value={kpi.high || 0} alert={(kpi.high || 0) > 0} />
          <KpiBox label="Real-time Alerts" value={kpi.realtime || 0} />
          <KpiBox label="Server Detections" value={profiles?.find((p: any) => p.profile === 'server')?.total || 0} />
          <KpiBox label="User Detections" value={profiles?.find((p: any) => p.profile === 'user')?.total || 0} />
          <KpiBox label="Telegram Sent" value={kpi.telegram || 0} />
          <KpiBox label="Unique Hosts" value={hosts?.length || 0} />
        </div>
      </section>

      {/* Activity Timeline (Daily) */}
      <section className="mb-10 page-break-inside-avoid">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
          <Calendar size={20} className="text-violet-600" /> Daily Activity Trend
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="py-2 px-3 border border-slate-200 font-bold">Date</th>
                <th className="py-2 px-3 border border-slate-200 font-bold text-right">Events</th>
                <th className="py-2 px-3 border border-slate-200 font-bold text-right">Critical</th>
                <th className="py-2 px-3 border border-slate-200 font-bold text-right">High</th>
                <th className="py-2 px-3 border border-slate-200 font-bold text-right">Medium</th>
                <th className="py-2 px-3 border border-slate-200 font-bold text-right">Low</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d: any, i: number) => (
                <tr key={i} className="even:bg-slate-50">
                  <td className="py-2 px-3 border border-slate-200 font-medium">{d.day}</td>
                  <td className="py-2 px-3 border border-slate-200 text-right">{d.total}</td>
                  <td className="py-2 px-3 border border-slate-200 text-right text-rose-600 font-bold">{d.critical > 0 ? d.critical : '-'}</td>
                  <td className="py-2 px-3 border border-slate-200 text-right text-orange-500">{d.high > 0 ? d.high : '-'}</td>
                  <td className="py-2 px-3 border border-slate-200 text-right text-amber-500">{d.medium > 0 ? d.medium : '-'}</td>
                  <td className="py-2 px-3 border border-slate-200 text-right text-sky-500">{d.low > 0 ? d.low : '-'}</td>
                </tr>
              ))}
              {daily.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500 border border-slate-200">No data available</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <section className="page-break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Users size={20} className="text-violet-600" /> Top Users
          </h2>
          <TopTable data={users} />
        </section>

        <section className="page-break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Server size={20} className="text-violet-600" /> Top Targets
          </h2>
          <TopTable data={hosts} />
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <section className="page-break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Activity size={20} className="text-violet-600" /> Top Alerts
          </h2>
          <TopTable data={alerts} />
        </section>
        
        <section className="page-break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
            <ShieldCheck size={20} className="text-violet-600" /> Severity
          </h2>
          <TopTable data={severity} />
        </section>
      </div>

      {/* Incidents/Errors */}
      {incidents.length > 0 && (
        <section className="mb-10 page-break-inside-avoid">
          <h2 className="text-xl font-bold text-rose-700 mb-4 flex items-center gap-2 border-b border-rose-200 pb-2">
            <AlertTriangle size={20} className="text-rose-600" /> Infrastructure Health Events
          </h2>
          <div className="space-y-3">
            {incidents.map((inc: any) => (
              <div key={inc.id} className="p-3 border border-rose-200 bg-rose-50 rounded-lg text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-rose-900">{inc.event_type}</span>
                  <span className="text-xs text-rose-700 font-mono">{inc.event_time}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div><strong>Server:</strong> {inc.psm_server || '-'}</div>
                  <div><strong>Service:</strong> {inc.service_name || '-'}</div>
                </div>
                {inc.message && <div className="text-xs text-slate-700 bg-white p-2 rounded border border-rose-100 font-mono">{inc.message}</div>}
              </div>
            ))}
          </div>
        </section>
      )}
      
      
      <div className="mb-10 page-break-inside-avoid">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2">
          <Activity size={20} className="text-violet-600" /> MITRE ATT&CK Tactics
        </h2>
        <TopTable data={mitre} />
      </div>
      <footer className="mt-16 pt-6 border-t border-slate-200 text-center text-sm text-slate-500 print:absolute print:bottom-0 print:w-full">
        <p>Sentinel SOC Command Center — Internal & Confidential</p>
      </footer>
    </div>
  );
}

export default function EdrReportPage() {
  return (
    <Suspense fallback={<div className="p-10">Loading report parameters...</div>}>
      <ReportContent />
    </Suspense>
  );
}

function KpiBox({ label, value, alert }: { label: string; value: any; alert?: boolean }) {
  return (
    <div className={`p-4 border rounded-lg ${alert ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-bold">{label}</p>
      <p className={`text-2xl font-black ${alert ? 'text-rose-700' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function TopTable({ data }: { data: any[] }) {
  return (
    <table className="w-full text-left border-collapse text-sm">
      <thead>
        <tr className="bg-slate-100 text-slate-700 border-y border-slate-200">
          <th className="py-2 px-3 font-bold">Item</th>
          <th className="py-2 px-3 font-bold text-right w-24">Count</th>
        </tr>
      </thead>
      <tbody>
        {data.map((d: any, i: number) => (
          <tr key={i} className="border-b border-slate-100">
            <td className="py-2 px-3 truncate max-w-[200px]" title={d.label}>{d.label || '-'}</td>
            <td className="py-2 px-3 text-right font-medium">{d.value}</td>
          </tr>
        ))}
        {data.length === 0 && (
          <tr>
            <td colSpan={2} className="py-4 text-center text-slate-500 italic">No data</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

