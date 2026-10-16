export default function FullscreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#07101f]">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border border-cyan-500/20" />
        <div className="absolute inset-2 rounded-full border border-cyan-500/10" />
        <div className="absolute inset-0 rounded-full radar-sweep" />
        <div className="absolute inset-[34%] rounded-lg bg-gradient-to-br from-cyan-400 to-teal-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" />
      </div>
      <p className="text-xs font-bold tracking-[0.3em] uppercase text-slate-400 animate-pulse">{label}</p>
    </div>
  );
}
