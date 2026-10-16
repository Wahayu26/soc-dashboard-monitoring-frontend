import type { Metadata } from 'next';
import { PaloAltoDashboard } from '@/components/firewall/PaloAltoDashboard';

export const metadata: Metadata = { 
  title: 'Palo Alto Networks NGFW | Sentinel SOC',
  description: 'Next-Gen Firewall telemetry, Threat Prevention, Application-ID, and Global Geo Intelligence.',
};

export default function Page() {
  return <PaloAltoDashboard />;
}
