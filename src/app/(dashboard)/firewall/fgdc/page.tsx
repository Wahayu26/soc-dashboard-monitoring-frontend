import type { Metadata } from 'next';
import { FortiFgdcDashboard } from '@/components/firewall/FortiFgdcDashboard';

export const metadata: Metadata = { 
  title: 'FortiGate FGDC Core Firewall | SOC Dashboard',
  description: 'Fortinet Data Center core firewall inspection, inter-segment policy enforcement, and UTM security telemetry.'
};

export default function Page() {
  return <FortiFgdcDashboard />;
}