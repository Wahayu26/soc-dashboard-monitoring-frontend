import Link from 'next/link';
import { Construction, ArrowLeft } from 'lucide-react';

export default function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-up">
      <div className="glass-card max-w-lg w-full p-10 text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
          <Construction className="text-cyan-300" size={28} />
        </div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-2">{description}</p>
        <p className="text-xs text-slate-500 mb-6">This module will be migrated in Phase 3 (data visualization).</p>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>
    </div>
  );
}
