import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-jb', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Sentinel SOC — Security Command Center',
    template: '%s · Sentinel SOC',
  },
  description:
    'Sentinel SOC unified security operations dashboard: FortiGate firewall, CrowdStrike EDR, CyberArk PAM and database monitoring in one command center.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="antialiased min-h-screen bg-[#07101f] text-slate-100 overflow-x-hidden font-sans">
        {/* Background glow mesh for Sleek & Vibrant look */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-60">
          <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
