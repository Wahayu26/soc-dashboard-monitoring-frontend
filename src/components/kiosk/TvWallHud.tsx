'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTvModeStore, TV_PLAYLIST } from '@/store/tvModeStore';
import {
  Tv,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Clock,
  Sparkles,
  Radio,
  SlidersHorizontal,
  X
} from 'lucide-react';

export function TvWallHud() {
  const {
    isActive,
    isPaused,
    currentIndex,
    intervalSeconds,
    stopTvMode,
    togglePause,
    nextSlide,
    prevSlide,
    setCurrentIndex,
    setIntervalSeconds,
  } = useTvModeStore();

  const [secondsRemaining, setSecondsRemaining] = useState(intervalSeconds);
  const [isMinimized, setIsMinimized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Sync currentIndex with current pathname if user navigates manually
  useEffect(() => {
    const idx = TV_PLAYLIST.findIndex((p) => p.url === pathname);
    if (idx !== -1 && idx !== currentIndex) {
      setCurrentIndex(idx);
      setSecondsRemaining(intervalSeconds);
    }
  }, [pathname, currentIndex, setCurrentIndex, intervalSeconds]);

  // Fullscreen change listener to sync state if user exits via browser ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (!isFs && isActive) {
        stopTvMode();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isActive, stopTvMode]);

  // Timer loop for auto-rotation
  useEffect(() => {
    if (!isActive || isPaused) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const nextIdx = nextSlide();
          const target = TV_PLAYLIST[nextIdx];
          if (target) {
            router.push(target.url);
          }
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, isPaused, intervalSeconds, nextSlide, router]);

  // Keyboard controls during TV Mode
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = nextSlide();
        router.push(TV_PLAYLIST[nextIdx].url);
        setSecondsRemaining(intervalSeconds);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = prevSlide();
        router.push(TV_PLAYLIST[prevIdx].url);
        setSecondsRemaining(intervalSeconds);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, intervalSeconds, nextSlide, prevSlide, router, togglePause]);

  const handleExit = () => {
    stopTvMode();
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  if (!isActive) return null;

  const currentItem = TV_PLAYLIST[currentIndex] || TV_PLAYLIST[0];
  const progressPct = ((intervalSeconds - secondsRemaining) / intervalSeconds) * 100;

  return (
    <aside aria-label="NOC TV Wall Controls" className="fixed top-4 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-xs font-bold hover:bg-slate-800 transition-all"
        >
          <Tv size={14} className="animate-pulse" />
          <span>NOC TV MODE [{currentIndex + 1}/{TV_PLAYLIST.length}]</span>
        </button>
      ) : (
        <div className="bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.25)] backdrop-blur-2xl p-3 min-w-[340px] flex flex-col gap-2.5">
          {/* Top Progress bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isPaused
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </span>
              <span className="text-[11px] font-black tracking-widest text-cyan-300 uppercase">
                {isPaused ? 'TV ROTATION PAUSED' : 'COMMAND WALL ACTIVE'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                title="Minimize HUD"
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={handleExit}
                title="Exit TV Wall Mode (ESC)"
                className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Current Slide Info */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                SLIDE {currentIndex + 1} OF {TV_PLAYLIST.length}
              </p>
              <h4 className="text-xs font-bold text-white truncate max-w-[210px]">
                {currentItem.title}
              </h4>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-slate-400 font-mono text-xs">
              <Clock size={12} className="text-cyan-400" />
              <span className="font-bold text-white">{secondsRemaining}s</span>
            </div>
          </div>

          {/* Controls & Interval Switcher */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            {/* Play/Pause & Nav */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const prevIdx = prevSlide();
                  router.push(TV_PLAYLIST[prevIdx].url);
                  setSecondsRemaining(intervalSeconds);
                }}
                title="Previous Slide (←)"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              <button
                onClick={togglePause}
                title={isPaused ? 'Resume Rotation (Space)' : 'Pause Rotation (Space)'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                }`}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
                <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
              </button>

              <button
                onClick={() => {
                  const nextIdx = nextSlide();
                  router.push(TV_PLAYLIST[nextIdx].url);
                  setSecondsRemaining(intervalSeconds);
                }}
                title="Next Slide (→)"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Interval Speed Pills */}
            <div className="flex items-center gap-1">
              {[15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setIntervalSeconds(sec);
                    setSecondsRemaining(sec);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    intervalSeconds === sec
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-800/60'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
