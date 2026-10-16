'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { copyText, ipIntelLinks, isIPv4, isPrivateIp } from '@/lib/threatIntel';
import {
  X, Crosshair, User, Server, Clock, Copy, Check, ExternalLink, ClipboardList,
  GitBranch, ShieldCheck, Layers, Fingerprint, Moon, ChevronRight, AlertTriangle, ShieldAlert,
} from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DrillDimension = 'bucket' | 'alert_name' | 'hostname' | 'tactic' | 'severity' | 'health';

export interface DrillTarget {
  dimension: DrillDimension;
  value: string;
  label: string;
}

const DIMENSION_META: Record<DrillDimension, { title: string; icon: ReactNode }> = {
  bucket: { title: 'Time Bucket', icon: <Clock size={16} /> },
  alert_name: { title: 'Alert Name', icon: <AlertTriangle size={16} /> },
  hostname: { title: 'Target Host', icon: <Server size={16} /> },
  tactic: { title: 'MITRE Tactic', icon: <Crosshair size={16} /> },
  severity: { title: 'Severity', icon: <ShieldAlert size={16} /> },
  health: { title: 'Health Issues', icon: <Crosshair size={16} /> },
};

export function severityClass(sev?: string) {
  if (sev === 'high' || sev === 'critical') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  if (sev === 'medium' || sev === 'warning') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
  return 'bg-slate-800 text-slate-300 border-slate-700';
}

/* ------------------------------------------------------------------ */
/* Generic slide-over shell                                            */
/* ------------------------------------------------------------------ */
function SideDrawer({
  open, onClose, children, width = 'max-w-2xl', z = 'z-50', accent = 'violet',
}: {
  open: boolean; onClose: () => void; children: ReactNode; width?: string; z?: string; accent?: 'violet' | 'cyan';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 ${z} ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        className={`absolute right-0 top-0 h-full w-full ${width} bg-[#0a1426]/95 border-l ${accent === 'violet' ? 'border-violet-500/20' : 'border-cyan-500/20'} ${open ? 'shadow-[-20px_0_60px_rgba(0,0,0,0.5)]' : 'shadow-none'} flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-[105%]'}`}
      >
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${accent === 'violet' ? 'via-violet-400/60' : 'via-cyan-400/60'} to-transparent`} />
        {children}
      </aside>
    </div>
  );
}

function DrawerHeader({ eyebrow, title, icon, onClose, accent = 'violet' }: { eyebrow: string; title: string; icon: ReactNode; onClose: () => void; accent?: 'violet' | 'cyan' }) {
  return (
    <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-800/80">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${accent === 'violet' ? 'bg-violet-500/15 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.25)]' : 'bg-cyan-500/15 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.25)]'}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${accent === 'violet' ? 'text-violet-400/80' : 'text-cyan-400/80'}`}>{eyebrow}</p>
          <h2 className="text-lg font-black text-slate-100 truncate" title={title}>{title}</h2>
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors" aria-label="Close panel">
        <X size={18} />
      </button>
    </div>
  );
}

function DrawerLoading({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-xs font-mono tracking-widest text-violet-300 animate-pulse">{label}</p>
    </div>
  );
}

