'use client';

import { ShieldAlert, Clock, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export function IdleTimeoutModal({
  isOpen,
  secondsRemaining,
  onExtend,
  onLogout,
}: IdleTimeoutModalProps) {
  if (!isOpen) return null;

  const totalWarningSeconds = 30;
  const progressPct = ((totalWarningSeconds - secondsRemaining) / totalWarningSeconds) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden backdrop-blur-2xl flex flex-col animate-in zoom-in-95 duration-200">
        {/* Top Warning Accent Bar */}
        <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-400 transition-all duration-1000 ease-linear"
            style={{ width: `${100 - progressPct}%` }}
          />
        </div>

        <div className="p-6 text-center space-y-4">
          {/* Animated Icon with Warning Ring */}
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping opacity-75" />
            <div className="relative w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Clock size={32} className="animate-pulse" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-black tracking-widest text-amber-400 uppercase mb-2">
              <ShieldAlert size={12} /> SOC Inactivity Lockout
            </div>
            <h3 className="text-lg font-black text-white tracking-tight">
              Session Inactivity Detected
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              No activity has been detected for 4 minutes 30 seconds. To protect telemetry data, your session will automatically lock in:
            </p>
          </div>

          {/* Prominent Countdown Pill */}
          <div className="py-2 px-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center gap-2">
            <span className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-400 to-amber-300">
              00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
            </span>
            <span className="text-xs font-semibold text-slate-400">seconds remaining</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl border border-slate-700/80 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={14} /> Sign Out Now
            </button>

            <button
              type="button"
              onClick={onExtend}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} /> Stay Signed In
            </button>
          </div>
        </div>

        {/* Security footnote */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
          <span>Security Policy: 5-minute idle limit</span>
          <span className="text-cyan-400 font-mono">TLP:AMBER</span>
        </div>
      </div>
    </div>
  );
}
