'use client';

import { useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, Eye, EyeOff, Loader2, AlertTriangle, ArrowRight, Fingerprint, Clock, ShieldCheck } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api';

function safeNext(next: string | null): string {
  // Only allow internal relative paths to prevent open-redirects.
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')) return next;
  return '/';
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const cardRef = useRef<HTMLDivElement>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const reason = params.get('reason');
  const isIdleTimeout = reason === 'idle_timeout';
  const sessionExpired = (reason === 'expired' || isIdleTimeout) && !login.isError && !login.isSuccess;
  const errorMessage = login.isError ? getApiErrorMessage(login.error, 'Login failed.') : null;
  const busy = login.isPending || login.isSuccess;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    login.mutate(
      { username: username.trim(), password },
      {
        // Short delay lets the "access granted" animation play before navigating.
        onSuccess: () => window.setTimeout(() => router.replace(safeNext(params.get('next'))), 750),
        onError: () => setAttempt((n) => n + 1),
      },
    );
  };

  // Cursor-following spotlight (CSS vars, no re-render).
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={onPointerMove}
      className="glass-card glow-border overflow-hidden p-8 sm:p-10 animate-fade-up [animation-delay:150ms]"
    >
      {/* Spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, -20%), rgba(34,211,238,0.10), transparent 60%)' }}
      />

      {/* Success overlay */}
      <div
        aria-hidden={!login.isSuccess}
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-500 ${login.isSuccess ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {login.isSuccess && (
          <>
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping-slow" />
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-emerald-500/15 border border-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.45)] animate-pop">
                <ShieldCheck className="text-emerald-300" size={30} />
              </div>
            </div>
            <p className="text-lg font-bold animate-fade-up [animation-delay:120ms]">Access granted</p>
            <p className="text-xs text-slate-400 animate-fade-up [animation-delay:200ms]">
              Welcome, {login.data?.user.name}. Loading command center…
            </p>
          </>
        )}
      </div>

      <div className="relative">
        {/* Mobile brand */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs bg-gradient-to-br from-cyan-400 to-teal-400 text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
            SOC
          </div>
          <p className="font-black tracking-tight">
            SENTINEL <span className="text-cyan-400 neon-text-cyan">SOC</span>
          </p>
        </div>

        <div className="mb-8">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-gradient-to-br from-cyan-500/20 to-violet-500/10 border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.25)]">
            <Fingerprint className="text-cyan-300" size={26} />
            <span aria-hidden className="absolute inset-x-2 h-px bg-cyan-300/80 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-fp-scan" />
          </div>
          <h2 className="text-[1.65rem] font-bold tracking-tight">Analyst Sign In</h2>
          <p className="text-sm text-slate-400 mt-1.5">Authenticate with your SOC credentials to continue.</p>
        </div>

        {/* Status messages (animated height via grid trick) */}
        <div className={`grid transition-all duration-500 ease-out ${sessionExpired || errorMessage ? 'grid-rows-[1fr] opacity-100 mb-5' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
          <div className="overflow-hidden">
            {errorMessage ? (
              <div
                key={attempt}
                role="alert"
                id="login-error"
                className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-shake"
              >
                <AlertTriangle size={18} className="flex-none mt-0.5 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            ) : sessionExpired ? (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <Clock size={18} className="flex-none mt-0.5 text-amber-400" />
                <span>
                  {isIdleTimeout
                    ? 'Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 5 menit untuk alasan keamanan.'
                    : 'Your session has expired. Please sign in again.'}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <Field id="login-username" label="Username" icon={User}>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              disabled={busy}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. analyst.l1"
              className="w-full bg-transparent py-3.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none disabled:opacity-60"
            />
          </Field>

          <Field id="login-password" label="Password" icon={Lock}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full bg-transparent py-3.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none disabled:opacity-60"
            />
            <button
              id="login-toggle-password"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="flex-none p-1 -mr-1 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <span className="relative block w-[18px] h-[18px]">
                <Eye size={18} className={`absolute inset-0 transition-all duration-300 ${showPassword ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`} />
                <EyeOff size={18} className={`absolute inset-0 transition-all duration-300 ${showPassword ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`} />
              </span>
            </button>
          </Field>

          <button
            id="login-submit"
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="btn-neon group mt-3 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {login.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Authenticating…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700/70" />
          <p className="text-[11px] text-slate-500 text-center">Authorized personnel only · All access is audited</p>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700/70" />
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2 transition-colors duration-300 group-focus-within:text-cyan-300"
      >
        {label}
      </label>
      <div className="neon-input flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/50 px-4">
        <Icon size={18} className="flex-none text-slate-500 transition-all duration-300 group-focus-within:text-cyan-300 group-focus-within:scale-110" />
        {children}
      </div>
    </div>
  );
}
