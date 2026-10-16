'use client';

import { useEffect, useState } from 'react';

export function RotatingWords({ words, interval = 2600 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  return (
    <span className="relative inline-flex overflow-hidden align-bottom pb-1">
      <span key={index} className="text-gradient animate-word-in inline-block">
        {words[index]}
      </span>
    </span>
  );
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const time = now ? now.toLocaleTimeString('en-GB', { hour12: false }) : '--:--:--';
  const date = now ? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <span className="font-mono tabular-nums">
      {date} · {time}
    </span>
  );
}