function Stat({ label, value, tone = 'slate' }: { label: string; value: ReactNode; tone?: 'slate' | 'violet' | 'cyan' | 'rose' }) {
  const color = { slate: 'text-slate-100', violet: 'text-violet-300', cyan: 'text-cyan-300', rose: 'text-rose-400' }[tone];
  return (
    <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value ?? 0}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drill-down drawer                                                   */
/* ------------------------------------------------------------------ */
export function DrillDownDrawer({
  target, range, onClose, onOpenEvent, onPivot,
}: {
  target: DrillTarget | null;
  range: string;
  onClose: () => void;
  onOpenEvent: (id: number) => void;
  onPivot: (t: DrillTarget) => void;
}) {
  const [filter, setFilter] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['crowdstrike-drill', target?.dimension, target?.value, range],
    enabled: !!target,
    queryFn: async () => {
      const qs = new URLSearchParams({ action: 'drilldown', dimension: target!.dimension, value: target!.value, range, limit: '300' });
      const res = await api.get(`/crowdstrike?${qs.toString()}`);
      return res.data?.data;
    },
  });

  const meta = target ? DIMENSION_META[target.dimension] : DIMENSION_META.bucket;
  const stats = data?.stats || {};
  const breakdown: any[] = data?.breakdown || [];
  const maxBreak = Math.max(1, ...breakdown.map((b) => Number(b.value)));
  const events: any[] = (data?.events || []).filter((e: any) => {
    if (!filter) return true;
    const t = filter.toLowerCase();
    return [e.alert_name, e.hostname, e.severity, e.tactic].some((v) => (v || '').toLowerCase().includes(t));
  });

  return (
    <SideDrawer open={!!target} onClose={onClose}>
      <DrawerHeader eyebrow={`Drill-down · ${meta.title} · ${range}`} title={target?.label || ''} icon={meta.icon} onClose={onClose} />

      {isLoading ? (
        <DrawerLoading label="CORRELATING EVENTS..." />
      ) : error ? (
        <p className="p-6 text-sm text-rose-400">{getApiErrorMessage(error)}</p>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Events" value={stats.total} tone="violet" />
            <Stat label="Opened" value={stats.opened} tone="cyan" />
            <Stat label="Alert Names" value={stats.unique_users} />
            <Stat label="Targets" value={stats.unique_targets} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-mono text-slate-400">
            <span>First seen <span className="text-slate-200">{stats.first_seen || '-'}</span></span>
            <span>Last seen <span className="text-slate-200">{stats.last_seen || '-'}</span></span>
            {Number(stats.health) > 0 && <span className="text-rose-400">{stats.health} health issue(s)</span>}
          </div>

          {breakdown.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Event Composition</h3>
              <div className="space-y-2">
                {breakdown.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => target?.dimension !== 'severity' && onPivot({ dimension: 'severity', value: b.label, label: b.label })}
                    className="w-full group text-left"
                  >
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300 font-mono group-hover:text-violet-300 transition-colors">{b.label}</span>
                      <span className="text-slate-400">{b.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700" style={{ width: `${(Number(b.value) / maxBreak) * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Events ({events.length})</h3>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter..."
                className="w-40 bg-slate-900/60 border border-slate-700/50 rounded-lg py-1 px-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="space-y-1.5">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpenEvent(Number(e.id))}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                >
                  <span className="text-[10px] font-mono text-slate-500 w-[118px] shrink-0">{e.event_time}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border shrink-0 ${severityClass(e.severity)}`}>{e.severity}</span>
                  <span className="text-xs text-slate-300 truncate flex-1">{e.alert_name || '-'} <span className="text-cyan-400/80 font-mono">→ {e.hostname || '-'}</span></span>
                  <ChevronRight size={14} className="text-slate-600 group-hover:text-violet-300 shrink-0" />
                </button>
              ))}
              {events.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No events.</p>}
            </div>
          </div>
        </div>
      )}
    </SideDrawer>
  );
}

/* ------------------------------------------------------------------ */
/* Event detail drawer + quick actions + session timeline              */
/* ------------------------------------------------------------------ */
export function EventDetailDrawer({
  eventId, onClose, onPivot,
}: {
  eventId: number | null;
  onClose: () => void;
  onPivot: (t: DrillTarget) => void;
}) {
  const queryClient = useQueryClient();
    const [copied, setCopied] = useState<string | null>(null);

    const handleClose = () => {
      queryClient.invalidateQueries({ queryKey: ['crowdstrike-drill'] });
      queryClient.invalidateQueries({ queryKey: ['crowdstrike-summary'] });
      onClose();
    };
  const { data, isLoading, error } = useQuery({
    queryKey: ['crowdstrike-timeline', eventId],
    enabled: eventId !== null,
    queryFn: async () => (await api.get(`/crowdstrike?action=timeline&id=${eventId}`)).data?.data,
  });

  const ev = data?.event || {};
  const timeline: any[] = data?.timeline || [];
  const identity = data?.identity_7d;
  const target: string = ev.hostname && ev.hostname !== '-' ? ev.hostname : '';
  const externalIp = ev.external_ip && ev.external_ip !== '-' ? ev.external_ip : null;
  const ipTarget = isIPv4(externalIp);
  const privateTarget = ipTarget && isPrivateIp(externalIp!);

  const [isIsolated, setIsIsolated] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const doCopy = async (key: string, text: string) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const incidentNote = [
    `### CrowdStrike PAM Event #${ev.id}`,
    `- Time      : ${ev.event_time}`,
    `- Event     : ${ev.severity} (severity: ${ev.severity || 'n/a'})`,
    `- Alert Name      : ${ev.alert_name || '-'}`,
    `- Target    : ${target || '-'}`,
    `- Safe      : ${ev.safe_name || '-'}`,
    `- PSM Server: ${ev.psm_server || '-'}`,
    `- Session   : ${ev.session_id || ev.owning_process || '-'}`,
    `- Tactic   : ${ev.tactic || '-'}`,
    identity ? `- Alert Name 7d   : ${identity.total_events} events, ${identity.distinct_targets} targets, ${identity.off_hours} off-hours` : '',
  ].filter(Boolean).join('\n');

  const modeLabel = { session_id: 'Correlated by Session ID', owning_process: 'Correlated by PSM process', user_window: 'Alert Name activity ±30 min' }[data?.mode as string] || '';

  return (
    <SideDrawer open={eventId !== null} onClose={handleClose} z="z-[60]" width="max-w-xl" accent="cyan">
      <DrawerHeader eyebrow={`Event #${eventId ?? ''} · Investigation`} title={ev.severity || 'Loading...'} icon={<Fingerprint size={16} />} onClose={handleClose} accent="cyan" />

      {isLoading ? (
        <DrawerLoading label="RECONSTRUCTING SESSION..." />
      ) : error ? (
        <p className="p-6 text-sm text-rose-400">{getApiErrorMessage(error)}</p>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Time" value={ev.event_time} mono />
            <Field label="Severity" value={<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${severityClass(ev.severity)}`}>{ev.severity || 'info'}</span>} />
            <Field label="Alert Name" value={ev.alert_name} onCopy={() => doCopy('alert_name', ev.alert_name)} copied={copied === 'alert_name'} />
            <Field label="Target" value={target} mono onCopy={() => doCopy('hostname', target)} copied={copied === 'hostname'} />
            <Field label="Safe" value={ev.safe_name} />
            <Field label="PSM Server" value={ev.psm_server} mono />
            <Field label="Session / Process" value={ev.session_id && ev.session_id !== '-' ? ev.session_id : ev.owning_process} mono onCopy={() => doCopy('sid', ev.session_id || ev.owning_process)} copied={copied === 'sid'} />
            <Field label="Telegram" value={Number(ev.telegram_sent) === 1 ? 'Sent' : 'Not sent'} />
          </div>
          {ev.tactic && (
            <p className="text-xs text-slate-300 bg-slate-900/60 border border-slate-800 rounded-lg p-3 font-mono leading-relaxed break-words">{ev.tactic}</p>
          )}

          {/* Quick actions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ev.alert_name && ev.alert_name !== '-' && (
                <ActionButton icon={<User size={14} />} label="All activity of this user" onClick={() => onPivot({ dimension: 'alert_name', value: ev.alert_name, label: ev.alert_name })} />
              )}
              {target && (
                <ActionButton icon={<Server size={14} />} label="All access to this target" onClick={() => onPivot({ dimension: 'hostname', value: target, label: target })} />
              )}
              <ActionButton icon={<Layers size={14} />} label="Same event type" onClick={() => onPivot({ dimension: 'severity', value: ev.severity, label: ev.severity })} />
              <ActionButton
                icon={copied === 'note' ? <Check size={14} /> : <ClipboardList size={14} />}
                label={copied === 'note' ? 'Copied to clipboard!' : 'Copy incident note'}
                onClick={() => doCopy('note', incidentNote)}
              />
            </div>
          </div>

          {/* Threat intel */}
          {externalIp && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Threat Intel · {externalIp}</h3>
              {!ipTarget ? (
                <p className="text-xs text-slate-500">Invalid external IP format.</p>
              ) : privateTarget ? (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <ShieldCheck size={14} /> Internal asset (RFC1918) — external reputation lookups are disabled to avoid leaking internal topology.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ipIntelLinks(externalIp).map((l) => (
                    <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-all">
                      {l.name} <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Response Actions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Response Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                onClick={() => { setIsIsolated(true); setTimeout(() => setIsIsolated(false), 3000); }}
                className={`flex justify-center items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-center transition-all ${isIsolated ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50'}`}>
                {isIsolated ? <Check size={14} /> : <AlertTriangle size={14} />}
                {isIsolated ? 'Host Isolated (Simulated)' : 'Isolate Host'}
              </button>
              {externalIp && (
                <button 
                  onClick={() => { setIsBlocked(true); setTimeout(() => setIsBlocked(false), 3000); }}
                  className={`flex justify-center items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-center transition-all ${isBlocked ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50'}`}>
                  {isBlocked ? <Check size={14} /> : <ShieldAlert size={14} />}
                  {isBlocked ? 'IP Blocked (Simulated)' : 'Block External IP'}
                </button>
              )}
            </div>
          </div>

          {/* Identity context */}
          {identity && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Identity Context · Last 7 Days</h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Events" value={identity.total_events} tone="cyan" />
                <Stat label="Targets" value={identity.distinct_targets} />
                <Stat label="Off-hours" value={<span className="flex items-center gap-1">{identity.off_hours}<Moon size={14} className="text-slate-500" /></span>} tone={identity.off_hours > 0 ? 'rose' : 'slate'} />
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2"><GitBranch size={13} /> Session Timeline</h3>
              <span className="text-[10px] text-slate-500">{modeLabel}</span>
            </div>
            <ol className="relative border-l border-slate-700/70 ml-2 space-y-3">
              {timeline.map((t) => {
                const current = Number(t.id) === Number(ev.id);
                return (
                  <li key={t.id} className="ml-4">
                    <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${current ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-slate-600'}`} />
                    <div className={`p-2.5 rounded-lg border ${current ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-800 bg-slate-800/20'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-500">{t.event_time}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${severityClass(t.severity)}`}>{t.severity}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 truncate" title={t.tactic}>{t.tactic || `${t.alert_name || '-'} → ${t.hostname || '-'}`}</p>
                    </div>
                  </li>
                );
              })}
              {timeline.length === 0 && <li className="ml-4 text-xs text-slate-500">No correlated events.</li>}
            </ol>
          </div>
        </div>
      )}
    </SideDrawer>
  );
}

function Field({ label, value, mono, onCopy, copied }: { label: string; value: ReactNode; mono?: boolean; onCopy?: () => void; copied?: boolean }) {
  const empty = value === null || value === undefined || value === '' || value === '-';
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-800 p-2.5 min-w-0 group">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {onCopy && !empty && (
          <button onClick={onCopy} className="text-slate-600 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Copy ${label}`}>
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        )}
      </div>
      <div className={`text-xs text-slate-200 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{empty ? '-' : value}</div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold text-left bg-slate-800/40 border border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
      <span className="text-cyan-400">{icon}</span>{label}
    </button>
  );
}






