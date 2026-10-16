'use client';

import { useState, useEffect, useRef } from 'react';
import { getEcho } from '@/lib/echo';
import { api } from '@/lib/api';
import { 
  AlertTriangle, 
  ShieldAlert, 
  X, 
  ExternalLink, 
  Volume2, 
  VolumeX, 
  Radio, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  Sparkles
} from 'lucide-react';
import { useIncidentStore } from '@/store/incidentStore';
import Link from 'next/link';

export interface IncidentItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | string;
  title: string;
  description: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface GlobalIncidentBannerProps {
  onIncidentReceived?: (incident: IncidentItem) => void;
}

export default function GlobalIncidentBanner({ onIncidentReceived }: GlobalIncidentBannerProps) {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [currentIncident, setCurrentIncident] = useState<IncidentItem | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // A4
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback best effort
    }
  };

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const handleAlert = (data: { incident?: IncidentItem } | IncidentItem) => {
      const inc: IncidentItem = (data as any).incident || data;
      if (!inc || !inc.id) return;

      useIncidentStore.getState().addIncident(inc);
      setIncidents((prev) => {
        const filtered = prev.filter((i) => i.id !== inc.id);
        return [inc, ...filtered].slice(0, 10);
      });
      setCurrentIncident(inc);
      setIsDismissed(false);
      playChime();
      if (onIncidentReceived) {
        onIncidentReceived(inc);
      }
    };

    const channel1 = echo.channel('soc.incidents');
    const channel2 = echo.channel('soc.overview');

    channel1.listen('.incident.alert', handleAlert);
    channel2.listen('.incident.alert', handleAlert);

    return () => {
      echo.leaveChannel('soc.incidents');
      echo.leaveChannel('soc.overview');
    };
  }, [soundEnabled, onIncidentReceived]);

  const handleSimulateIncident = async (type: string = 'crowdstrike') => {
    setIsSimulating(true);
    try {
      const res = await api.post('/dashboard/trigger-test-incident', {
        type,
        severity: type === 'firewall_drop' ? 'high' : 'critical',
        title: type === 'firewall_drop'
          ? 'Perimeter Drop Burst: 84,200 Syn-Flood Packets/Min Blocked'
          : 'Critical EDR Threat: Mimikatz LSASS Dump Attempt',
        description: type === 'firewall_drop'
          ? 'FortiGate FGDC + Palo Alto blocked anomalous volumetric traffic targeting Core API.'
          : 'CrowdStrike Falcon detected credential dumping via LSASS process injection on host WS-FIN-044.',
        source: type === 'firewall_drop' ? 'FortiGate FGDC + Palo Alto' : 'CrowdStrike Falcon EDR',
      });

      if (res.data?.incident) {
        const inc: IncidentItem = res.data.incident;
        useIncidentStore.getState().addIncident(inc);
        setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)].slice(0, 10));
        setCurrentIncident(inc);
        setIsDismissed(false);
        playChime();
        if (onIncidentReceived) {
          onIncidentReceived(inc);
        }
      }
    } catch (err) {
      console.error('Failed to trigger test incident:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const getTargetUrl = (type: string) => {
    switch (type) {
      case 'crowdstrike':
        return '/edr';
      case 'firewall_drop':
      case 'firewall':
        return '/firewall/fgdc';
      case 'pam':
      case 'cyberark':
        return '/pam';
      case 'database':
      case 'db':
        return '/db';
      default:
        return '/firewall/palo';
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Active Incident Floating Alert */}
      {currentIncident && !isDismissed && (
        <div 
          className={`relative overflow-hidden rounded-xl border p-4 shadow-2xl transition-all duration-300 backdrop-blur-md ${
            currentIncident.severity === 'critical'
              ? 'border-rose-500/50 bg-gradient-to-r from-rose-950/80 via-slate-900/90 to-rose-950/40 shadow-rose-950/50'
              : 'border-amber-500/50 bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-amber-950/40 shadow-amber-950/50'
          }`}
        >
          {/* Subtle pulse bar */}
          <div 
            className={`absolute top-0 left-0 right-0 h-1 animate-pulse ${
              currentIncident.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
            }`} 
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div 
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                  currentIncident.severity === 'critical'
                    ? 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                    : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                }`}
              >
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    currentIncident.severity === 'critical' ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    currentIncident.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                </span>
                <ShieldAlert className="h-5 w-5" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span 
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                      currentIncident.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    REALTIME {currentIncident.severity.toUpperCase()} INCIDENT
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {currentIncident.id}
                  </span>
                  <span className="text-xs text-slate-500">&bull;</span>
                  <span className="text-xs text-slate-400 font-mono">
                    {currentIncident.source}
                  </span>
                  <span className="text-xs text-slate-500">&bull;</span>
                  <span className="text-xs text-slate-400">
                    {currentIncident.timestamp}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-white tracking-wide">
                  {currentIncident.title}
                </h4>
                <p className="text-xs text-slate-300 line-clamp-1 max-w-2xl">
                  {currentIncident.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <Link
                href={getTargetUrl(currentIncident.type)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shadow-sm ${
                  currentIncident.severity === 'critical'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                }`}
              >
                <span>Investigate</span>
                <ExternalLink className="h-3 w-3" />
              </Link>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Chime'}
                className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-cyan-400" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                title="Dismiss Banner"
                className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Status Bar & Simulation Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>REVERB WEBSOCKET: LIVE</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            Listening on <code className="text-slate-300 font-mono">soc.incidents</code> & <code className="text-slate-300 font-mono">soc.crowdstrike</code>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {incidents.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
            >
              <span>{incidents.length} Alert{incidents.length > 1 ? 's' : ''} in Session</span>
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleSimulateIncident('crowdstrike')}
              className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 text-[11px] text-cyan-300 transition disabled:opacity-50"
              title="Broadcast simulated CrowdStrike EDR incident via WebSocket"
            >
              <Zap className="h-3 w-3 text-cyan-400" />
              <span>{isSimulating ? 'Sending...' : 'Test EDR Push'}</span>
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleSimulateIncident('firewall_drop')}
              className="inline-flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 text-[11px] text-amber-300 transition disabled:opacity-50"
              title="Broadcast simulated Firewall Volumetric Drop incident via WebSocket"
            >
              <Radio className="h-3 w-3 text-amber-400" />
              <span>Test Drop Push</span>
            </button>
          </div>
        </div>
      </div>

      {/* Incident History Drawer */}
      {showHistory && incidents.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Recent WebSocket Live Incidents ({incidents.length})
            </span>
            <button
              type="button"
              onClick={() => setIncidents([])}
              className="text-[10px] text-slate-500 hover:text-rose-400 transition"
            >
              Clear Log
            </button>
          </div>
          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
            {incidents.map((inc) => (
              <div 
                key={inc.id}
                onClick={() => {
                  setCurrentIncident(inc);
                  setIsDismissed(false);
                }}
                className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer border border-slate-800 transition text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${inc.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <span className="font-mono text-slate-400 text-[11px]">{inc.id}</span>
                  <span className="font-medium text-slate-200">{inc.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">{inc.source}</span>
                  <span className="text-[10px] font-mono text-slate-400">{inc.timestamp.split(' ')[1] || inc.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
