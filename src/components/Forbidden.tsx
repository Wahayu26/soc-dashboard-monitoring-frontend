import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

export default function Forbidden({ permission }: { permission: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-up">
      <div className="glass-card max-w-md w-full p-10 text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center bg-rose-500/10 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
          <ShieldOff className="text-rose-400" size={30} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 mb-6">
          Your role does not include the{' '}
          <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-xs">{permission}</code>{' '}
          permission. Contact a SOC administrator if you need access.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
        >
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
