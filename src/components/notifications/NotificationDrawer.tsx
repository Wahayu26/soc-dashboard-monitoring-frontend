'use client';

import { useEffect, useRef } from 'react';
import { useIncidentStore, type IncidentItem } from '@/store/incidentStore';
import { api } from '@/lib/api';
import {
  Bell,
  X,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
  Clock,
  Radio,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const {
    incidents,
    unreadCount,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    clearAll,
    toggleSound,
    addIncident
  } = useIncidentStore();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dispatch live test incident
  const triggerTestAlert = async (type: 'crowdstrike' | 'firewall') => {
    try {
      const payload = type === 'crowdstrike'
        ? {
            type: 'crowdstrike',
            severity: 'critical',
            title: 'Critical Ransomware Indicator: vssadmin shadowcopy delete',
            description: 'Suspicious process tree detected on SRV-FIN-PROD01 (AID: 8902-1a4f)',
            source: 'CrowdStrike Falcon EDR',
          }
        : {
            type: 'firewall',
            severity: 'high',
            title: 'Anomalous Threat Drop Burst: Edge FGDC Gateway',
            description: 'Sudden spike of 4,210 dropped packets within 60s from 185.220.101.44 (Port Scan)',
            source: 'FortiGate FGDC Edge',
          };

      const res = await api.post('/dashboard/trigger-test-incident', payload);
      if (res.data?.ok && res.data?.incident) {
        addIncident(res.data.incident);
      }
    } catch {
      // Fallback local test item
      addIncident({
        id: 'INC-' + Math.floor(100000 + Math.random() * 900000),
        type,
        severity: type === 'crowdstrike' ? 'critical' : 'high',
        title: type === 'crowdstrike' ? 'Test Alert: EDR Host Isolation Triggered' : 'Test Alert: Firewall Block Rate Exceeded',
        description: 'Simulated incident telemetry received across SOC Reverb channel.',
        source: type === 'crowdstrike' ? 'CrowdStrike Falcon' : 'FortiGate FGDC',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const getTargetUrl = (inc: IncidentItem) => {
    const src = (inc.source || '').toLowerCase();
    const type = (inc.type || '').toLowerCase();
    if (src.includes('crowdstrike') || type.includes('crowdstrike') || type.includes('edr')) {
      return `/edr?search=${encodeURIComponent(inc.title)}`;
    }
    if (src.includes('cyberark') || type.includes('pam')) {
      return `/pam?search=${encodeURIComponent(inc.title)}`;
    }
    if (src.includes('palo')) {
      return `/firewall/palo-alto`;
    }
    if (src.includes('fgdc')) {
      return `/firewall/fgdc`;
    }
    if (src.includes('isfw')) {
      return `/firewall/isfw`;
    }
    return '/';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div
        ref={drawerRef}
        className="relative z-10 w-full max-w-md h-full bg-slate-900/95 border-l border-cyan-500/30 shadow-2xl flex flex-col backdrop-blur-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Decorative Top Accent Line */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-rose-500 to-amber-500" />

        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-wider text-white uppercase">
                  Incident Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Live alert feed from EDR, Firewalls & PAM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
              className={`p-2 rounded-lg border transition-all ${
                soundEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="px-5 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800/80 text-slate-300 transition-colors"
            >
              <CheckCircle2 size={13} className="text-emerald-400" />
              Mark all read
            </button>
            <button
              onClick={clearAll}
              disabled={incidents.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-rose-950/50 hover:text-rose-300 disabled:opacity-40 text-slate-400 transition-colors"
            >
              <Trash2 size={13} />
              Clear
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span>Reverb WebSocket</span>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {incidents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-300">All Systems Nominal</p>
                <p className="text-xs text-slate-500 mt-1">
                  No active incidents or threat surges reported in this session.
                </p>
              </div>

              {/* Simulation buttons */}
              <div className="pt-4 border-t border-slate-800/80 w-full space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Test Live Dispatch:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerTestAlert('crowdstrike')}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    <Zap size={12} /> Test EDR Alert
                  </button>
                  <button
                    onClick={() => triggerTestAlert('firewall')}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    <Activity size={12} /> Test Drop Surge
                  </button>
                </div>
              </div>
            </div>
          ) : (
            incidents.map((inc) => {
              const isCrit = inc.severity === 'critical';
              const isHigh = inc.severity === 'high';
              const targetUrl = getTargetUrl(inc);

              return (
                <div
                  key={inc.id}
                  onClick={() => markAsRead(inc.id)}
                  className={`relative p-3.5 rounded-xl border transition-all ${
                    !inc.read
                      ? isCrit
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                        : isHigh
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                        : 'bg-cyan-950/20 border-cyan-500/30'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Unread indicator */}
                  {!inc.read && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}

                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isCrit
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : isHigh
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {isCrit ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isCrit
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                              : isHigh
                              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                              : 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {inc.source}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white leading-snug line-clamp-1">
                        {inc.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {inc.description}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-mono flex items-center gap-1">
                          <Clock size={11} />
                          {inc.timestamp?.slice(11, 19) || 'Just now'}
                        </span>

                        <Link
                          href={targetUrl}
                          onClick={() => {
                            markAsRead(inc.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-semibold transition-all"
                        >
                          Investigate <ExternalLink size={10} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer with Simulator trigger */}
        {incidents.length > 0 && (
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-mono">
              Total {incidents.length} alert{incidents.length > 1 ? 's' : ''} recorded
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerTestAlert('crowdstrike')}
                className="text-[10px] text-slate-400 hover:text-cyan-400 transition-colors"
              >
                + Dispatch Test
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
