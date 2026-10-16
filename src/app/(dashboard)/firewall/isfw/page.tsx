import type { Metadata } from 'next';
import { FortiIsfwDashboard } from '@/components/firewall/FortiIsfwDashboard';

export const metadata: Metadata = { 
  title: 'FortiGate ISFW - Internal Segmentation Firewall | Sentinel SOC',
  description: 'Zero-Trust East-West lateral movement containment, inter-VLAN access control, and deep UTM inspection telemetry.'
};

export default function FortiIsfwPage() {
  return <FortiIsfwDashboard />;
}