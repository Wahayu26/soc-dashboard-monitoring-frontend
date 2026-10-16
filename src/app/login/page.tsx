import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ShieldCheck, Flame, Activity, KeyRound, Database, Radio } from 'lucide-react';
import LoginForm from './LoginForm';
import CyberBackground from '@/components/login/CyberBackground';
import { LiveClock, RotatingWords } from '@/components/login/Animated';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Secure sign-in to the Sentinel SOC security command center.',
};

const MODULES = [
  { icon: Flame, label: 'FortiGate ISFW & FGDC', desc: 'Firewall traffic & threat logs', tone: 'from-orange-500/20 text-orange-300 border-orange-500/25' },
  { icon: Activity, label: 'CrowdStrike Falcon', desc: 'Endpoint detections', tone: 'from-rose-500/20 text-rose-300 border-rose-500/25' },
  { icon: KeyRound, label: 'CyberArk PAM', desc: 'Privileged session audit', tone: 'from-violet-500/20 text-violet-300 border-violet-500/25' },
  { icon: Database, label: 'DB Monitor', desc: 'Database health & sessions', tone: 'from-cyan-500/20 text-cyan-300 border-cyan-500/25' },
];

export default function LoginPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-5 py-12">
      {/* Ambient background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 cyber-grid" />
        <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-cyan-500/15 blur-[140px] animate-float" />
        <div className="absolute -bottom-48 -right-32 w-[620px] h-[620px] rounded-full bg-violet-600/20 blur-[150px] animate-float [animation-delay:-5s]" />
        <div className="absolute top-1/3 left-1/2 w-[340px] h-[340px] rounded-full bg-teal-400/10 blur-[120px] animate-float [animation-delay:-2.5s]" />
        <div className="scan-line" />
      </div>
      <div className="absolute inset-0">
        <CyberBackground />
      </div>
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(3,7,18,0.85)_100%)]" />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">
        {/* ---------- Brand panel ---------- */}
        <section className="hidden lg:flex flex-col gap-9">
          <div className="flex items-center gap-3 animate-fade-up">
            <div className="relative w-12 h-12">
              <span className="absolute inset-0 rounded-2xl bg-cyan-400/40 animate-ping-slow" />
              <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm bg-gradient-to-br from-cyan-400 to-teal-400 text-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.55)]">
                SOC
              </div>
            </div>
            <div>
              <p className="font-black text-xl tracking-tight leading-none">
                SENTINEL <span className="text-cyan-400 neon-text-cyan">SOC</span>
              </p>
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-slate-500 mt-1">Command Center</p>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:100ms]">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-emerald-300 mb-6">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-slow" />
                <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              Monitoring Active
            </div>
            <h1 className="text-[3.25rem] font-black leading-[1.05] tracking-tight">
              Unified <RotatingWords words={['threat visibility', 'endpoint defense', 'access control', 'firewall insight']} />
              <br />
              in one command center.
            </h1>
            <p className="mt-6 text-[15px] text-slate-400 max-w-md leading-relaxed">
              Correlate firewall, endpoint, privileged access and database telemetry — with role-based access for every analyst tier.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 max-w-lg">
            {MODULES.map(({ icon: Icon, label, desc, tone }, i) => (
              <li
                key={label}
                style={{ animationDelay: `${220 + i * 90}ms` }}
                className="glass-card group animate-fade-up flex items-center gap-3 p-4 cursor-default transition-all duration-500 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_20px_40px_-20px_rgba(34,211,238,0.45)]"
              >
                <div className={`flex-none w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br to-transparent border ${tone} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-5 text-xs text-slate-500 animate-fade-up [animation-delay:600ms]">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400" /> Token auth · RBAC · Audited
            </span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="flex items-center gap-2">
              <Radio size={14} className="text-cyan-400" /> <LiveClock />
            </span>
          </div>
        </section>

        {/* ---------- Form panel ---------- */}
        <section className="w-full max-w-[440px] mx-auto lg:mr-0">
          <Suspense fallback={<div className="glass-card h-[520px] animate-pulse" />}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
