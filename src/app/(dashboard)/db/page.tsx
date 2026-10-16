import type { Metadata } from 'next';
import { DbDashboard } from '@/components/db/DbDashboard';

export const metadata: Metadata = { title: 'DB Monitor | Sentinel SOC' };

export default function Page() {
  return <DbDashboard />;
}
