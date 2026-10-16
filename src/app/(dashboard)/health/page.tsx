import type { Metadata } from 'next';
import ModulePlaceholder from '@/components/ModulePlaceholder';

export const metadata: Metadata = { title: 'Connector Health' };

export default function Page() {
  return <ModulePlaceholder title="Connector Health" description="Ingestion connectors and queue status." />;
}